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


# ── Pattern 6: plural template without singular (`*One`) sibling ──────
# z167: "1 anos 10 meses" / "1 dias seguidos" 等の PT/EN 複数形誤用を防止。
# {n}/{m}/{y} + 複数形キーワードを含むキーには <key>One シブリングが必須。

# プレースホルダ込みでも n=1 到達不可能と確認済みのキー (call site で n>=2 などガード済み)。
# 新たに追加する際は、根拠となる guard 場所を comment で記載すること。
PLURAL_NO_SINGULAR_WHITELIST = {
    # NavBar — currentStreak >= 7 || >= 30 ガードで n=1 不可 (NavBar.tsx:125,129,219,223)
    "nav.streakBadge", "nav.streakDays", "nav.streakDaysStraight",
    # streakMsg* — 数値 suffix が下限 (Msg3=>n>=3, Msg7, Msg14, Msg30) なので n=1 不可
    # （正規表現で自動除外もできるが明示する）
    "dashboard.streakMsg3", "dashboard.streakMsg7", "dashboard.streakMsg14", "dashboard.streakMsg30",
    "dashboard.streakMilestoneShareText",
    # gym.daysAgo — days===0/1 ガード済 (MemberCard.tsx:45-46, CurriculumDispatch.tsx 同型)
    "gym.daysAgo", "gym.sentDaysAgo",
    # techniques.added*Ago — 各 helper で diffDays===0/===1 ガード済 (techniqueLogTypes.tsx:75-77)
    "techniques.addedDaysAgo", "techniques.addedWeeksAgo", "techniques.addedMonthsAgo",
    "techniques.addedYearsAgo",
    # その他 n=1 が業務上ありえない or 数値=複数前提 (template の仕様上)
    "techniques.freePlanLimit",  # n は固定 LIMIT (現状 50)
    "partnerStats.rolledWith",  # totalWithPartner >= UNLOCK_AT(=5) ガード
    "chart.pastMonths",  # n は range で 3/6/12 のみ
    "chart.past84Days",  # 期間文言。n=1 想定外
    "achievement.shareText",  # マイルストーン (10/50/100 等)
    "guest.ctaRecorded",  # ゲスト累計 1 はあり得るが共有 CTA で重要度低
    "milestones.nextBadge",  # 次バッジ閾値 (5/10/25...)
    "goal.monthsAchieved", "goal.monthsHabit", "goal.monthsInRow", "goal.consecutiveMonths",
    "goal.zeroDaysLeft",  # n は不足セッション数 (ほぼ複数)
    "goal.currentDone",  # n は累計 (>= 1 だが大半 >1 想定)
    "home.emptyWeekStat",  # n=0 想定の case
    "insights.longestStreak",  # 連続記録 (>=2 想定、=1 は表示頻度低)
    "dashboard.bentoDaysLeft", "dashboard.weeklyMoreSessionsPlural",
    "dashboard.motivationGapDays",
    "techniques.addedBulk",  # CSV 一括追加 (大半 >1)
    "beltProgress.stripesOf4",  # 0-4 範囲、n=1 で「1 / 4 listras」許容
    "report.sessions", "report.totalTime", "report.belt",  # KPI ラベル汎用
    "gym.sessionsPerMonth",  # ジムカード集計
    "gym.lastSessionDays",
    "share.tatameTime", "share.streakBadge",
    "streak.protect",  # 緊急リマインダー (n>=2 想定)
    # z167: 周辺機能で n=1 コーナーケース (将来 visible 化したら個別 fix)
    "profile.bjjHistory",  # "Praticando BJJ há {n} meses" — bjjHistoryMonths と重複, formatBjjDuration 経由が主
    "freeze.atRisk", "freeze.paywallTitle",  # streak freeze paywall (n>=2 想定)
    "report.insightStreak",  # 連続記録ハイライト (n>=2 想定)
    "insight.milestone", "insight.weekThree",  # ダッシュボード insight 文 (n>=2 想定)
    "matTime.etaYears", "matTime.etaMonths",  # ETA 推定 (n=1 表示頻度低)
}

