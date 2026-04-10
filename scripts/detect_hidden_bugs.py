#!/usr/bin/env python3
"""
detect_hidden_bugs.py — bjj-app のスコアに表れない「隠れバグ」を自動検知

AUDIT_FRAMEWORK.md の20軸スコアリングでは見逃される、
目視でしか発見できなかった問題を機械的に検出する。

検知カテゴリ:
  1. i18n カバレッジ不足（locale間キー欠損）
  2. i18n locale純粋性（ハードコード混在）
  3. モックデータ残骸（ハードコード数値・ダミーテキスト）
  4. レイアウト崩壊予兆（CSS防御不足）
  5. コメントアウト残骸（{false && ...}）
  6. 技術的内部値UI露出（"84 days" 等）
  7. console.log 残存
  8. JSONファイル文字化け（Â·, Â©等のダブルエンコード）
  9. TypeScript関数内ハードコードUI文字列（JSX外の "Today"/"Yesterday" 等）
 10. 未使用import検出（import後に参照がないシンボル）
 11. `as any` / `: any` 型エスケープ検出
 12. アクセシビリティ欠損（アイコンonly button/link にaria-label無し、img alt無し）
 13. dangerouslySetInnerHTML 使用箇所の列挙
 14. クライアントコードからの秘密env直参照（NEXT_PUBLIC_ 以外の process.env）
 15. TODO/FIXME/HACK コメント残存
 16. 未使用exportコンポーネント（デッドコード）
 17. Supabase query の error 未ハンドリング
 18. Promise .then() without .catch()（サイレント失敗）
 19. ゾンビファイル（空・DEPRECATED のみ・export なし）
 20. .catch(() => {}) サイレントエラー握りつぶし
 21. Missing error.tsx（Error Boundary 欠落）
 22. Missing loading.tsx（Suspense 欠落）

使い方:
    python3 scripts/detect_hidden_bugs.py              # 全チェック
    python3 scripts/detect_hidden_bugs.py --fix-hint   # 修正ヒント付き
    python3 scripts/detect_hidden_bugs.py --ci         # CI用（exitcode=CRITICAL数）

依存: Python 3.8+ 標準ライブラリのみ
"""

import os
import re
import sys
import json
import argparse
from pathlib import Path
from collections import defaultdict

# ─────────────────────────────────────────────────────
# 設定
# ─────────────────────────────────────────────────────

APP_ROOT = Path(__file__).parent.parent
MESSAGES_DIR = APP_ROOT / "messages"
APP_DIR = APP_ROOT / "app"
COMPONENTS_DIR = APP_ROOT / "components"
LIB_DIR = APP_ROOT / "lib"
SCAN_DIRS = [APP_DIR, COMPONENTS_DIR, LIB_DIR]


# ─────────────────────────────────────────────────────
# Bug Report
# ─────────────────────────────────────────────────────

class BugReport:
    def __init__(self):
        self.bugs = []

    def add(self, severity: str, category: str, filepath: str, detail: str, fix_hint: str = ""):
        self.bugs.append((severity, category, filepath, detail, fix_hint))

    def count(self, severity: str = None) -> int:
        if severity:
            return sum(1 for b in self.bugs if b[0] == severity)
        return len(self.bugs)


# ─────────────────────────────────────────────────────
# i18n チェッカー
# ─────────────────────────────────────────────────────

def flatten_keys(obj, prefix=""):
    """JSON objのキーをフラット化"""
    keys = []
    for k, v in obj.items():
        full = f"{prefix}.{k}" if prefix else k
        if isinstance(v, dict):
            keys.extend(flatten_keys(v, full))
        else:
            keys.append(full)
    return keys


def check_i18n_coverage(report: BugReport):
    """i18nカバレッジチェック（ENをベースに他言語の欠損キーを検出）"""
    en_path = MESSAGES_DIR / "en.json"
    if not en_path.exists():
        return

    with open(en_path, encoding="utf-8") as f:
        en_keys = set(flatten_keys(json.load(f)))

    for locale in ["ja", "pt"]:
        locale_path = MESSAGES_DIR / f"{locale}.json"
        if not locale_path.exists():
            report.add("CRITICAL", "I18N_MISSING", f"messages/{locale}.json", "ファイルが存在しない")
            continue

        with open(locale_path, encoding="utf-8") as f:
            locale_keys = set(flatten_keys(json.load(f)))

        missing = en_keys - locale_keys
        coverage = len(locale_keys) / len(en_keys) * 100 if en_keys else 100

        if coverage < 90:
            severity = "CRITICAL"
        elif coverage < 95:
            severity = "WARNING"
        else:
            severity = "INFO"

        if missing:
            report.add(
                severity, "I18N_COVERAGE",
                f"messages/{locale}.json",
                f"カバレッジ {coverage:.0f}% ({len(locale_keys)}/{len(en_keys)} キー) — {len(missing)} キー欠損",
                f"欠損例: {', '.join(sorted(missing)[:5])}",
            )


# ─────────────────────────────────────────────────────
# TSX スキャナー
# ─────────────────────────────────────────────────────

def find_source_files() -> list[Path]:
    """app/ components/ lib/ 配下の全 .tsx / .ts ファイルを取得"""
    files = []
    for d in SCAN_DIRS:
        if d.exists():
            files.extend(d.rglob("*.tsx"))
            files.extend(d.rglob("*.ts"))
    return sorted(set(files))


