#!/usr/bin/env python3
"""
detect_unsafe_settimeout.py — z257: setTimeout(...setState...) cleanup audit.

CLAUDE.md rule:
  setTimeout + setState: setTimeout(() => setXxx(...), ms) は必ず変数に代入し、
  useEffect の cleanup で clearTimeout すること。直接呼びはメモリリーク

検出:
  client component / hook 内で setTimeout(() => { setXxx(...) }, ms) を
  bare で呼んでおり、戻り値を変数 / ref に格納していないケース。

許容パターン (false positive 抑制):
  - const id = setTimeout(...)
  - timerRef.current = setTimeout(...)
  - return setTimeout(...)
  - setTimeout(...).await / 即時 await されている
  - non-state callback: setTimeout(() => fitView({...}), 50) のような
    純 UI side-effect (setState を含まない) は heuristic で除外

scope:
  app/, components/, hooks/ の .ts/.tsx ("use client" or 'use client' 含む or
  hooks/ 配下) のみ scan。server route / api 配下は除外 (lifecycle 違う)。

--ci → hit > 0 で exit 1
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SCAN_DIRS = ["app", "components", "hooks"]
SCAN_EXTS = (".ts", ".tsx")

# excluded path fragments
EXCLUDE_FRAGMENTS = ("/api/", "/__tests__/", ".test.", ".spec.")

# Heuristic: detect setTimeout(arg, ...) where arg is an arrow function
# whose body contains setXxx( — i.e. a setState call.
# We look for the setTimeout token at start of a "statement" (not assigned
# to a variable, not awaited, not returned).
SETTIMEOUT_RE = re.compile(
    r"(?P<lead>^|[\s;{}()\[\],])"  # boundary before
    r"setTimeout\s*\(",
    re.MULTILINE,
)


def is_client_file(path: Path, content: str) -> bool:
    if "/hooks/" in str(path):
        return True
    if path.suffix == ".tsx":
        return True
    return '"use client"' in content[:300] or "'use client'" in content[:300]


def find_matching_paren(text: str, open_idx: int) -> int:
    depth = 0
    in_str = None
    i = open_idx
    while i < len(text):
        c = text[i]
        if in_str:
            if c == "\\" and i + 1 < len(text):
                i += 2
                continue
            if c == in_str:
                in_str = None
            i += 1
            continue
        if c in ("'", '"', "`"):
            in_str = c
        elif c == "(":
            depth += 1
        elif c == ")":
            depth -= 1
            if depth == 0:
                return i
        i += 1
    return -1


def context_before(content: str, idx: int, n: int = 80) -> str:
    return content[max(0, idx - n):idx]


def scan_file(path: Path) -> list[tuple[int, str]]:
    try:
        content = path.read_text(encoding="utf-8")
    except (UnicodeDecodeError, OSError):
        return []
    if not is_client_file(path, content):
        return []
    findings: list[tuple[int, str]] = []
    for m in SETTIMEOUT_RE.finditer(content):
        lead = m.group("lead")
        token_start = m.end() - len("setTimeout(")
        # context immediately before to detect assignment / return / await
        ctx = context_before(content, token_start, n=60).rstrip()
        if (
            ctx.endswith("=")
            or ctx.endswith("return")
            or ctx.endswith("await")
            or ctx.endswith(",")
            or ctx.endswith("&&")
            or ctx.endswith("||")
            or ctx.endswith("?")
            or ctx.endswith(":")
            or ctx.endswith("(")
            or ctx.endswith("[")
        ):
            continue
        # find matching paren
        open_paren = m.end() - 1
        close_paren = find_matching_paren(content, open_paren)
        if close_paren < 0:
            continue
        body = content[open_paren + 1 : close_paren]
        # heuristic: body contains setState call (setX( where X starts with capital)
        if not re.search(r"\bset[A-Z][A-Za-z0-9_]*\s*\(", body):
            continue
        # bare statement form — flag
        line_no = content[: m.start()].count("\n") + 1
        snippet = body.strip().split("\n")[0][:120]
        findings.append((line_no, snippet))
    return findings


def main() -> int:
    ci = "--ci" in sys.argv
    total = 0
    files_with_hits = 0
    print("→ scanning client components / hooks for unsafe setTimeout(setState, ms)...")
    for d in SCAN_DIRS:
        root = REPO_ROOT / d
        if not root.exists():
            continue
        for fp in root.rglob("*"):
            if fp.suffix not in SCAN_EXTS:
                continue
            if any(frag in str(fp) for frag in EXCLUDE_FRAGMENTS):
                continue
            findings = scan_file(fp)
            if not findings:
                continue
            files_with_hits += 1
            rel = fp.relative_to(REPO_ROOT)
            for line_no, snippet in findings:
                print(f"  🔴 {rel}:{line_no}  setTimeout(() => {{ {snippet} }}, ...) — capture id + clearTimeout in cleanup")
                total += 1
    print()
    if total == 0:
        print("✅ detect_unsafe_settimeout: 0 hits — all setTimeout calls properly captured.")
        return 0
    print(f"🔴 detect_unsafe_settimeout: {total} hit(s) across {files_with_hits} file(s).")
    print("   Fix: const id = setTimeout(...); useEffect(() => () => clearTimeout(id), [])")
    print("   Or:  ref.current = setTimeout(...); cleanup with clearTimeout(ref.current)")
    return 1 if ci else 0


if __name__ == "__main__":
    sys.exit(main())
