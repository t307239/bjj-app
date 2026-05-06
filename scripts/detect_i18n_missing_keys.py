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


def check_translation_quality(en_f: dict[str, str], ja_f: dict[str, str], pt_f: dict[str, str]) -> list[dict]:
    """z255n: JA/PT が EN と完全一致 (untranslated) を検出。
    placeholder / brand / 技術用語 / IANA tz 等の意図的同一は WHITELIST で除外。"""
    findings: list[dict] = []
    # 意図的に EN と同じでよい key (placeholder, technical term, brand, IANA tz)
    INTENTIONAL_SAME = {
        # IANA timezone names
        "profile.timezoneAsia", "profile.timezoneAmerica",
        "profile.timezoneBrazil", "profile.timezoneEurope",
        # email / URL placeholder
        "profile.emailPlaceholder", "common.youtubePlaceholder",
        "gym.waitlistEmailPlaceholder", "gym.waitlistGymPlaceholder",
        "profile.deleteTypePlaceholder",
        # brand / 技術固有名詞
        "profile.stripe", "csv.locked", "common.error",
        "training.nogi",  # No-Gi は技術用語
        "training.calendarDrill", "training.drilling", "training.sizeDiffSimilar",
        "extendedBadges.gi_nogi.name",  # Gi & No-Gi
        "techniques.nameMultiplePlaceholder",  # 技名 example list
        "gym.curriculumTemplateLegLocks", "gym.qrTitle",
        "gymLanding.pricingPopular",
        "landing.wikiGuardDesc", "landing.wikiLegDesc",
        "home.streakDays",  # 🔥{n}d template
        "pricing.proMonthly", "pricing.proAnnual",
        "focus.mastery2",  # Sparring
        "privacy.cookies.marketingTitle",  # Marketing は international word
        "tokushoho.values.personInChargeVal",
        "tokushoho.values.addressNote", "tokushoho.values.phoneNote",
        # 法務文書の日本独自表記
        "gymLanding.footerTokushoho", "landing.footerTokushoho",
        "wikiHub.categoryDrillLabel",  # Drills (国際用語)
        "trainingLog.totalLabel", "chart.totalLabel",  # total
        "rollAnalytics.sizeSimilar",  # Similar — (PT も同じ spell)
        "beltProgress.timeAtBelt",  # template {belt}
        # 技術 region code / location
        "dpa.section3.supabaseLocation",  # US (ap-northeast-1)
        "dpa.section3.vercelLocation",  # Global CDN
    }

    for k, en_v in en_f.items():
        if k in INTENTIONAL_SAME:
            continue
        if len(en_v) <= 4:
            continue  # too short to translate meaningfully
        if not re.search(r"[a-z]", en_v):
            continue  # all caps, no need translate
        # Skip if value is mostly punctuation/numbers/braces
        if not re.search(r"[a-zA-Z]{3,}", en_v):
            continue

        if k in ja_f and ja_f[k] == en_v:
            findings.append({"lang": "ja", "key": k, "value": en_v[:60]})
        if k in pt_f and pt_f[k] == en_v:
            findings.append({"lang": "pt", "key": k, "value": en_v[:60]})

    return findings


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--ci", action="store_true")
    args = ap.parse_args()

    en = json.load(open(REPO / "messages/en.json", encoding="utf-8"))
    ja = json.load(open(REPO / "messages/ja.json", encoding="utf-8"))
    pt = json.load(open(REPO / "messages/pt.json", encoding="utf-8"))
    en_keys = flatten(en)
    ja_keys = flatten(ja)
    pt_keys = flatten(pt)

    def flat_strs(obj: dict, prefix: str = "") -> dict[str, str]:
        out: dict[str, str] = {}
        for k, v in obj.items():
            full = f"{prefix}.{k}" if prefix else k
            if isinstance(v, dict):
                out.update(flat_strs(v, full))
            elif isinstance(v, str):
                out[full] = v
        return out
    en_f, ja_f, pt_f = flat_strs(en), flat_strs(ja), flat_strs(pt)

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
        if any(s in fp.parts for s in ("node_modules", ".next", "__tests__", ".claude")):
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

    # z255n: 翻訳品質 check (JA/PT が EN と同じ = untranslated)
    quality_findings = check_translation_quality(en_f, ja_f, pt_f)

    # locale parity (en/ja/pt key counts)
    ja_missing = en_keys - ja_keys
    pt_missing = en_keys - pt_keys

    if not findings and not quality_findings and not ja_missing and not pt_missing:
        print("✅ Clean — i18n key + 翻訳品質 + 3 locale parity 全て整合")
        print(f"\nTotal keys: en={len(en_keys)}, ja={len(ja_keys)}, pt={len(pt_keys)}")
        return 0

    if quality_findings:
        print(f"🟡 Untranslated values ({len(quality_findings)}):")
        for f in quality_findings[:15]:
            print(f"  🟡 {f['lang']}.{f['key']}: {f['value']!r}")
        print()
    if ja_missing or pt_missing:
        if ja_missing:
            print(f"🟡 Keys in en but missing in ja ({len(ja_missing)}):")
            for k in sorted(ja_missing)[:5]: print(f"     {k}")
        if pt_missing:
            print(f"🟡 Keys in en but missing in pt ({len(pt_missing)}):")
            for k in sorted(pt_missing)[:5]: print(f"     {k}")
        print()

    if not findings:
        print(f"\nTotal en.json keys: {len(en_keys)}")
        return 1 if (args.ci and (quality_findings or ja_missing or pt_missing)) else 0

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
