#!/usr/bin/env python3
"""z261m: Detect <input type=email|password|tel|url> without autoComplete attribute.

WCAG 1.3.5 (Identify Input Purpose) + UX:
  - email / password / tel inputs should have autoComplete="email" / "current-password" etc.
  - url inputs that are NOT credentials should explicitly autoComplete="off" to suppress
    irrelevant browser autofill.

Either an autoComplete attribute (any value) is required. The lint does NOT enforce
a specific value — pick "on", "off", or a token (e.g. "email", "current-password").

CI: exits 1 if any violations.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TARGETS = list(ROOT.glob("components/**/*.tsx")) + list(ROOT.glob("app/**/*.tsx"))
TYPES_NEEDING_AUTOCOMPLETE = {"email", "password", "tel", "url"}


def strip_block_comments(text: str) -> str:
    out = []
    i = 0
    while i < len(text):
        if text[i : i + 2] == "/*":
            end = text.find("*/", i + 2)
            if end == -1:
                out.append(" " * (len(text) - i))
                break
            chunk = text[i : end + 2]
            out.append("".join(c if c == "\n" else " " for c in chunk))
            i = end + 2
        else:
            out.append(text[i])
            i += 1
    return "".join(out)


def extract_jsx_tag(text: str, start: int) -> str | None:
    i = start + 1
    db = 0
    while i < len(text):
        c = text[i]
        if c == "{":
            db += 1
        elif c == "}":
            db -= 1
        elif c == ">" and db == 0:
            return text[start : i + 1]
        i += 1
    return None


def main(ci_mode: bool = False) -> int:
    violations: list[tuple[Path, int, str, str]] = []
    for path in sorted(TARGETS):
        if ".test." in path.name or "__tests__" in str(path):
            continue
        try:
            raw = path.read_text(encoding="utf-8")
        except Exception:
            continue
        text = strip_block_comments(raw)
        for m in re.finditer(r"<input\b", text):
            tag = extract_jsx_tag(text, m.start())
            if not tag:
                continue
            m_type = re.search(r"\btype=[\"\']?(\w+)", tag)
            if not m_type:
                continue
            itype = m_type.group(1)
            if itype not in TYPES_NEEDING_AUTOCOMPLETE:
                continue
            if re.search(r"\bautoComplete\b", tag):
                continue
            ln = text[: m.start()].count("\n") + 1
            violations.append((path, ln, itype, " ".join(tag.split())[:140]))

    if violations:
        print(f"❌ A11y/UX: {len(violations)} <input type=email/password/tel/url> missing autoComplete")
        for path, ln, itype, snippet in violations:
            print(f"   {path.relative_to(ROOT)}:{ln} (type={itype}): {snippet}")
        print()
        print("   Fix: add autoComplete=\"email\" / \"current-password\" / \"tel\" / \"url\" / \"off\" (for non-credential URLs).")
        if ci_mode:
            return 1
    else:
        print("✅ All credential/contact inputs have autoComplete attribute.")
    return 0


if __name__ == "__main__":
    ci = "--ci" in sys.argv
    sys.exit(main(ci))