def check_hardcoded_strings(filepath: Path, content: str, report: BugReport):
    """ハードコード文字列の検出（JSX内の日英混在テキスト）"""
    rel = filepath.relative_to(APP_ROOT)

    # JSXコメント除去してからスキャン
    content_no_comments = re.sub(r'\{/\*.*?\*/\}', '', content, flags=re.DOTALL)
    # // コメント行も除去
    content_no_comments = re.sub(r'//.*$', '', content_no_comments, flags=re.MULTILINE)
    # コードブロック内（IIFE・関数本体）を除去して偽陽性を防ぐ
    content_no_comments = re.sub(r'\(\s*\)\s*=>\s*\{[^}]*\}', '', content_no_comments, flags=re.DOTALL)

    # 日英混在ハードコード: "Weight(体重)" パターン
    # ※ 短い文字列（<60文字）かつ日本語CJK文字と英単語が近接するものだけを検出
    mixed_patterns = [
        (r'>[A-Za-z]+\([^)]*[\u3040-\u9FFF]+[^)]*\)<', "日英混在テキスト"),
        # 日本語テキスト内に連続する英単語（3文字以上）が含まれる場合
        # ただしURL・コメント・コード識別子（アッパーキャメル・アンダースコア）は除外
        (r'>([^<\n]{0,40}[\u3040-\u9FFF]+[^<\n]{0,10}[a-z]{4,}[^<\n]{0,40})<', "多言語混在（JAの中に英語）"),
    ]
    for pattern, desc in mixed_patterns:
        matches = re.findall(pattern, content_no_comments)
        for m in matches:
            m_str = m if isinstance(m, str) else m
            # 偽陽性フィルタ: JSXコード構造・ファイルパス・URL等
            if len(m_str) > 80:
                continue
            if any(skip in m_str for skip in ['/*', '//', '=>', '()', '{', '}']):
                continue
            report.add(
                "WARNING", "HARDCODED_MIXED",
                str(rel),
                f"{desc}: '{m_str[:60]}'",
                "t() / serverT() 経由に修正",
            )


def check_mock_data(filepath: Path, content: str, report: BugReport):
    """モックデータ残骸検出"""
    rel = filepath.relative_to(APP_ROOT)

    # ダミーテキスト
    dummy_patterns = [
        (r'"John\s+Doe"', "ダミー名"),
        (r'"test@example\.com"', "ダミーEmail"),
        (r'"Jane\s+Doe"', "ダミー名"),
        (r'lorem\s+ipsum', "ダミーテキスト"),
        (r'"84month"', "テスト残骸"),
    ]
    for pattern, desc in dummy_patterns:
        if re.search(pattern, content, re.IGNORECASE):
            report.add(
                "CRITICAL", "MOCK_DATA",
                str(rel),
                f"{desc} が残存: '{pattern}'",
                "動的変数またはi18nキーに置換",
            )


def check_comment_out_remnants(filepath: Path, content: str, report: BugReport):
    """コメントアウト残骸検出"""
    rel = filepath.relative_to(APP_ROOT)

    # {false && <Component />} パターン
    false_blocks = re.findall(r'\{false\s*&&\s*', content)
    if false_blocks:
        report.add(
            "WARNING", "COMMENTED_OUT",
            str(rel),
            f"{{false && ...}} ブロックが {len(false_blocks)} 件残存",
            "完全削除（CLAUDE.mdルール: コメントアウト禁止）",
        )

    # {/* old ... */} コメント
    old_comments = re.findall(r'\{/\*\s*old\b', content, re.IGNORECASE)
    if old_comments:
        report.add(
            "WARNING", "COMMENTED_OUT",
            str(rel),
            f"'old' コメント {len(old_comments)} 件",
            "完全削除",
        )


def check_layout_fragility(filepath: Path, content: str, report: BugReport):
    """レイアウト崩壊の予兆検出"""
    rel = filepath.relative_to(APP_ROOT)

    # 数値+単位が並ぶ箇所でwhitespace-nowrapがない
    # 例: <span>{value}</span><span>kg</span> without nowrap
    number_unit_patterns = re.findall(
        r'>\{[^}]*\}\s*</\w+>\s*<\w+[^>]*>(?:kg|lbs?|%|cm|in|min|hrs?|sessions?|days?)</\w+>',
        content,
        re.IGNORECASE,
    )
    for m in number_unit_patterns:
        # Check if parent has nowrap
        context_start = max(0, content.index(m) - 200)
        context = content[context_start:content.index(m) + len(m)]
        if "whitespace-nowrap" not in context and "nowrap" not in context:
            report.add(
                "INFO", "LAYOUT_FRAGILE",
                str(rel),
                f"数値+単位にnowrap未適用: '{m[:60]}'",
                "親要素にwhitespace-nowrap追加",
            )


def check_console_logs(filepath: Path, content: str, report: BugReport):
    """console.log残存検出"""
    rel = filepath.relative_to(APP_ROOT)

    # ロガーモジュール自体は正当な console.log 使用
    if filepath.name in ("logger.ts", "logger.tsx"):
        return

    logs = re.findall(r'console\.log\(', content)
    if logs:
        report.add(
            "INFO", "CONSOLE_LOG",
            str(rel),
            f"console.log() が {len(logs)} 件残存",
            "本番前に削除",
        )