PLURAL_KEYWORDS_EN = re.compile(r"\b(years|months|days|hours|sessions|stripes|techniques|people|users|items)\b", re.IGNORECASE)
PLURAL_KEYWORDS_PT = re.compile(r"\b(anos|meses|dias|horas|sessões|listras|técnicas|pessoas|usuários|itens|treinos|minutos|segundos)\b", re.IGNORECASE)
PLACEHOLDER = re.compile(r"\{[ynm]\}")


def scan_plural_without_singular() -> list:
    findings = []
    # gather sections (key paths) that have a plural-y template
    for loc in ("en", "pt"):
        p = MESSAGES / f"{loc}.json"
        if not p.exists():
            continue
        try:
            data = json.loads(p.read_text(encoding="utf-8"))
        except Exception:
            continue

        plural_re = PLURAL_KEYWORDS_EN if loc == "en" else PLURAL_KEYWORDS_PT

        def walk(prefix: str, obj):
            if isinstance(obj, dict):
                for k, v in obj.items():
                    walk(f"{prefix}.{k}" if prefix else k, v)
            elif isinstance(obj, str):
                if not PLACEHOLDER.search(obj):
                    return
                if not plural_re.search(obj):
                    return
                # If key already endswith "One" or contains "OneYear"/"OneMonth"/"OneStripe"/"OneSession", skip (it IS a singular)
                last = prefix.split(".")[-1]
                if last.endswith("One") or "OneYear" in last or "OneMonth" in last or "OneStripe" in last:
                    return
                # If whitelisted, skip
                if prefix in PLURAL_NO_SINGULAR_WHITELIST:
                    return
                # Check if sibling singular variant exists. Accept multiple naming conventions:
                #   - <key>One         (e.g., bjjHistoryMonthsOne)
                #   - <key-strip-s>One (e.g., bjjHistoryMonthOne — singular form already strips "s")
                #   - <key>+OneYear/OneMonth/OneYearMonths/YearsOneMonth/OneYearOneMonth
                #     (z166 multi-arg pluralization split: y+m combos)
                section = data.get(prefix.split(".")[0], {})
                if not isinstance(section, dict):
                    return
                candidates = {last + "One", last.rstrip("s") + "One"}
                # z166 multi-arg pattern: bjjHistoryYearsMonths → split into 3 sibling keys
                if "Years" in last and "Months" in last:
                    base = last.replace("Years", "").replace("Months", "").rstrip("YearsMonths") or "bjjHistory"
                    # Heuristic: if base prefix has OneYear/YearsOne/OneYearOne keys, count as covered
                    if any(k.startswith(last.replace("Months", "")) and "One" in k for k in section.keys()):
                        return
                if any(c in section for c in candidates):
                    return  # has singular variant
                findings.append({
                    "id": "PLURAL_NO_SINGULAR",
                    "severity": "🟡",
                    "file": f"messages/{loc}.json",
                    "line": 0,
                    "text": f"{prefix}: {obj[:80]}",
                    "description": f"plural template に {last}One sibling 欠落 (n=1 で誤用) — "
                                   f"call site で n=1 ガード済なら PLURAL_NO_SINGULAR_WHITELIST に追加",
                    "z": "z167",
                })

        walk("", data)
    return findings


# ── Pattern 7: security regressions (z168) ───────────────────────────
# JSON-LD scripts must use safeJsonLd() not raw JSON.stringify (XSS via </script>).
# auth/callback の next パラメータは safeNextPath() で validate 済みかチェック。

