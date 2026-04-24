#!/usr/bin/env python3
"""
detect_locale_drift.py — bjj-app i18n / locale drift 自動検出

Day 5_236z140-z155 の MCP 視覚検証で繰り返し発見した i18n drift pattern を
CI で自動検出し、手動検証ループを停止する目的の lint。

対象 patterns (bjj-app 特化、既存 detect_hidden_bugs.py と非重複):
  1. Intl.DateTimeFormat("en", ...) — locale 固定 (z146)
  2. `locale === "ja"` で else が EN fallback (PT 無視, z145)
  3. `MONTH_LABELS_EN|JA` 定義済 + PT 欠落 (z147)
  4. pt.json 値 === en.json 値 (stale プレースホルダ, z150/z151)
  5. `title: "X | BJJ App"` top-level metadata (layout template 二重, z144/z149)

Usage:
    python3 scripts/detect_locale_drift.py              # pretty print
    python3 scripts/detect_locale_drift.py --ci         # CI: exit 1 if 🔴 > 0
"""

from __future__ import annotations
import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
APP = ROOT / "app"
COMPONENTS = ROOT / "components"
MESSAGES = ROOT / "messages"

# BJJ Layer 1 terms + brand names + common tokens that should remain identical
# (z151 audit 済み、pt==en で OK な既知値)
STALE_WHITELIST = {
    # BJJ 技術用語（PT BJJ でも英語のまま使う、Layer 1）
    "Gi", "No-Gi", "NoGi", "Open Mat", "Drilling", "Drill", "Flow", "Mount", "Back",
    "Comp", "Open", "Leg Locks", "Streak Freeze", "Sparring", "Armlock",
    # BJJ ポジション / ガード系リスト (Layer 1、英語表記が PT BJJ でも標準)
    "Closed, Half, Spider, DLR",
    "Heel hooks, Ashi garami, Toe holds",
    # BJJ 技リスト (技名は英語のまま使う)
    "Triangle Choke\nArmbar\nRear Naked Choke",
    # ブランド名 / 略語
    "BJJ", "BJJ App", "BJJ Wiki", "Pro", "Free", "Beta", "QR Code",
    "CSV", "PDF", "MMA", "IBJJF", "Stripe",
    "CSV (Pro)", "Free vs Pro",
    # 技術 abbrev / placeholder
    "min", "hrs", "hr", "sec", "Total: ", "total",
    "new@example.com", "{belt}",
    # Timezone ID
    "Asia/Tokyo", "America/New_York", "America/Sao_Paulo", "Europe/London",
    # 固有名詞
    "Triangle BJJ Academy", "Triangle Choke", "Armbar", "Rear Naked Choke",
    # 短い tech label
    "Popular", "Starter", "Log", "Add", "Skill Map", "Wiki",
    # 帯色（BJJ 文脈では両言語共通）
    "White", "Blue", "Purple", "Brown", "Black",
    "White Belt", "Blue Belt", "Purple Belt", "Brown Belt", "Black Belt",
    # UI 記号 / placeholder
    "DELETE", "Similar", "Similar —", "—",
}


# ── Utils ──────────────────────────────────────────────────────────

def flatten_json(d: dict, prefix: str = "") -> dict:
    out: dict = {}
    for k, v in d.items():
        key = f"{prefix}.{k}" if prefix else k
        if isinstance(v, dict):
            out.update(flatten_json(v, key))
        elif isinstance(v, str):
            out[key] = v
    return out


def iter_tsx_files():
    for root in (APP, COMPONENTS):
        if not root.exists():
            continue
        for p in root.rglob("*.tsx"):
            yield p


# ── Pattern 1: Intl.DateTimeFormat("en" ...) ─────────────────────────

def scan_intl_en_fixed() -> list:
    findings = []
    # Match Intl.DateTimeFormat("en", ...) or ("en-US" etc) when NOT taking locale variable
    pat = re.compile(r'new\s+Intl\.DateTimeFormat\s*\(\s*"(en|en-US|en-GB)"')
    for fp in iter_tsx_files():
        try:
            content = fp.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue
        for i, line in enumerate(content.splitlines(), 1):
            if pat.search(line):
                findings.append({
                    "id": "INTL_EN_FIXED",
                    "severity": "🟡",
                    "file": fp.relative_to(ROOT).as_posix(),
                    "line": i, "text": line.strip()[:120],
                    "description": 'Intl.DateTimeFormat("en"...) 固定 → intlLocale 変数に',
                    "z": "z146",
                })
    return findings


# ── Pattern 2: locale === "ja" without pt/en ─────────────────────────

def scan_locale_ja_only() -> list:
    findings = []
    pat_ja_only = re.compile(r'locale(?:Locale)?\s*===\s*"ja"(?!\s*\|\|\s*\S*?locale.*?===\s*"(?:pt|en)")')
    for fp in iter_tsx_files():
        try:
            content = fp.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue
        # Grab multi-line expressions: check the raw text after `=== "ja"`
        # Simpler: flag all occurrences and let dev verify
        for m in pat_ja_only.finditer(content):
            start = m.start()
            # Look ahead up to 300 chars for "pt" or "en"
            window = content[start:start + 400]
            if '"pt"' in window or "'pt'" in window:
                continue  # OK — has pt check nearby
            line_num = content[:start].count("\n") + 1
            line = content.splitlines()[line_num - 1] if line_num <= len(content.splitlines()) else ""
            findings.append({
                "id": "LOCALE_JA_ONLY",
                "severity": "🟡",
                "file": fp.relative_to(ROOT).as_posix(),
                "line": line_num, "text": line.strip()[:120],
                "description": 'locale === "ja" で pt check 欠落 → 3-way (ja/pt/en) に',
                "z": "z145",
            })
    return findings