def check_technical_leakage(filepath: Path, content: str, report: BugReport):
    """技術的内部値のUI露出"""
    rel = filepath.relative_to(APP_ROOT)

    # "84 days" のような内部ウィンドウサイズの露出
    leakage_patterns = [
        (r'"84\s*days?"', "内部ウィンドウサイズ(84日)の直接表示"),
        (r'"84month"', "テスト残骸 '84month'"),
    ]
    for pattern, desc in leakage_patterns:
        if re.search(pattern, content, re.IGNORECASE):
            report.add(
                "WARNING", "TECH_LEAKAGE",
                str(rel),
                desc,
                "直感的な表現('3 months'等)に変換",
            )


def check_hardcoded_ui_return_strings(filepath: Path, content: str, report: BugReport):
    """TypeScript関数内ハードコードUI文字列検出（JSX外の英語返り値）

    JSX スキャナでは検出できない純粋なTS関数内の英語リテラルを捕捉する。
    例: fmtAge() が return "Today" / "Yesterday" / "X days ago" を返すケース。
    """
    rel = filepath.relative_to(APP_ROOT)

    # return文内の英語UIリテラル
    return_patterns = [
        (r'return\s+"Today"', '"Today" を直接 return'),
        (r'return\s+"Yesterday"', '"Yesterday" を直接 return'),
        (r'return\s+`[^`]*\bdays? ago`', '"`X days ago`" を直接 return'),
        (r'return\s+"[^"]*\bdays? ago"', '"X days ago" を直接 return'),
        (r'return\s+"Loading\.\.\."', '"Loading..." を直接 return'),
    ]
    for pattern, desc in return_patterns:
        if re.search(pattern, content):
            report.add(
                "WARNING", "HARDCODED_UI_STRING",
                str(rel),
                f"{desc} — Intl.RelativeTimeFormat または t() キーに変更すべき",
                "Intl.RelativeTimeFormat(locale, { numeric: 'auto' }) を使用",
            )

    # JSX内の直接英語ローディング文言
    jsx_loading_patterns = [
        (r'>\s*Loading Skill Map[^<]*<', "JSX内ハードコード 'Loading Skill Map'"),
        (r'>\s*Loading\.\.\.[^<]*<', "JSX内ハードコード 'Loading...'"),
    ]
    for pattern, desc in jsx_loading_patterns:
        if re.search(pattern, content):
            report.add(
                "WARNING", "HARDCODED_UI_STRING",
                str(rel),
                desc,
                "t() キーを追加して多言語対応",
            )


def check_json_mojibake(report: BugReport):
    """JSONファイルの文字化け検出（UTF-8バイトがLatin-1として再解釈されたパターン）

    GitHub Contents API 経由での base64 push 等で発生するダブルエンコードを検出する。
    例: U+00B7 (·) → UTF-8 C2 B7 → Latin-1 Â· として保存
    """
    # (mojibake_bytes, 正しい文字, 説明)
    mojibake_patterns = [
        ("\u00c2\u00b7", "\u00b7", "Â· → · (中点 U+00B7)"),
        ("\u00c2\u00a9", "\u00a9", "Â© → © (著作権 U+00A9)"),
        ("\u00e2\u0097\u008f", "\u25cf", "â●→ ● (黒丸 U+25CF)"),
        ("\u00c3\u00a9", "é",          "Ã© → é (U+00E9)"),
        ("\u00c3\u00a0", "à",          "Ã  → à (U+00E0)"),
        ("\u00c3\u00b5", "õ",          "Ãµ → õ (U+00F5)"),
        ("\u00c3\u00a3", "ã",          "Ã£ → ã (U+00E3)"),
        ("\u00c3\u00a7", "ç",          "Ã§ → ç (U+00E7)"),
    ]

    for locale in ["en", "ja", "pt"]:
        path = MESSAGES_DIR / f"{locale}.json"
        if not path.exists():
            continue
        try:
            content = path.read_text(encoding="utf-8")
        except Exception:
            report.add(
                "CRITICAL", "JSON_MOJIBAKE",
                f"messages/{locale}.json",
                "UTF-8での読み込みに失敗（ファイルエンコーディングが不正）",
                "ファイルをUTF-8で再保存",
            )
            continue

        for mojibake, correct, desc in mojibake_patterns:
            count = content.count(mojibake)
            if count > 0:
                report.add(
                    "CRITICAL", "JSON_MOJIBAKE",
                    f"messages/{locale}.json",
                    f"{desc} が {count} 箇所 — ダブルエンコード文字化け",
                    f"Python: content = content.replace('{mojibake}', '{correct}') で修正後 Write tool で再保存",
                )


# ─────────────────────────────────────────────────────
# カテゴリ 10: 未使用 import
# ─────────────────────────────────────────────────────

# importの構文をパースしてシンボルを抽出し、ファイル本文で使われていなければ報告