def scan_security_regressions() -> list:
    findings = []
    # 7a: dangerouslySetInnerHTML + JSON.stringify (without safeJsonLd) — z168
    pat_unsafe_jsonld = re.compile(
        r'dangerouslySetInnerHTML\s*=\s*\{\s*\{\s*__html\s*:\s*JSON\.stringify\(',
        re.MULTILINE,
    )
    for fp in (APP,):
        for tsx in fp.rglob("*.tsx"):
            try:
                c = tsx.read_text(encoding="utf-8", errors="ignore")
            except Exception:
                continue
            for m in pat_unsafe_jsonld.finditer(c):
                ln = c[:m.start()].count("\n") + 1
                findings.append({
                    "id": "UNSAFE_JSONLD",
                    "severity": "🔴",
                    "file": tsx.relative_to(ROOT).as_posix(),
                    "line": ln,
                    "text": c.splitlines()[ln-1].strip()[:120] if ln-1 < len(c.splitlines()) else "",
                    "description": "JSON.stringify in dangerouslySetInnerHTML — use safeJsonLd() to escape </script>",
                    "z": "z168",
                })
    # 7b: auth/callback NextResponse.redirect with raw `${origin}${next}` (open redirect)
    cb = ROOT / "app" / "auth" / "callback" / "route.ts"
    if cb.exists():
        try:
            c = cb.read_text(encoding="utf-8", errors="ignore")
            # Look for redirect with `${origin}${next}` pattern (raw, not via safeNextPath)
            if re.search(r'NextResponse\.redirect\(\s*`\$\{origin\}\$\{next\}', c):
                # Verify safeNextPath is NOT defined (or NOT applied)
                if "safeNextPath" not in c:
                    findings.append({
                        "id": "OPEN_REDIRECT",
                        "severity": "🔴",
                        "file": cb.relative_to(ROOT).as_posix(),
                        "line": 0,
                        "text": "auth/callback redirect uses raw `next` query param",
                        "description": "next param must be validated via safeNextPath() — open redirect vector",
                        "z": "z168",
                    })
        except Exception:
            pass
    return findings


# ── Pattern 8: cron fail-open (z169) ─────────────────────────────────
# CRON_SECRET 未設定時に誰でも cron を呼べてしまう "fail-open" の検出。
# `if (cronSecret) {check}` パターンは脆弱 — verifyCronAuth() helper を
# 使うか、`if (!cronSecret) return error` の fail-closed にすること。

def scan_cron_fail_open() -> list:
    findings = []
    cron_dir = ROOT / "app" / "api" / "cron"
    if not cron_dir.exists():
        return findings
    for fp in cron_dir.rglob("route.ts"):
        try:
            c = fp.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue
        rel = fp.relative_to(ROOT).as_posix()
        # OK if uses verifyCronAuth helper
        if "verifyCronAuth" in c:
            continue
        # Bad: `if (cronSecret) {` block (fail-open)
        if re.search(r"if\s*\(\s*cronSecret\s*\)\s*\{", c):
            findings.append({
                "id": "CRON_FAIL_OPEN",
                "severity": "🔴",
                "file": rel,
                "line": 0,
                "text": "if (cronSecret) {...} block — fail-open if env var unset",
                "description": "Use verifyCronAuth() helper; never gate auth check on env var presence",
                "z": "z169",
            })
        # Also flag if no CRON_SECRET reference at all in cron route (forgot auth entirely)
        elif "CRON_SECRET" not in c and "verifyCronAuth" not in c:
            findings.append({
                "id": "CRON_NO_AUTH",
                "severity": "🔴",
                "file": rel,
                "line": 0,
                "text": "no CRON_SECRET / verifyCronAuth reference",
                "description": "cron endpoint has no auth — anyone can trigger it",
                "z": "z169",
            })
    return findings


# ── Pattern 9: error.message leak in API responses (z169) ────────────
# `NextResponse.json({ error: error.message })` で Supabase / 外部エラー文を
# クライアントに返すと、schema 名 / policy 名 / 内部パス等が漏洩する。
# logger.error(...) で内部記録 + クライアントには generic message を返すこと。

def scan_error_message_leak() -> list:
    findings = []
    api = ROOT / "app" / "api"
    if not api.exists():
        return findings
    pat = re.compile(
        r"NextResponse\.json\(\s*\{\s*[^}]*?error:\s*[a-zA-Z_$.\[\]]+(?:\.error)?\.message"
        r"|NextResponse\.json\(\s*\{\s*[^}]*?error:\s*err\s+instanceof\s+Error\s*\?\s*err\.message",
        re.MULTILINE,
    )
    for fp in api.rglob("route.ts"):
        try:
            c = fp.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue
        rel = fp.relative_to(ROOT).as_posix()
        for m in pat.finditer(c):
            ln = c[:m.start()].count("\n") + 1
            findings.append({
                "id": "ERROR_MESSAGE_LEAK",
                "severity": "🟡",
                "file": rel,
                "line": ln,
                "text": c.splitlines()[ln-1].strip()[:120] if ln-1 < len(c.splitlines()) else "",
                "description": "error.message returned to client — leaks schema/policy. log internally, return generic message",
                "z": "z169",
            })
    return findings


