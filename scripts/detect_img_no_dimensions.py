#!/usr/bin/env python3
"""z261k: Detect <img> / next/image <Image> without width/height (CLS hazard).

Cumulative Layout Shift (CLS) is a Core Web Vitals metric. Images without
explicit width/height cause layout shift as they load, hurting CLS score.

Detects:
  - native <img> tag missing width OR height attribute
  - next/image <Image> missing width OR height (unless using `fill` prop)

Excludes:
  - JSX block comments (/* ... */)
  - Strings embedded in HTML (e.g. print preview window template literals) —
    detected as no surrounding JSX context.

CI: exits 1 if any violations.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TARGETS = list(ROOT.glob("components/**/*.tsx")) + list(ROOT.glob("app/**/*.tsx"))


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


def is_in_string_template(text: str, pos: int) -> bool:
    """Heuristic: check if the `<img` at pos is inside a template literal `..`."""
    # Walk back to find unmatched backtick
    bt_count = text[:pos].count("`")
    return bt_count % 2 == 1


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
        # <img>
        for m in re.finditer(r"<img\b", text):
            if is_in_string_template(text, m.start()):
                continue
            tag = extract_jsx_tag(text, m.start())
            if not tag:
                continue
            has_w = bool(re.search(r"\bwidth\s*=", tag))
            has_h = bool(re.search(r"\bheight\s*=", tag))
            if has_w and has_h:
                continue
            ln = text[: m.start()].count("\n") + 1
            violations.append((path, ln, " ".join(tag.split())[:120], "img"))
        # <Image (next/image)
        if "next/image" not in raw:
            continue
        for m in re.finditer(r"<Image\b", text):
            tag = extract_jsx_tag(text, m.start())
            if not tag:
                continue
            if re.search(r"\bfill\b", tag):
                continue
            has_w = bool(re.search(r"\bwidth\s*=", tag))
            has_h = bool(re.search(r"\bheight\s*=", tag))
            if has_w and has_h:
                continue
            ln = text[: m.start()].count("\n") + 1
            violations.append((path, ln, " ".join(tag.split())[:120], "Image"))

    if violations:
        print(f"❌ Perf/CLS: {len(violations)} <img>/<Image> elements missing width/height")
        for path, ln, snippet, kind in violations:
            print(f"   {path.relative_to(ROOT)}:{ln} ({kind}): {snippet}")
        print()
        print("   Fix: add explicit width={W} height={H} attributes (in pixels) OR pass `fill` for <Image>.")
        if ci_mode:
            return 1
    else:
        print("✅ All <img>/<Image> elements have width/height (CLS protected).")
    return 0


if __name__ == "__main__":
    ci = "--ci" in sys.argv
    sys.exit(main(ci))