# ── Pattern 3: MONTH_LABELS_EN|JA without _PT ────────────────────────

def scan_month_labels_drift() -> list:
    findings = []
    for fp in iter_tsx_files():
        try:
            c = fp.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue
        has_en = bool(re.search(r"MONTH_LABELS_EN\s*=", c))
        has_ja = bool(re.search(r"MONTH_LABELS_JA\s*=", c))
        has_pt = bool(re.search(r"MONTH_LABELS_PT\s*=", c))
        if (has_en or has_ja) and not has_pt:
            findings.append({
                "id": "MONTH_LABELS_NO_PT",
                "severity": "🟡",
                "file": fp.relative_to(ROOT).as_posix(), "line": 0,
                "text": f"EN={has_en} JA={has_ja} PT={has_pt}",
                "description": "MONTH_LABELS_PT が欠落",
                "z": "z147",
            })
    return findings


# ── Pattern 4: pt.json value === en.json value (stale placeholder) ──

def scan_pt_stale_placeholder() -> list:
    findings = []
    en_path = MESSAGES / "en.json"
    pt_path = MESSAGES / "pt.json"
    if not (en_path.exists() and pt_path.exists()):
        return findings
    with open(en_path, encoding="utf-8") as f:
        en = json.load(f)
    with open(pt_path, encoding="utf-8") as f:
        pt = json.load(f)
    en_flat = flatten_json(en)
    pt_flat = flatten_json(pt)
    for key, pt_val in pt_flat.items():
        if key not in en_flat:
            continue
        en_val = en_flat[key]
        if pt_val != en_val:
            continue
        if pt_val in STALE_WHITELIST:
            continue
        if pt_val.startswith("http") or pt_val.startswith("mailto:"):
            continue
        if len(pt_val) <= 2:
            continue
        if not re.search(r"[a-zA-Z]{3,}", pt_val):
            continue
        # Key-name based skips
        if any(s in key.lower() for s in ("url", "href", "id", "slug", "brand")):
            continue
        findings.append({
            "id": "PT_STALE_PLACEHOLDER",
            "severity": "🟡",
            "file": "messages/pt.json", "line": 0,
            "text": f"{key}: {pt_val!r}",
            "description": "pt == en のまま。翻訳すべき or Layer 1 なら STALE_WHITELIST に追加",
            "z": "z150/z151",
        })
    return findings


# ── Pattern 5: title: "X | BJJ App" top-level metadata ──────────────

def scan_title_double_suffix() -> list:
    findings = []
    # Find page.tsx / layout.tsx with top-level `title: "... | BJJ App"` not inside openGraph
    pat = re.compile(r'^\s*title:\s*"[^"]* \| BJJ App"', re.MULTILINE)
    for root in (APP,):
        for fp in root.rglob("*.tsx"):
            if fp.name not in ("page.tsx", "layout.tsx"):
                continue
            try:
                c = fp.read_text(encoding="utf-8", errors="ignore")
            except Exception:
                continue
            # Heuristic: skip if inside openGraph/twitter block (within { ... openGraph: { ... } })
            # Simple approach: for each match, check if enclosing block has "openGraph:" or "twitter:"
            for m in pat.finditer(c):
                start = m.start()
                # Look backward 500 chars for "openGraph:" or "twitter:"
                prior = c[max(0, start - 500):start]
                if "openGraph:" in prior or "twitter:" in prior:
                    continue
                # Also skip if `title: {` starts a nested object (title.default/template)
                line_num = c[:start].count("\n") + 1
                findings.append({
                    "id": "TITLE_DOUBLE_SUFFIX",
                    "severity": "🟡",
                    "file": fp.relative_to(ROOT).as_posix(),
                    "line": line_num, "text": m.group(0).strip()[:120],
                    "description": 'top-level title に "| BJJ App" suffix → template "%s | BJJ App" と二重適用',
                    "z": "z144/z149",
                })
    return findings


# ── Main ───────────────────────────────────────────────────────────

def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--ci", action="store_true",
                        help="CI mode: exit 1 if 🔴 Critical > 0")
    args = parser.parse_args()

    all_findings = []
    all_findings.extend(scan_intl_en_fixed())
    all_findings.extend(scan_locale_ja_only())
    all_findings.extend(scan_month_labels_drift())
    all_findings.extend(scan_pt_stale_placeholder())
    all_findings.extend(scan_title_double_suffix())

    criticals = [f for f in all_findings if f["severity"] == "🔴"]
    warnings = [f for f in all_findings if f["severity"] == "🟡"]

    if args.ci:
        print(f"🔴 Critical: {len(criticals)}")
        print(f"🟡 Warning:  {len(warnings)}")
        for f in (criticals + warnings)[:30]:
            print(f"  {f['severity']} [{f['id']}] {f['file']}:{f['line']} — {f['description']} ({f['z']})")
        return 1 if criticals else 0

    print("=" * 70)
    print("🛡️  bjj-app i18n / locale drift 自動検出 (z156 系列)")
    print("=" * 70)
    print(f"  🔴 Critical: {len(criticals)}")
    print(f"  🟡 Warning:  {len(warnings)}")
    print(f"  合計:       {len(all_findings)}")
    print()

    for sev, title in (("🔴", "CRITICAL"), ("🟡", "WARNING")):
        items = [f for f in all_findings if f["severity"] == sev]
        if not items:
            continue
        print(f"{sev} {title}:")
        for f in items:
            print(f"  {f['file']}:{f['line']} [{f['id']}] — {f['description']} ({f['z']})")
            if f.get("text"):
                print(f"    └─ {f['text'][:100]}")
        print()

    if not all_findings:
        print("✅ i18n drift なし。全 5 pattern に該当なし。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
