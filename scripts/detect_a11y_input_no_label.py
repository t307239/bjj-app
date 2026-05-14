#!/usr/bin/env python3
"""z261k: Detect <input>, <textarea>, <select> elements without an accessible name (a11y).

Detects user-visible form controls that have:
  - no aria-label / aria-labelledby
  - no <label htmlFor={id}> referencing their id
  - no surrounding <label> element (within 10 lines before or 5 lines after)

For <input>, type=hidden/submit/button/reset/checkbox/radio/file are excluded
(checkbox/radio are typically wrapped in a clickable <label> already).

Excludes:
  - JSX block comments (/* ... */)
  - components/ui/DraftNumberInput.tsx (wrapper — parent supplies label)

CI: exits 1 if any violations remain.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TARGETS = list(ROOT.glob("components/**/*.tsx")) + list(ROOT.glob("app/**/*.tsx"))
EXCLUDED_FILES = {"components/ui/DraftNumberInput.tsx"}
EXCLUDED_TYPES = {"hidden", "submit", "button", "reset", "checkbox", "radio", "file"}


def strip_block_comments(text: str) -> str:
    """Remove /* ... */ block comments (replace with whitespace, preserving line numbers)."""
    out = []
    i = 0
    while i < len(text):
        if text[i : i + 2] == "/*":
            end = text.find("*/", i + 2)
            if end == -1:
                # unterminated; pad rest with spaces
                out.append(" " * (len(text) - i))
                break
            # Keep newlines for line number stability
            chunk = text[i : end + 2]
            out.append("".join(c if c == "\n" else " " for c in chunk))
            i = end + 2
        else:
            out.append(text[i])
            i += 1
    return "".join(out)


def extract_jsx_tag(text: str, start: int) -> str | None:
    i = start + 1
    depth_brace = 0
    while i < len(text):
        c = text[i]
        if c == "{":
            depth_brace += 1
        elif c == "}":
            depth_brace -= 1
        elif c == ">" and depth_brace == 0:
            return text[start : i + 1]
        i += 1
    return None


def _check_tag(path: Path, text: str, lines: list[str], tag_name: str, m_iter):
    """Return list of (path, line_no, snippet) for tag_name occurrences missing labels."""
    out: list[tuple[Path, int, str]] = []
    for m in m_iter:
        tag = extract_jsx_tag(text, m.start())
        if not tag:
            continue
        if tag_name == "input":
            m_type = re.search(r"\btype=[\"\']?(\w+)", tag)
            itype = m_type.group(1) if m_type else "text"
            if itype in EXCLUDED_TYPES:
                continue
        if re.search(r"\baria-label\b", tag) or re.search(r"\baria-labelledby\b", tag):
            continue
        m_id = re.search(r"\bid=[\"\']([^\"\']+)", tag)
        if m_id:
            iid = m_id.group(1)
            if re.search(rf"<label\b[^>]*?\bhtmlFor=[\"\']?{re.escape(iid)}\b", text):
                continue
        ln = text[: m.start()].count("\n") + 1
        ctx_before = "\n".join(lines[max(0, ln - 10) : ln + 1])
        if re.search(r"<label\b", ctx_before):
            continue
        ctx_after = "\n".join(lines[ln : ln + 5])
        if re.search(r"<label\b", ctx_after):
            continue
        snippet = " ".join(tag.split())[:120]
        out.append((path, ln, snippet))
    return out


def main(ci_mode: bool = False) -> int:
    violations: list[tuple[Path, int, str, str]] = []
    for path in sorted(TARGETS):
        rel = str(path.relative_to(ROOT))
        if rel in EXCLUDED_FILES:
            continue
        if ".test." in path.name or "__tests__" in str(path):
            continue
        try:
            raw = path.read_text(encoding="utf-8")
        except Exception:
            continue
        text = strip_block_comments(raw)
        lines = text.split("\n")
        for tname in ("input", "textarea", "select"):
            for p, ln, snippet in _check_tag(path, text, lines, tname, re.finditer(rf"<{tname}\b", text)):
                violations.append((p, ln, snippet, tname))

    if violations:
        print(f"❌ A11y violation: {len(violations)} form controls lack accessible name (no aria-label / no <label>)")
        for path, ln, snippet, tname in violations:
            print(f"   {path.relative_to(ROOT)}:{ln} ({tname}): {snippet}")
        print()
        print("   Fix: add aria-label={t(\"<section>.aria<Field>\")} OR wrap in <label>…</label>")
        if ci_mode:
            return 1
    else:
        print("✅ All form controls (<input>/<textarea>/<select>) have accessible names.")
    return 0


if __name__ == "__main__":
    ci = "--ci" in sys.argv
    sys.exit(main(ci))
