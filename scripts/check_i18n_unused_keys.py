#!/usr/bin/env python3
"""
check_i18n_unused_keys.py — z261q: report i18n keys with no static reference.

【目的】
Phase A (i18n key coverage gap audit) の A-2 part — messages/en.json に
定義されているが、bjj-app の production source code (app/, components/, lib/,
hooks/) で `t("key")` / `serverT("key")` / リテラル参照のどれにも引っかからない
key を informational report として出力する。

【判定方針】
- false-positive を許容する保守的 lint
- 削除判断は manual triage 前提
- DYNAMIC_PREFIXES と template literal による動的 dispatch を allow-list
- __tests__ / .claude / archive / scripts / node_modules / .next は除外

【使い方】
  python3 scripts/check_i18n_unused_keys.py            # human-readable report
  python3 scripts/check_i18n_unused_keys.py --json     # JSON output
  python3 scripts/check_i18n_unused_keys.py --top 20   # only top N

【意図的に CI で fail させない】
Unused-key の自動削除は dynamic dispatch / future feature flag / a11y aria-label 等
で false-positive が出やすい。CI に組み込むより、3 ヶ月に一度 audit して BACKLOG に
積む方が安全 (rule -4 の root-cause 修正と整合)。
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent

DYNAMIC_PREFIXES = {
    "techniques.categories",
    "techniques.masteryLevels",
    "training",
}

EXCLUDE_PARTS = {"node_modules", ".next", "__tests__", ".claude", "archive", ".vercel", "scripts"}


def flatten(obj: dict, prefix: str = "") -> set[str]:
    keys: set[str] = set()
    for k, v in obj.items():
        full = f"{prefix}.{k}" if prefix else k
        if isinstance(v, dict):
            keys |= flatten(v, full)
        elif isinstance(v, list):
            keys.add(full)
            for i in range(len(v)):
                keys.add(f"{full}.{i}")
        else:
            keys.add(full)
    return keys


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--json", action="store_true", help="JSON output")
    ap.add_argument("--top", type=int, default=0, help="show only top N candidates")
    args = ap.parse_args()

    en = json.load(open(REPO / "messages/en.json", encoding="utf-8"))
    all_keys = flatten(en)

    T_RE = re.compile(r'\b(?:t|serverT|makeT|getMessage)\(\s*[`"\']([\w.]+)[`"\']')
    TEMPLATE_RE = re.compile(r'\b(?:t|serverT|makeT|getMessage)\(\s*`([^`]+)`')
    LITERAL_RE = re.compile(r'[`"\']([\w]+(?:\.[\w]+){1,})[`"\']')

    referenced: set[str] = set()
    dynamic_used_prefixes: set[str] = set()

    src_dirs = ["app", "components", "lib", "hooks"]
    files: list[Path] = []
    for d in src_dirs:
        base = REPO / d
        if base.exists():
            files.extend(base.rglob("*.tsx"))
            files.extend(base.rglob("*.ts"))
    for p in ["middleware.ts", "instrumentation.ts", "instrumentation-client.ts"]:
        f = REPO / p
        if f.exists():
            files.append(f)

    scanned = 0
    for fp in files:
        if any(s in fp.parts for s in EXCLUDE_PARTS):
            continue
        if fp.name.endswith(".test.ts") or fp.name.endswith(".test.tsx") or fp.name.endswith(".spec.ts"):
            continue
        try:
            content = fp.read_text(encoding="utf-8")
        except Exception:
            continue
        scanned += 1
        for m in T_RE.finditer(content):
            referenced.add(m.group(1))
        for m in TEMPLATE_RE.finditer(content):
            s = m.group(1)
            if "${" in s:
                pref = s.split("${")[0].rstrip(".")
                if pref:
                    dynamic_used_prefixes.add(pref)
        for m in LITERAL_RE.finditer(content):
            k = m.group(1)
            if k in all_keys:
                referenced.add(k)

    all_dynamic = set(DYNAMIC_PREFIXES) | dynamic_used_prefixes

    def is_dynamic(k: str) -> bool:
        for p in all_dynamic:
            if k == p or k.startswith(p + "."):
                return True
        return False

    unused = sorted(k for k in all_keys if k not in referenced and not is_dynamic(k))

    if args.json:
        print(json.dumps({
            "scanned_files": scanned,
            "total_keys": len(all_keys),
            "referenced": len(referenced),
            "dynamic_prefixes": sorted(all_dynamic),
            "unused_count": len(unused),
            "unused": unused,
        }, ensure_ascii=False, indent=2))
        return 0

    print("=" * 70)
    print("📊 i18n unused-key audit (informational, manual triage required)")
    print("=" * 70)
    print(f"Scanned files: {scanned}")
    print(f"Total en.json keys: {len(all_keys)}")
    print(f"Referenced (static): {len(referenced)}")
    print(f"Dynamic prefixes inferred: {len(all_dynamic)}")
    print(f"Unused candidates: {len(unused)}")
    print()
    n = args.top if args.top > 0 else len(unused)
    for k in unused[:n]:
        print(f"  {k}")
    if args.top and len(unused) > args.top:
        print(f"  ... +{len(unused) - args.top} more")
    print()
    print("⚠️  These are candidates only — verify manually before deletion.")
    print("    Dynamic dispatch, RSC-only paths, and a11y labels can hide real usage.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
