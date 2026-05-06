#!/usr/bin/env python3
"""
detect_localstorage_hazards.py — z257: localStorage JSON.parse safety audit.

検出: JSON.parse(localStorage.getItem(...)) または
      JSON.parse(sessionStorage.getItem(...)) を try/catch で wrap せずに
      呼んでいる箇所。corrupted value (manual edit / browser bug) で
      throw して component が permanent crash する hazard。

検出 class:
  A. JSON.parse(localStorage.getItem(...)) が同 function 内 try block の
     外側 (try が無い、または try より後ろ)
  B. JSON.parse(sessionStorage.getItem(...)) 同上

許容パターン (false positive 抑制):
  - try/catch / try { ... } 内に含まれる場合 → safe
  - helper 関数の中で wrap されている場合は呼び出し元の責務 (ヒューリスティック skip)

scope:
  app/, components/, hooks/, lib/ の .ts/.tsx を全 scan。
  __tests__/ や .test. .spec. は除外。

--ci → hit > 0 で exit 1
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SCAN_DIRS = ["app", "components", "hooks", "lib"]
SCAN_EXTS = (".ts", ".tsx")

EXCLUDE_FRAGMENTS = ("/__tests__/", ".test.", ".spec.", "/node_modules/")

# Match: JSON.parse( <whitespace>* (local|session)Storage.getItem( ... ) )
PARSE_RE = re.compile(
    r"JSON\.parse\s*\(\s*(?:localStorage|sessionStorage)\.getItem\s*\(",
)


def is_inside_try_block(content: str, idx: int) -> bool:
    """
    Heuristic: scan backward from idx within the same function and find
    a `try {` whose matching `}` (close + optional catch/finally) wraps idx.
    Conservative — false positive (claiming safe when not) acceptable; we
    err on the side of NOT flagging if any try is in scope.
    """
    # cheap heuristic: walk backward, track brace depth, find a `try` keyword
    # whose `{` is followed by content that includes our idx position.
    snippet = content[:idx]
    # find all `try {` positions
    candidates = [m.start() for m in re.finditer(r"\btry\s*\{", snippet)]
    if not candidates:
        return False
    # for each candidate, find its matching close brace; if idx falls inside, safe
    for start in reversed(candidates):
        brace_open = snippet.find("{", start)
        if brace_open < 0:
            continue
        # walk forward in full content (not snippet) to find match
        depth = 0
        i = brace_open
        in_str = None
        in_line_comment = False
        in_block_comment = False
        while i < len(content):
            c = content[i]
            nxt = content[i + 1] if i + 1 < len(content) else ""
            if in_line_comment:
                if c == "\n":
                    in_line_comment = False
                i += 1
                continue
            if in_block_comment:
                if c == "*" and nxt == "/":
                    in_block_comment = False
                    i += 2
                    continue
                i += 1
                continue
            if in_str:
                if c == "\\" and i + 1 < len(content):
                    i += 2
                    continue
                if c == in_str:
                    in_str = None
                i += 1
                continue
            if c == "/" and nxt == "/":
                in_line_comment = True
                i += 2
                continue
            if c == "/" and nxt == "*":
                in_block_comment = True
                i += 2
                continue
            if c in ("'", '"', "`"):
                in_str = c
                i += 1
                continue
            if c == "{":
                depth += 1
            elif c == "}":
                depth -= 1
                if depth == 0:
                    # found matching close
                    if i > idx:
                        return True
                    break
            i += 1
    return False


def scan_file(path: Path) -> list[tuple[int, str]]:
    try:
        content = path.read_text(encoding="utf-8")
    except (UnicodeDecodeError, OSError):
        return []
    findings: list[tuple[int, str]] = []
    for m in PARSE_RE.finditer(content):
        if is_inside_try_block(content, m.start()):
            continue
        line_no = content[: m.start()].count("\n") + 1
        # extract the line
        line_start = content.rfind("\n", 0, m.start()) + 1
        line_end = content.find("\n", m.end())
        if line_end < 0:
            line_end = len(content)
        snippet = content[line_start:line_end].strip()[:140]
        findings.append((line_no, snippet))
    return findings


def main() -> int:
    ci = "--ci" in sys.argv
    total = 0
    files_with_hits = 0
    print("→ scanning for unsafe JSON.parse(localStorage.getItem(...))...")
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
                print(f"  🔴 {rel}:{line_no}  {snippet}")
                total += 1
    print()
    if total == 0:
        print("✅ detect_localstorage_hazards: 0 hits — all JSON.parse(storage) calls are guarded.")
        return 0
    print(f"🔴 detect_localstorage_hazards: {total} hit(s) across {files_with_hits} file(s).")
    print("   Fix: wrap JSON.parse(localStorage.getItem(...)) in try/catch with fallback,")
    print("        and call localStorage.removeItem(key) on parse failure to self-heal.")
    return 1 if ci else 0


if __name__ == "__main__":
    sys.exit(main())