def check_unused_imports(filepath: Path, content: str, report: BugReport):
    """未使用importの検出（カテゴリ10）"""
    rel = filepath.relative_to(APP_ROOT)
    lines = content.split("\n")

    # import行を収集（1行にまとめたものだけ、type-onlyは除外）
    import_re = re.compile(
        r'^\s*import\s+(?:type\s+)?'  # 'import' or 'import type'
        r'\{([^}]+)\}'               # { Name1, Name2 as Alias }
        r'\s+from\s+'
    )
    for line_no, line in enumerate(lines, 1):
        m = import_re.match(line)
        if not m:
            continue
        # import type { ... } は型のみ — tscが検出するので低優先度スキップ
        if re.match(r'^\s*import\s+type\s+', line):
            continue
        symbols_raw = m.group(1).split(",")
        for sym_raw in symbols_raw:
            sym_raw = sym_raw.strip()
            if not sym_raw:
                continue
            # 'type Foo' インラインtype修飾子は除外（tscが検出する）
            if sym_raw.startswith("type "):
                continue
            # 'Name as Alias' → Alias を使用名とする
            parts = sym_raw.split(" as ")
            used_name = parts[-1].strip()
            if not used_name or not re.match(r'^[A-Za-z_$]', used_name):
                continue
            # import行自体を除いた残りで使用されているか検索
            rest = "\n".join(lines[:line_no - 1]) + "\n".join(lines[line_no:])
            # 単語境界つきで検索（識別子として使用されているか）
            if not re.search(r'\b' + re.escape(used_name) + r'\b', rest):
                report.add(
                    "WARNING", "UNUSED_IMPORT",
                    str(rel),
                    f"L{line_no}: '{used_name}' がimport後に使用されていない",
                    f"import文から '{used_name}' を削除",
                )


# ─────────────────────────────────────────────────────
# カテゴリ 11: any 型エスケープ
# ─────────────────────────────────────────────────────

def check_any_type(filepath: Path, content: str, report: BugReport):
    """`: any` / `as any` の検出（カテゴリ11）"""
    rel = filepath.relative_to(APP_ROOT)

    # database.types.ts は自動生成なので除外
    if filepath.name == "database.types.ts":
        return
    # *.d.ts 型定義ファイルも除外
    if filepath.name.endswith(".d.ts"):
        return

    for line_no, line in enumerate(content.split("\n"), 1):
        stripped = line.strip()
        # コメント行は除外
        if stripped.startswith("//") or stripped.startswith("*") or stripped.startswith("/*"):
            continue
        # 'as any' パターン
        as_any = re.findall(r'\bas\s+any\b', line)
        for _ in as_any:
            report.add(
                "INFO", "ANY_TYPE_ESCAPE",
                str(rel),
                f"L{line_no}: `as any` 型アサーション — 適切な型に置換推奨",
                "具体的な型を定義するか、unknown + 型ガードを使用",
            )
        # ': any' パターン（関数引数・変数宣言）
        colon_any = re.findall(r':\s*any\b(?!\s*\[)', line)
        for _ in colon_any:
            # 'as any' と重複カウントしない
            if 'as any' not in line or ': any' in line.replace('as any', ''):
                report.add(
                    "INFO", "ANY_TYPE_ESCAPE",
                    str(rel),
                    f"L{line_no}: `: any` 型注釈 — 具体的な型に置換推奨",
                    "Record<string, unknown> や具体的な型を使用",
                )


# ─────────────────────────────────────────────────────
# カテゴリ 12: アクセシビリティ欠損
# ─────────────────────────────────────────────────────

def check_accessibility(filepath: Path, content: str, report: BugReport):
    """アイコンonlyボタン/リンクのaria-label欠損、img alt欠損（カテゴリ12）"""
    rel = filepath.relative_to(APP_ROOT)

    # <img> without alt — マルチラインの <img ... /> に対応
    # コメント・docstring内のタグは除外
    content_no_comments = re.sub(r'/\*\*?.*?\*/', '', content, flags=re.DOTALL)
    content_no_comments = re.sub(r'//.*$', '', content_no_comments, flags=re.MULTILINE)
    img_blocks = re.finditer(r'<img\b', content_no_comments)
    for m_img in img_blocks:
        start = m_img.start()
        # 閉じ > or /> を探す（最大500文字先まで）
        chunk = content_no_comments[start:start + 500]
        close = re.search(r'/?\s*>', chunk)
        if not close:
            continue
        tag_text = chunk[:close.end()]
        if 'alt=' not in tag_text and 'alt =' not in tag_text:
            report.add(
                "WARNING", "A11Y_IMG_NO_ALT",
                str(rel),
                f"<img> に alt 属性がない: '{tag_text[:80]}'",
                'alt="" (装飾) または alt="説明" を追加',
            )

    # アイコンonlyボタン: <button> の中身がテキストを含まず、aria-labelもない
    # ボタンの開始から </button> までの全体を確認し、テキストノードやsr-onlyが
    # 含まれていなければ報告する
    icon_btn_re = re.compile(
        r'<button\b([^>]*)>'       # <button ...>
        r'\s*'
        r'(<(?:svg|img)\b)'        # 直後が svg/img
    , re.DOTALL)
    for m in icon_btn_re.finditer(content):
        attrs = m.group(1)
        if 'aria-label' in attrs or 'aria-labelledby' in attrs:
            continue
        # ボタンの終了タグまでの全内容を取得（最大500文字先まで）
        btn_body = content[m.start():m.start()+500]
        close_idx = btn_body.find('</button>')
        if close_idx < 0:
            continue
        btn_inner = btn_body[btn_body.index('>') + 1:close_idx]
        # sr-only span があればスクリーンリーダーに読まれる → OK
        if 'sr-only' in btn_inner:
            continue
        # テキストノード（英語・日本語・{t(...)})があれば OK
        # SVG内部のタグテキストを除外するため、SVGブロックを除去してからチェック
        no_svg = re.sub(r'<svg\b[^>]*>.*?</svg>', '', btn_inner, flags=re.DOTALL)
        if re.search(r'>[A-Za-z\u3040-\u9FFF]', no_svg) or re.search(r'\{t\(', no_svg):
            continue
        report.add(
            "WARNING", "A11Y_ICON_BUTTON",
            str(rel),
            f"アイコンのみのbuttonにaria-label欠損: '{m.group(0)[:80]}'",
            'aria-label="操作名" を追加',
        )


