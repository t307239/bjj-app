#!/usr/bin/env python3
"""
detect_silent_catch_observability.py — z261q: observability lint for catch blocks

【経緯】
- z257 で `scripts/detect_unsafe_settimeout.py` 等の lint を追加した流れで、
  catch 句に対する observability の死角を CI で永久 block。
- 14 session で z260 → z261p まで実装された各種 lint と歩調を合わせ、
  Phase C (Sentry / clientLogger instrumentation gap audit) として導入。

【検出ロジック】
1. .ts / .tsx の app/, components/, lib/, hooks/ を walk
2. すべての `catch (...) { ... }` body を抽出
3. body 内に以下のいずれかが無い場合は WARNING:
   - clientLogger / serverLogger / logger / log.error/warn/info/debug
   - Sentry.*
   - console.error / console.warn / console.debug / console.info
   - setError / setErrorMsg / setToast / showToast / toast.error など UI error feedback
   - throw / return  ←  caller に propagate
   - results.push / action.lastError / lastError = ← batch summary パターン
   - NextResponse.json / NextResponse.redirect ← API route で error 応答
   - `// silent: ok` または `/* silent: ok */` opt-out marker

【opt-out】
意図的に error を握りつぶす場合は body 先頭に `// silent: ok — <reason>` を付ける。

Usage:
  python3 scripts/detect_silent_catch_observability.py [--ci]
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent

# Patterns that prove the catch handler IS reporting the error
SAFE_PATTERNS = [
    r"\b(?:clientLogger|serverLogger|logger|log)\.(?:error|warn|info|debug|fatal)\b",
    r"\bSentry\.(?:captureException|captureMessage|withScope|setContext|setTag)\b",
    r"\bconsole\.(?:error|warn|debug|info)\b",
    r"\bsetError\w*\(",
    r"\bsetErrorMsg\b",
    r"\bsetToast\b",
    r"\bshowToast\b",
    r"\bsetSnackbar\b",
    r"\btoast\.(?:error|warning|info|success)\b",
    r"\bthrow\b",
    r"\bNextResponse\.(?:json|redirect)\(",
    r"\bresults\.push\b",
    r"\baction\.lastError\b",
    r"\blastError\s*=",
    r"//\s*silent:\s*(?:ok|intentional)\b",
    r"/\*\s*silent:\s*(?:ok|intentional)\b",
]
SAFE_RE = re.compile("|".join(SAFE_PATTERNS), re.IGNORECASE)

EXCLUDE_PARTS = {"node_modules", ".next", "__tests__", ".claude", "archive", ".vercel", "scripts"}


def find_catches_in(content: str):
    """Yield (line_no, var_name, body_str) for each catch block."""
    for m in re.finditer(r"\bcatch\s*(?:\(\s*([\w$]*)\s*(?::\s*\w+)?\s*\)\s*)?\{", content):
        var = m.group(1) or ""
        start = m.end()
        depth = 1
        i = start
        in_str = None
        in_line_comment = False
        in_block_comment = False
        while i < len(content) and depth > 0:
            c = content[i]
            n = content[i + 1] if i + 1 < len(content) else ""
            if in_line_comment:
                if c == "\n":
                    in_line_comment = False
            elif in_block_comment:
                if c == "*" and n == "/":
                    in_block_comment = False
                    i += 1
            elif in_str:
                if c == "\\":
                    i += 1
                elif c == in_str:
                    in_str = None
            else:
                if c == "/" and n == "/":
                    in_line_comment = True
                    i += 1
                elif c == "/" and n == "*":
                    in_block_comment = True
                    i += 1
                elif c in ('"', "'", "`"):
                    in_str = c
                elif c == "{":
                    depth += 1
                elif c == "}":
                    depth -= 1
                    if depth == 0:
                        line_no = content[: m.start()].count("\n") + 1
                        yield line_no, var, content[start:i]
                        break
            i += 1


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--ci", action="store_true")
    args = ap.parse_args()

    findings: list[dict] = []
    scanned = 0

    for d in ["app", "components", "lib", "hooks"]:
        base = REPO / d
        if not base.exists():
            continue
        for fp in list(base.rglob("*.ts")) + list(base.rglob("*.tsx")):
            if any(s in fp.parts for s in EXCLUDE_PARTS):
                continue
            if fp.name.endswith(".test.ts") or fp.name.endswith(".test.tsx") or fp.name.endswith(".spec.ts"):
                continue
            try:
                content = fp.read_text(encoding="utf-8")
            except Exception:
                continue
            scanned += 1
            for line_no, var, body in find_catches_in(content):
                # Truly empty body → flag
                body_stripped = body.strip()
                if not body_stripped:
                    findings.append(
                        {
                            "file": str(fp.relative_to(REPO)),
                            "line": line_no,
                            "kind": "EMPTY",
                            "var": var,
                            "preview": "",
                        }
                    )
                    continue
                if SAFE_RE.search(body):
                    continue
                findings.append(
                    {
                        "file": str(fp.relative_to(REPO)),
                        "line": line_no,
                        "kind": "SILENT",
                        "var": var,
                        "preview": body_stripped[:80].replace("\n", " "),
                    }
                )

    print("=" * 70)
    print("🛡️  silent-catch observability lint (z261q)")
    print("=" * 70)
    print(f"Scanned: {scanned} files")

    if not findings:
        print("✅ Clean — all catch blocks have logger / fallback / opt-out marker")
        return 0

    print(f"🔴 Found {len(findings)} silent catch blocks:\n")
    for f in findings:
        print(f"  {f['file']}:{f['line']}  catch({f['var']})  {f['kind']}: {f['preview']!r}")
    print()
    print("Fix options:")
    print("  1. Add logger call (clientLogger.error / logger.warn / Sentry.captureException)")
    print("  2. Add UI feedback (setError / setToast / showToast)")
    print("  3. Add `// silent: ok — <reason>` marker if intentionally suppressed")

    return 1 if args.ci else 0


if __name__ == "__main__":
    sys.exit(main())