# ── Pattern 10: console.error/warn outside centralized logger (z174) ─
# 中央集権 logger (lib/logger.ts / lib/clientLogger.ts) を経由しない
# console.error/warn は Sentry に届かないため observability gap になる。
# 例外: global-error.tsx (layout 自体が壊れた場合の最終手段)、JSDoc 例。

LOGGER_EXEMPT_FILES = {
    "lib/logger.ts",
    "lib/clientLogger.ts",
    "lib/sentryClient.ts",
    "app/global-error.tsx",  # Sentry init 前にも動く必要がある最終 fallback
    "lib/deploymentGuard.ts",  # JSDoc 例として登場のみ
}


def scan_console_outside_logger() -> list:
    findings = []
    pat = re.compile(r"console\.(error|warn)\s*\(", re.MULTILINE)
    for fp in iter_tsx_files():
        rel = fp.relative_to(ROOT).as_posix()
        if rel in LOGGER_EXEMPT_FILES:
            continue
        try:
            c = fp.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue
        # Strip block comments
        c_stripped = re.sub(r"/\*[\s\S]*?\*/", "", c)
        for m in pat.finditer(c_stripped):
            # Skip if inside JSDoc / line comment
            line_start = c_stripped.rfind("\n", 0, m.start()) + 1
            line_text = c_stripped[line_start:m.start()]
            if line_text.strip().startswith("//"):
                continue
            ln = c_stripped[:m.start()].count("\n") + 1
            findings.append({
                "id": "CONSOLE_OUTSIDE_LOGGER",
                "severity": "🟡",
                "file": rel,
                "line": ln,
                "text": (c.splitlines()[ln-1].strip() if ln-1 < len(c.splitlines()) else "")[:120],
                "description": f"console.{m.group(1)} は Sentry に届かない — logger.error / clientLogger.error を使うこと",
                "z": "z174",
            })
    return findings


# ── Pattern 11: message key parity (z176d) ───────────────────────────
# en/ja/pt の JSON 構造が揃っているかを strict 検査:
#   1. 全 key set が一致 (一方にあって他方にない key を 🔴 fail)
#   2. 各 value が non-empty string (空文字を 🟡 warning)
#   3. placeholder 数が一致 ({n} を持つ EN が JA で {n} を持っていない等)
# z150/z151/z167 等で繰り返し見つけた drift class を strict 化。