# ─────────────────────────────────────────────────────
# カテゴリ 13: dangerouslySetInnerHTML
# ─────────────────────────────────────────────────────

def check_dangerous_html(filepath: Path, content: str, report: BugReport):
    """dangerouslySetInnerHTML の使用を検出（カテゴリ13）"""
    rel = filepath.relative_to(APP_ROOT)

    for line_no, line in enumerate(content.split("\n"), 1):
        if "dangerouslySetInnerHTML" in line:
            report.add(
                "INFO", "DANGEROUS_HTML",
                str(rel),
                f"L{line_no}: dangerouslySetInnerHTML 使用 — XSSリスク確認済みか要チェック",
                "DOMPurify等でサニタイズ済みか確認。ユーザー入力を直接渡していないか検証",
            )


# ─────────────────────────────────────────────────────
# カテゴリ 14: クライアントコードの秘密env直参照
# ─────────────────────────────────────────────────────

def check_secret_env_in_client(filepath: Path, content: str, report: BugReport):
    """クライアントコンポーネントからの秘密env直参照を検出（カテゴリ14）

    "use client" ディレクティブがあるファイルで、
    NEXT_PUBLIC_ プレフィックスのない process.env.XXX を参照していたら警告。
    サーバー専用ファイル（api/, middleware, server component）は除外。
    """
    rel = filepath.relative_to(APP_ROOT)

    # "use client" がないファイルはサーバーコンポーネント → 正当な参照
    if '"use client"' not in content and "'use client'" not in content:
        return
    # API routeは除外
    if "/api/" in str(filepath):
        return

    for line_no, line in enumerate(content.split("\n"), 1):
        stripped = line.strip()
        if stripped.startswith("//") or stripped.startswith("*"):
            continue
        env_refs = re.findall(r'process\.env\.([A-Z_]+)', line)
        # Next.js / Vercel が自動的にインライン化する安全な変数
        SAFE_CLIENT_ENV = {"NODE_ENV", "VERCEL_ENV", "VERCEL_URL", "VERCEL"}
        for env_name in env_refs:
            if env_name in SAFE_CLIENT_ENV:
                continue
            if env_name.startswith("NEXT_PUBLIC_"):
                continue
            report.add(
                "CRITICAL", "SECRET_ENV_CLIENT",
                str(rel),
                f"L{line_no}: クライアントコードから process.env.{env_name} を参照 — ビルド時にundefinedになるか秘密漏洩のリスク",
                f"NEXT_PUBLIC_ プレフィックスを付けるか、サーバーAPI経由に変更",
            )


# ─────────────────────────────────────────────────────
# カテゴリ 15: TODO/FIXME/HACK コメント残存
# ─────────────────────────────────────────────────────

def check_todo_comments(filepath: Path, content: str, report: BugReport):
    """TODO/FIXME/HACK コメントの残存検出（カテゴリ15）"""
    rel = filepath.relative_to(APP_ROOT)

    # 自動生成ファイルは除外
    if filepath.name in ("database.types.ts",) or filepath.name.endswith(".d.ts"):
        return

    for line_no, line in enumerate(content.split("\n"), 1):
        m = re.search(r'\b(TODO|FIXME|HACK|XXX)\b[:\s]*(.*)', line)
        if m:
            tag = m.group(1)
            desc = m.group(2).strip()[:60]
            severity = "WARNING" if tag in ("FIXME", "HACK", "XXX") else "INFO"
            report.add(
                severity, "TODO_COMMENT",
                str(rel),
                f"L{line_no}: {tag}: {desc}",
                "修正済みなら削除、未着手ならBACKLOGへ移動",
            )


# ─────────────────────────────────────────────────────
# カテゴリ 16: 未使用exportコンポーネント（デッドコード）
# ─────────────────────────────────────────────────────

def check_unused_exports(all_files: list[Path], report: BugReport):
    """exportされたコンポーネント/関数がどこからもimportされていないかチェック（カテゴリ16）

    components/ 配下のファイルが対象。app/ や lib/ はページルートや
    ユーティリティなので除外。
    """
    # 全ファイルの内容を読み込み
    contents: dict[str, str] = {}
    for f in all_files:
        try:
            contents[str(f)] = f.read_text("utf-8")
        except Exception:
            continue

    # components/ のexportを収集
    comp_dir = str(APP_ROOT / "components")
    exports: list[tuple[str, str, str]] = []  # (name, filepath, rel)
    for fpath_str, content in contents.items():
        if not fpath_str.startswith(comp_dir):
            continue
        fpath = Path(fpath_str)
        rel = str(fpath.relative_to(APP_ROOT))
        for m in re.finditer(r'export\s+(?:default\s+)?(?:function|const|class)\s+(\w+)', content):
            exports.append((m.group(1), fpath_str, rel))

    for name, source, rel in exports:
        found = False
        for fpath_str, content in contents.items():
            if fpath_str == source:
                continue
            if re.search(r'\b' + re.escape(name) + r'\b', content):
                found = True
                break
        if not found:
            report.add(
                "INFO", "UNUSED_EXPORT",
                rel,
                f"export '{name}' がどこからもimportされていない — デッドコードの可能性",
                f"使用予定がなければファイルごと削除。将来用ならBACKLOG記載",
            )


