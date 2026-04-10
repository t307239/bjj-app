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
TSX_DIRS = [APP_DIR, COMPONENTS_DIR]


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

def find_tsx_files() -> list[Path]:
    """app/ と components/ 配下の全TSXファイルを取得"""
    files = []
    for d in TSX_DIRS:
        if d.exists():
            files.extend(d.rglob("*.tsx"))
    return sorted(files)


def check_hardcoded_strings(filepath: Path, content: str, report: BugReport):
    """ハードコード文字列の検出（JSX内の日英混在テキスト）"""
    rel = filepath.relative_to(APP_ROOT)

    # JSXコメント除去してからスキャン
    content_no_comments = re.sub(r'\{/\*.*?\*/\}', '', content, flags=re.DOTALL)
    # // コメント行も除去
    content_no_comments = re.sub(r'//.*$', '', content_no_comments, flags=re.MULTILINE)

    # 日英混在ハードコード: "Weight(体重)" パターン
    mixed_patterns = [
        (r'>[A-Za-z]+\([^)]*[\u3040-\u9FFF]+[^)]*\)<', "日英混在テキスト"),
        (r'>[^<]*[\u3040-\u9FFF]+[^<]*[A-Za-z]{3,}[^<]*<', "多言語混在（JAの中に英語）"),
    ]
    for pattern, desc in mixed_patterns:
        matches = re.findall(pattern, content_no_comments)
        for m in matches:
            if len(m) > 100:
                continue
            report.add(
                "WARNING", "HARDCODED_MIXED",
                str(rel),
                f"{desc}: '{m[:60]}'",
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
# メインスキャナ
# ─────────────────────────────────────────────────────

def scan_all() -> BugReport:
    report = BugReport()

    # i18n チェック
    check_i18n_coverage(report)

    # JSONファイル文字化けチェック（カテゴリ8）
    check_json_mojibake(report)

    # TSX スキャン
    tsx_files = find_tsx_files()
    for fpath in tsx_files:
        try:
            content = fpath.read_text(encoding="utf-8")
        except Exception:
            continue

        check_hardcoded_strings(fpath, content, report)
        check_mock_data(fpath, content, report)
        check_comment_out_remnants(fpath, content, report)
        check_layout_fragility(fpath, content, report)
        check_console_logs(fpath, content, report)
        check_technical_leakage(fpath, content, report)
        check_hardcoded_ui_return_strings(fpath, content, report)  # カテゴリ9

    return report, len(tsx_files)


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
    print(f"  TSXスキャン対象: {total_files} ファイル")
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
        f"TSX Scanned: {total_files} files",
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