def scan_message_key_parity() -> list:
    findings = []
    paths = {
        loc: MESSAGES / f"{loc}.json"
        for loc in ("en", "ja", "pt")
    }
    if not all(p.exists() for p in paths.values()):
        return findings

    def flatten(d: dict, prefix: str = "") -> dict:
        out = {}
        for k, v in d.items():
            full = f"{prefix}.{k}" if prefix else k
            if isinstance(v, dict):
                out.update(flatten(v, full))
            else:
                out[full] = v
        return out

    flat = {
        loc: flatten(json.loads(p.read_text(encoding="utf-8")))
        for loc, p in paths.items()
    }
    en_keys = set(flat["en"].keys())
    ja_keys = set(flat["ja"].keys())
    pt_keys = set(flat["pt"].keys())

    # 1. Missing key detection
    for missing_key in (en_keys - ja_keys):
        findings.append({
            "id": "MESSAGE_KEY_MISSING_JA",
            "severity": "🔴",
            "file": "messages/ja.json",
            "line": 0,
            "text": f"{missing_key} = {flat['en'][missing_key]!r}"[:120],
            "description": f"key '{missing_key}' は en.json にあるが ja.json に欠落",
            "z": "z176d",
        })
    for missing_key in (en_keys - pt_keys):
        findings.append({
            "id": "MESSAGE_KEY_MISSING_PT",
            "severity": "🔴",
            "file": "messages/pt.json",
            "line": 0,
            "text": f"{missing_key} = {flat['en'][missing_key]!r}"[:120],
            "description": f"key '{missing_key}' は en.json にあるが pt.json に欠落",
            "z": "z176d",
        })
    for extra_key in (ja_keys - en_keys):
        findings.append({
            "id": "MESSAGE_KEY_EXTRA_JA",
            "severity": "🟡",
            "file": "messages/ja.json",
            "line": 0,
            "text": f"{extra_key} = {flat['ja'][extra_key]!r}"[:120],
            "description": f"key '{extra_key}' は ja.json にあるが en.json に欠落 (dead key 候補)",
            "z": "z176d",
        })
    for extra_key in (pt_keys - en_keys):
        findings.append({
            "id": "MESSAGE_KEY_EXTRA_PT",
            "severity": "🟡",
            "file": "messages/pt.json",
            "line": 0,
            "text": f"{extra_key} = {flat['pt'][extra_key]!r}"[:120],
            "description": f"key '{extra_key}' は pt.json にあるが en.json に欠落 (dead key 候補)",
            "z": "z176d",
        })

    # 2. Empty value detection (期待値 non-empty なのに空文字)
    INTENTIONAL_EMPTY = {
        # language-specific concatenation: EN 側だけ suffix を持つ等は intentional
        "beltProgress.beltSuffix",  # JA/PT は color 名に既に含む
        "chart.timesUnit",  # JA のみ "回" / EN/PT は "" (concat 不要)
    }
    placeholder_re = re.compile(r"\{[a-zA-Z]\w*\}")
    for loc, kv in flat.items():
        for k, v in kv.items():
            if k in INTENTIONAL_EMPTY:
                continue
            if isinstance(v, str) and not v.strip():
                findings.append({
                    "id": f"MESSAGE_EMPTY_VALUE_{loc.upper()}",
                    "severity": "🟡",
                    "file": f"messages/{loc}.json",
                    "line": 0,
                    "text": k,
                    "description": f"key '{k}' の値が空文字 (intentional なら INTENTIONAL_EMPTY に追加)",
                    "z": "z176d",
                })

    # 3. Placeholder count parity
    common_keys = en_keys & ja_keys & pt_keys
    for k in common_keys:
        en_v = flat["en"][k]
        ja_v = flat["ja"][k]
        pt_v = flat["pt"][k]
        if not all(isinstance(v, str) for v in (en_v, ja_v, pt_v)):
            continue
        en_ph = set(placeholder_re.findall(en_v))
        ja_ph = set(placeholder_re.findall(ja_v))
        pt_ph = set(placeholder_re.findall(pt_v))
        if en_ph != ja_ph or en_ph != pt_ph:
            findings.append({
                "id": "MESSAGE_PLACEHOLDER_DRIFT",
                "severity": "🔴",
                "file": "messages/*.json",
                "line": 0,
                "text": f"{k}: en={sorted(en_ph)} ja={sorted(ja_ph)} pt={sorted(pt_ph)}"[:120],
                "description": f"placeholder ({{n}} 等) が locale 間で不一致 — z150 (PT カテゴリ漏れ)/z167 (plural) と同型",
                "z": "z176d",
            })

    return findings


# ── Pattern 11: email send without rate limit (z189) ────────────────
# 7 cron が独立に Resend 送信するため、新規 user に同日 4 emails 着くなど
# spam ban リスクがあった。本 lint は Resend send call の周辺で
# canSendEmail / recordEmailSent helper の呼び出しが無ければ 🔴 fail。

EMAIL_RATE_LIMIT_EXEMPT = {
    # weekly-email: 既存で notification_preferences.weekly_email opt-out あり、
    # かつ「週1回 active user 限定」で frequency 設計済 (低リスク)。
    # 将来 z189 helper に移行予定だが今は exempt。
    "app/api/cron/weekly-email/route.ts",
    # weekly-goal: 同上、月曜のみ goal 設定済み user 限定
    "app/api/cron/weekly-goal/route.ts",
    # gym-milestone: gym 全体 1 通 / 月、低リスク
    "app/api/cron/gym-milestone/route.ts",
    # usage-alert: admin / pro 限定の運営アラート、user 体験影響なし
    "app/api/cron/usage-alert/route.ts",
    # reengagement: push 通知のみ、email でない
    "app/api/cron/reengagement/route.ts",
}