# ─────────────────────────────────────────────────────
# カテゴリ 17: Supabase query の error 未ハンドリング
# ─────────────────────────────────────────────────────

def check_supabase_error_handling(filepath: Path, content: str, report: BugReport):
    """Supabase queryの戻り値で error を destructure していないケースを検出（カテゴリ17）

    パターン:
      const { data } = await supabase     ← destructで error がない
        .from("table")                     ← .from は次の行
        .select(...)
    """
    rel = filepath.relative_to(APP_ROOT)

    # supabase の .from() 呼び出しを検出（複数行にまたがるケース対応）
    # const { data } = await supabase\n  .from(...) パターン
    for m in re.finditer(
        r'(?:const|let)\s*\{([^}]*)\}\s*=\s*await\s+\w*supabase\w*[\s\S]*?\.from\s*\(',
        content,
    ):
        destructured = m.group(1)
        if "data" in destructured and "error" not in destructured:
            line_no = content[:m.start()].count("\n") + 1
            report.add(
                "INFO", "SUPABASE_NO_ERROR",
                str(rel),
                f"L{line_no}: Supabase query の戻り値で error を無視 — サイレント失敗リスク",
                "const { data, error } = ... に変更し、error 時のフォールバックを追加",
            )


# ─────────────────────────────────────────────────────
# カテゴリ 18: Promise .then() without .catch()
# ─────────────────────────────────────────────────────

def check_promise_no_catch(filepath: Path, content: str, report: BugReport):
    """Promise .then() が .catch() なしで使われているケースを検出（カテゴリ18）

    `.then(` を見つけたら、同一チェーン内（10行先まで）に `.catch(` があるか確認。
    await 式は対象外（try-catch で囲まれるべきだが別カテゴリ）。
    """
    rel = filepath.relative_to(APP_ROOT)
    lines = content.split("\n")

    for line_no, line in enumerate(lines, 1):
        stripped = line.strip()
        # コメント行は除外
        if stripped.startswith("//") or stripped.startswith("*") or stripped.startswith("/*"):
            continue
        if ".then(" not in line:
            continue
        # await と組み合わせてる場合は対象外
        if "await " in line:
            continue
        # req.json().catch(() => null) は API route の意図的パターン → 除外
        if "req.json()" in line or "request.json()" in line:
            continue

        # 同一チェーン内（現在行〜10行先）に .catch( があるか探索
        chain_window = "\n".join(lines[line_no - 1:line_no + 9])
        if ".catch(" in chain_window:
            continue

        # テストファイルは除外
        if "__tests__" in str(filepath) or ".test." in filepath.name or ".spec." in filepath.name:
            continue

        report.add(
            "WARNING", "PROMISE_NO_CATCH",
            str(rel),
            f"L{line_no}: .then() に .catch() がない — エラー時サイレント失敗",
            ".catch((err) => console.error(err)) を追加、または async/await + try-catch に変更",
        )


# ─────────────────────────────────────────────────────
# カテゴリ 19: ゾンビファイル（空・DEPRECATED）
# ─────────────────────────────────────────────────────

def check_zombie_files(all_files: list[Path], report: BugReport):
    """components/ 配下で中身が空または DEPRECATED コメントのみのファイルを検出（カテゴリ19）"""
    comp_dir = str(APP_ROOT / "components")

    for fpath in all_files:
        if not str(fpath).startswith(comp_dir):
            continue
        try:
            content = fpath.read_text("utf-8")
        except Exception:
            continue

        # 実質的なコード行数（空行・コメント行を除く）
        code_lines = [
            l for l in content.split("\n")
            if l.strip() and not l.strip().startswith("//") and not l.strip().startswith("/*") and not l.strip().startswith("*")
        ]

        if len(code_lines) <= 1:
            rel = str(fpath.relative_to(APP_ROOT))
            report.add(
                "WARNING", "ZOMBIE_FILE",
                rel,
                f"実質コード {len(code_lines)} 行 — 空ファイルまたは DEPRECATED コメントのみ",
                "git rm で完全削除。再発防止は Q-1 カテゴリ19 で自動検知",
            )


# ─────────────────────────────────────────────────────
# カテゴリ 20: .catch(() => {}) サイレントエラー握りつぶし
# ─────────────────────────────────────────────────────

