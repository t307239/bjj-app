#!/usr/bin/env python3
"""
detect_i18n_missing_keys.py — z255m: i18n key reference の永続検証 lint

【経緯】
z255m UI 巡回で TSX 側で `t("common.error")` 等を呼んでいるが messages/en.json に
そのキーが存在しないケースを 5 件発見:
  - components/profile/EmailPreferenceSection.tsx common.error
  - components/GymDashboard.tsx gym.churnAlertTitle / gym.churnAlertDesc
  - components/RollAnalyticsCard.tsx rollAnalytics.insightFlow / insightHard

makeT() の fallback で missing key は文字列としてそのまま返す → UI に
「common.error」「gym.churnAlertTitle」 等の literal が表示される silent bug。

【lint logic】
1. messages/en.json から全 key (dot-notation で平坦化) を抽出
2. 全 .tsx / .ts で `t("key.name")` または `serverT("key.name")` を抽出
3. messages に無い key を 🔴 で報告
4. 動的キー (template literal / variable) は除外

【CI】
make verify と並ぶ forcing function。GHA で詰め込み、PR で fail させる。

Usage:
  python3 scripts/detect_i18n_missing_keys.py [--ci]
"""
from __future__ import annotations
import argparse
import json
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent

# 動的 key を許容する prefix (suffix が変数で補完されるパターン)
# 例: t(`techniques.categories.${cat}`) は categories.* 全体を allow
DYNAMIC_PREFIXES = {
    "techniques.categories",
    "techniques.masteryLevels",
    "training",  # type-specific keys (gi, nogi, drilling 等)
}


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
    ap.add_argument("--ci", action="store_true")
    args = ap.parse_args()

    en = json.load(open(REPO / "messages/en.json", encoding="utf-8"))
    en_keys = flatten(en)

    # `t("...")` または `serverT("...")` または `makeT(...)("...")` を抽出
    T_RE = re.compile(r'\b(?:t|serverT)\(\s*[`"\']([\w.]+)[`"\']')

    findings: list[dict] = []
    for fp in (
        list(REPO.rglob("app/**/*.tsx"))
        + list(REPO.rglob("components/**/*.tsx"))
        + list(REPO.rglob("lib/**/*.tsx"))
        + list(REPO.rglob("hooks/**/*.ts"))
        + list(REPO.rglob("hooks/**/*.tsx"))
    ):
        if any(s in fp.parts for s in ("node_modules", ".next", "__tests__")):
            continue
        try:
            content = fp.read_text(encoding="utf-8")
        except Exception:
            continue
        for m in T_RE.finditer(content):
            k = m.group(1)
            # Trailing dot は dynamic prefix の可能性
            if k.endswith("."):
                continue
            # Allow listed dynamic prefix
            if any(k.startswith(p + ".") or k == p for p in DYNAMIC_PREFIXES):
                continue
            if k not in en_keys:
                line_no = content[: m.start()].count("\n") + 1
                findings.append({
                    "file": str(fp.relative_to(REPO)),
                    "line": line_no,
                    "key": k,
                })

    print("=" * 70)
    print("🛡️  i18n missing keys lint (z255m)")
    print("=" * 70)
    print()

    if not findings:
        print("✅ Clean — 全 t() / serverT() の key が messages/en.json に存在")
        print(f"\nTotal en.json keys: {len(en_keys)}")
        return 0

    print(f"🔴 Found {len(findings)} missing i18n keys:")
    print()
    by_file: dict[str, list[dict]] = {}
    for f in findings:
        by_file.setdefault(f["file"], []).append(f)
    for fp, fs in by_file.items():
        print(f"  📄 {fp}")
        for f in fs:
            print(f"     L{f['line']}: t(\"{f['key']}\")")

    print()
    print("これらは t() の fallback で literal として表示される silent bug。")
    print("Fix: messages/{en,ja,pt}.json に該当 key を追加 + 翻訳。")
    print("Dynamic key (suffix が変数) は scripts/detect_i18n_missing_keys.py の")
    print("DYNAMIC_PREFIXES に prefix を追加して allow。")

    return 1 if args.ci else 0


if __name__ == "__main__":
    sys.exit(main())