def scan_email_send_without_rate_limit() -> list:
    findings = []
    api = ROOT / "app" / "api"
    if not api.exists():
        return findings
    pat_send = re.compile(r'fetch\(\s*["\']https://api\.resend\.com/emails["\']')
    pat_helper = re.compile(r'\b(canSendEmail|recordEmailSent)\s*\(')

    for fp in api.rglob("route.ts"):
        rel = fp.relative_to(ROOT).as_posix()
        if rel in EMAIL_RATE_LIMIT_EXEMPT:
            continue
        try:
            c = fp.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue
        if not pat_send.search(c):
            continue
        # send call exists — 同じファイル内で helper 呼んでるか?
        if pat_helper.search(c):
            continue
        findings.append({
            "id": "EMAIL_SEND_NO_RATE_LIMIT",
            "severity": "🔴",
            "file": rel,
            "line": 0,
            "text": "Resend send without canSendEmail / recordEmailSent",
            "description": (
                "Resend 送信 call があるが lib/emailRateLimit.ts の helper を "
                "呼んでない → spam ban リスク。canSendEmail で send 前 check, "
                "recordEmailSent で send 後 record。意図的な exempt は "
                "EMAIL_RATE_LIMIT_EXEMPT に追加。"
            ),
            "z": "z189",
        })
    return findings


# ── Pattern 12: anon client rate-limit fail-open (z199) ─────────────
# 旧 /api/wiki/submit-video が anon (createServerClient + ANON_KEY) で
# count: "exact" SELECT → 429 guard していたが、anon RLS で SELECT 不可
# のため count = 0 で fail-open。攻撃者が無制限 spam 可能だった。
#
# 検出条件 (3 つ全て満たす API route):
#   1. anon client 生成: createServerClient( OR NEXT_PUBLIC_SUPABASE_ANON_KEY
#   2. count: "exact" (rate-limit 用 SELECT の signature)
#   3. status code 429 を返す (rate-limit 用 guard の signature)
#   AND  createAdminClient ( がファイル内に無い (= anon でしか SELECT してない)

ANON_RATE_LIMIT_EXEMPT: set[str] = {
    # 例: rate limit を意図的に anon で行い、RLS で SELECT 許可済の route
    # (現状なし)
}


def scan_anon_rate_limit_fail_open() -> list:
    findings = []
    api = ROOT / "app" / "api"
    if not api.exists():
        return findings
    pat_anon = re.compile(r"createServerClient\(|NEXT_PUBLIC_SUPABASE_ANON_KEY")
    pat_count = re.compile(r"count:\s*[\"']exact[\"']")
    pat_429 = re.compile(r"\b429\b")
    # service_role client signals (どれか 1 つでもあれば service_role が参加 → false positive 回避)
    pat_admin = re.compile(
        r"createAdminClient\s*\(|"
        r"createServiceClient\s*\(|"
        r"SUPABASE_SERVICE_ROLE_KEY|"
        r"supabaseServiceRoleKey"
    )

    for fp in api.rglob("route.ts"):
        rel = fp.relative_to(ROOT).as_posix()
        if rel in ANON_RATE_LIMIT_EXEMPT:
            continue
        try:
            c = fp.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue
        if not (pat_anon.search(c) and pat_count.search(c) and pat_429.search(c)):
            continue
        if pat_admin.search(c):
            continue  # service_role 由来の client が参加 → rate limit は service_role 経由
        findings.append({
            "id": "ANON_RATE_LIMIT_FAIL_OPEN",
            "severity": "🔴",
            "file": rel,
            "line": 0,
            "text": "anon client + count select + 429 guard without createAdminClient",
            "description": (
                "anon Supabase client で rate-limit 用の count SELECT を行い "
                "429 を返している。anon が RLS で SELECT 不可なら count=0 で "
                "fail-open する。createAdminClient (service_role) 経由で SELECT "
                "するか、意図的なら ANON_RATE_LIMIT_EXEMPT に追加。"
            ),
            "z": "z199",
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
    all_findings.extend(scan_message_key_parity())
    all_findings.extend(scan_title_double_suffix())
    all_findings.extend(scan_plural_without_singular())
    all_findings.extend(scan_security_regressions())
    all_findings.extend(scan_cron_fail_open())
    all_findings.extend(scan_error_message_leak())
    all_findings.extend(scan_console_outside_logger())
    all_findings.extend(scan_email_send_without_rate_limit())
    all_findings.extend(scan_anon_rate_limit_fail_open())

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