def check_silent_catch(filepath: Path, content: str, report: BugReport):
    """空の .catch() ハンドラを検出（カテゴリ20）

    .catch(() => {}) / .catch(() => null) / .catch(()=>{}) のパターン。
    エラーを完全に握りつぶしてデバッグ不能になるリスク。
    """
    rel = filepath.relative_to(APP_ROOT)

    # テストファイルは除外
    if "__tests__" in str(filepath) or ".test." in filepath.name or ".spec." in filepath.name:
        return

    # 空catch パターン: .catch(() => {}) / .catch(() => null) / .catch(e => {})
    patterns = [
        r'\.catch\s*\(\s*\(\s*\w*\s*\)\s*=>\s*\{\s*\}\s*\)',    # .catch(() => {})
        r'\.catch\s*\(\s*\(\s*\w*\s*\)\s*=>\s*null\s*\)',        # .catch(() => null)
        r'\.catch\s*\(\s*\(\s*\)\s*=>\s*\{\s*\}\s*\)',           # .catch(() => {})
        r'\.catch\s*\(\s*\(\s*\)\s*=>\s*undefined\s*\)',          # .catch(() => undefined)
    ]

    # コメント付き catch は意図的 → 除外パターン
    # 例: .catch(() => {/* clipboard not available */})
    comment_in_catch = re.compile(r'\.catch\s*\(\s*\(\s*\w*\s*\)\s*=>\s*\{\s*/\*.*?\*/\s*\}\s*\)')

    for line_no, line in enumerate(content.split("\n"), 1):
        stripped = line.strip()
        if stripped.startswith("//") or stripped.startswith("*"):
            continue
        # コメント付き catch は意図的と判断しスキップ
        if comment_in_catch.search(line):
            continue
        for pattern in patterns:
            if re.search(pattern, line):
                report.add(
                    "WARNING", "SILENT_CATCH",
                    str(rel),
                    f"L{line_no}: .catch() がエラーを握りつぶしている — デバッグ不能",
                    ".catch((err) => console.error('context:', err)) に変更",
                )
                break  # 1行で複数マッチしても1件だけ報告


# ─────────────────────────────────────────────────────
# カテゴリ 21: Missing error.tsx（Error Boundary）
# ─────────────────────────────────────────────────────

def check_missing_error_boundary(report: BugReport):
    """app/ 配下で page.tsx があるが error.tsx がないルートを検出（カテゴリ21）

    Next.js の Error Boundary はバブリングするため、
    親ディレクトリに error.tsx があれば子ルートはスキップする。
    """
    if not APP_DIR.exists():
        return

    # app/ 配下の全 page.tsx を探索
    for page_file in APP_DIR.rglob("page.tsx"):
        route_dir = page_file.parent

        # 自分自身のディレクトリに error.tsx があるか
        if (route_dir / "error.tsx").exists():
            continue

        # 親ディレクトリをたどって error.tsx があるかチェック（バブリング）
        found_parent_error = False
        check_dir = route_dir.parent
        while check_dir != APP_ROOT and str(check_dir).startswith(str(APP_DIR)):
            if (check_dir / "error.tsx").exists():
                found_parent_error = True
                break
            check_dir = check_dir.parent

        if found_parent_error:
            continue

        # global-error.tsx は別枠（root layout のエラー用）
        if (APP_DIR / "global-error.tsx").exists() and route_dir == APP_DIR:
            continue

        rel = str(route_dir.relative_to(APP_ROOT))
        # 静的ページ（SSG系）は低リスクだが報告はする
        report.add(
            "INFO", "MISSING_ERROR_BOUNDARY",
            rel,
            "error.tsx が存在しない — エラー時にグローバルエラーハンドラにフォールバック",
            f"{rel}/error.tsx を作成。最低限 'use client' + エラーメッセージ + リトライボタン",
        )


# ─────────────────────────────────────────────────────
# カテゴリ 22: Missing loading.tsx（Suspense）
# ─────────────────────────────────────────────────────

# データフェッチがないstatic routeは除外（偽陽性抑制）
STATIC_ROUTES = {
    "account-deleted", "privacy", "terms", "legal", "help",
}

def check_missing_loading(report: BugReport):
    """app/ 配下で page.tsx があるが loading.tsx がないルートを検出（カテゴリ22）

    静的ページ（STATIC_ROUTES）は除外。
    親ディレクトリに loading.tsx があれば子ルートもスキップ。
    """
    if not APP_DIR.exists():
        return

    for page_file in APP_DIR.rglob("page.tsx"):
        route_dir = page_file.parent

        # 静的ルート除外
        route_name = route_dir.name
        if route_name in STATIC_ROUTES:
            continue
        # legal/tokushoho 等の子ルートも除外
        if any(part in STATIC_ROUTES for part in route_dir.relative_to(APP_DIR).parts):
            continue

        # 自分自身のディレクトリに loading.tsx があるか
        if (route_dir / "loading.tsx").exists():
            continue

        # 親ディレクトリのバブリングチェック
        found_parent_loading = False
        check_dir = route_dir.parent
        while check_dir != APP_ROOT and str(check_dir).startswith(str(APP_DIR)):
            if (check_dir / "loading.tsx").exists():
                found_parent_loading = True
                break
            check_dir = check_dir.parent

        if found_parent_loading:
            continue

        # root (app/) 自体は layout.tsx にローディングがあるかもしれないのでスキップ
        if route_dir == APP_DIR:
            continue

        rel = str(route_dir.relative_to(APP_ROOT))
        report.add(
            "INFO", "MISSING_LOADING",
            rel,
            "loading.tsx が存在しない — ページ遷移時にローディングUIなし",
            f"{rel}/loading.tsx を作成。Skeleton or スピナーで CLS を防止",
        )


# ─────────────────────────────────────────────────────
# メインスキャナ
# ─────────────────────────────────────────────────────

def scan_all() -> BugReport:
    report = BugReport()

    # i18n チェック
    check_i18n_coverage(report)

    # JSONファイル文字化けチェック（カテゴリ8）
    check_json_mojibake(report)

    # TS/TSX スキャン
    source_files = find_source_files()
    tsx_files = [f for f in source_files if f.suffix == ".tsx"]
    for fpath in source_files:
        try:
            content = fpath.read_text(encoding="utf-8")
        except Exception:
            continue

        is_tsx = fpath.suffix == ".tsx"

        # TSX専用チェック（カテゴリ 2-6, 9）
        if is_tsx:
            check_hardcoded_strings(fpath, content, report)
            check_mock_data(fpath, content, report)
            check_comment_out_remnants(fpath, content, report)
            check_layout_fragility(fpath, content, report)
            check_technical_leakage(fpath, content, report)
            check_hardcoded_ui_return_strings(fpath, content, report)
            check_accessibility(fpath, content, report)       # カテゴリ12
            check_dangerous_html(fpath, content, report)      # カテゴリ13

        # TS/TSX共通チェック（カテゴリ 7, 10-11, 14-15, 17-18, 20）
        check_console_logs(fpath, content, report)
        check_unused_imports(fpath, content, report)          # カテゴリ10
        check_any_type(fpath, content, report)                # カテゴリ11
        check_secret_env_in_client(fpath, content, report)    # カテゴリ14
        check_todo_comments(fpath, content, report)           # カテゴリ15
        check_supabase_error_handling(fpath, content, report) # カテゴリ17
        check_promise_no_catch(fpath, content, report)        # カテゴリ18
        check_silent_catch(fpath, content, report)            # カテゴリ20

    # ファイル横断チェック（カテゴリ16, 19）
    check_unused_exports(source_files, report)
    check_zombie_files(source_files, report)                  # カテゴリ19

    # app/ 構造チェック（カテゴリ21-22）
    check_missing_error_boundary(report)                      # カテゴリ21
    check_missing_loading(report)                             # カテゴリ22

    return report, len(source_files)


# ─────────────────────────────────────────────────────
# 出力
# ─────────────────────────────────────────────────────

SEVERITY_COLORS = {
    "CRITICAL": "\033[91m",
    "WARNING": "\033[93m",
    "INFO": "\033[94m",
    "ERROR": "\033[95m",
}
RESET = "\033[0m"


def print_report(report: BugReport, total_files: int, fix_hint: bool = False):
    crit = report.count("CRITICAL")
    warn = report.count("WARNING")
    info = report.count("INFO")

    print(f"\n{'='*60}")
    print(f"🔍 BJJ App Hidden Bug Detector — スキャン結果")
    print(f"{'='*60}")
    print(f"  TS/TSXスキャン対象: {total_files} ファイル")
    print(f"  🔴 CRITICAL: {crit}")
    print(f"  🟡 WARNING:  {warn}")
    print(f"  🔵 INFO:     {info}")
    print(f"  合計: {report.count()} 件")

    if report.count() == 0:
        print(f"\n  ✅ 隠れバグなし！全ファイルクリーン。")
        print(f"{'='*60}\n")
        return

    categories = defaultdict(list)
    for sev, cat, fpath, detail, hint in report.bugs:
        categories[cat].append((sev, fpath, detail, hint))

    for cat, items in sorted(categories.items()):
        print(f"\n  📂 {cat} ({len(items)} 件)")
        print(f"  {'─'*50}")
        shown = items[:10]
        for sev, fpath, detail, hint in shown:
            color = SEVERITY_COLORS.get(sev, "")
            print(f"    {color}[{sev}]{RESET} {fpath}")
            print(f"           {detail}")
            if fix_hint and hint:
                print(f"           💡 {hint}")
        if len(items) > 10:
            print(f"    ... 他 {len(items) - 10} 件")

    print(f"\n{'='*60}\n")


def write_report_file(report: BugReport, total_files: int):
    report_path = APP_ROOT / "hidden_bugs_report.txt"
    lines = [
        "BJJ App Hidden Bug Detector Report",
        f"TS/TSX Scanned: {total_files} files",
        f"CRITICAL: {report.count('CRITICAL')}",
        f"WARNING: {report.count('WARNING')}",
        f"INFO: {report.count('INFO')}",
        f"Total: {report.count()}",
        "",
    ]
    for sev, cat, fpath, detail, hint in report.bugs:
        lines.append(f"[{sev}] [{cat}] {fpath}: {detail}")
        if hint:
            lines.append(f"  FIX: {hint}")

    report_path.write_text("\n".join(lines), encoding="utf-8")
    print(f"📄 レポート保存: {report_path}")


def main():
    parser = argparse.ArgumentParser(description="BJJ App Hidden Bug Detector")
    parser.add_argument("--fix-hint", action="store_true", help="修正ヒント付き出力")
    parser.add_argument("--ci", action="store_true", help="CI用（exitcode=CRITICAL数）")
    args = parser.parse_args()

    report, total_files = scan_all()
    print_report(report, total_files, args.fix_hint)
    write_report_file(report, total_files)

    if args.ci:
        sys.exit(report.count("CRITICAL"))


if __name__ == "__main__":
    main()
