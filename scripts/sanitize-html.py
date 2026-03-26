#!/usr/bin/env python3
"""
BJJ Wiki — HTML sanitizer
wiki_translations.content_html を一括クリーンアップする。

洗浄内容:
  1. <script> タグを全削除
  2. ニュースレター要素 (#float-cta, [href*="beehiiv.com"] を含む要素) を削除
  3. Amazon など外部アフィリエイトリンクの <a> タグを unwrap（テキストは残す）
  4. <nav aria-label="Technique navigation"> + Prev/Next ボタンを削除
  5. 全タグの style 属性を剥奪

設定:
  - バッチサイズ: 50件
  - バッチ間スリープ: 1000ms
"""

import os
import re
import sys
import time
import json
import urllib.request
import urllib.parse
from pathlib import Path
from bs4 import BeautifulSoup


# ─────────────────────────────────────────
# 環境変数の読み込み (.env.local)
# ─────────────────────────────────────────

def load_env(env_path: str) -> dict:
    env = {}
    try:
        with open(env_path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" in line:
                    k, v = line.split("=", 1)
                    env[k.strip()] = v.strip().strip('"').strip("'")
    except FileNotFoundError:
        pass
    return env


script_dir = Path(__file__).parent
env_path = script_dir.parent / ".env.local"
env = load_env(str(env_path))

SUPABASE_URL = env.get("NEXT_PUBLIC_SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
SERVICE_ROLE_KEY = env.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

if not SUPABASE_URL or not SERVICE_ROLE_KEY:
    print("❌ SUPABASE_URL または SUPABASE_SERVICE_ROLE_KEY が見つかりません")
    sys.exit(1)

HEADERS = {
    "apikey": SERVICE_ROLE_KEY,
    "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal",
}

BATCH_SIZE = 50
SLEEP_MS = 1000

# アフィリエイト / 外部誘導リンクのドメイン（unwrap対象）
AFFILIATE_DOMAINS = [
    "amazon.com", "amazon.co.jp", "amzn.to",
    "ebay.com", "rakuten.com",
    "shareasale.com", "impact.com", "linksynergy.com",
    "beehiiv.com",
]


# ─────────────────────────────────────────
# Supabase REST ヘルパー
# ─────────────────────────────────────────

def supabase_get(path: str, params: dict = None) -> list:
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    if params:
        url += "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8"))


def supabase_patch(path: str, row_id: int, body: dict) -> None:
    url = f"{SUPABASE_URL}/rest/v1/{path}?id=eq.{row_id}"
    data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=HEADERS, method="PATCH")
    with urllib.request.urlopen(req) as resp:
        _ = resp.read()


# ─────────────────────────────────────────
# HTML 洗浄ロジック
# ─────────────────────────────────────────

def is_affiliate_href(href: str) -> bool:
    if not href:
        return False
    return any(domain in href for domain in AFFILIATE_DOMAINS)


def sanitize(html: str) -> str:
    if not html:
        return html

    soup = BeautifulSoup(html, "lxml")

    # 1. <script> タグを全削除
    for tag in soup.find_all("script"):
        tag.decompose()

    # 2a. #float-cta 要素を削除
    for tag in soup.find_all(id="float-cta"):
        tag.decompose()

    # 2b. beehiiv.com へのリンクを含む要素を削除（親要素ごと）
    for a in soup.find_all("a", href=True):
        if "beehiiv.com" in (a.get("href") or ""):
            # 親がブロック要素（div/section/p/aside）なら親ごと削除
            parent = a.parent
            if parent and parent.name in {"div", "section", "aside", "p", "blockquote"}:
                parent.decompose()
            else:
                a.decompose()

    # 3. アフィリエイト / Amazon リンクを unwrap（<a>タグ除去、テキスト保持）
    for a in soup.find_all("a", href=True):
        if is_affiliate_href(a.get("href", "")):
            a.unwrap()

    # 4a. <nav aria-label="Technique navigation"> を削除
    for nav in soup.find_all("nav"):
        aria = nav.get("aria-label", "")
        if "technique navigation" in aria.lower() or "navigation" in aria.lower():
            nav.decompose()

    # 4b. Prev / Next ボタン（a or button タグ）を削除
    for tag in soup.find_all(["a", "button"]):
        text = tag.get_text(strip=True).lower()
        if text in {"prev", "previous", "next", "← prev", "next →", "← previous", "next article →"}:
            # 親が nav 系なら親ごと削除
            parent = tag.parent
            if parent and parent.name in {"nav", "div", "p"}:
                parent.decompose()
            else:
                tag.decompose()

    # 5. 全タグの style 属性を剥奪
    for tag in soup.find_all(True):
        if tag.has_attr("style"):
            del tag["style"]

    # body 内容だけを返す（lxml は <html><body>...</body></html> を追加するため）
    body = soup.find("body")
    if body:
        return "".join(str(c) for c in body.children)
    return str(soup)


# ─────────────────────────────────────────
# メイン処理
# ─────────────────────────────────────────

def main():
    print("🔍 wiki_translations の全件数を取得中...")

    # COUNT 取得
    url = f"{SUPABASE_URL}/rest/v1/wiki_translations?select=id&limit=1"
    req = urllib.request.Request(url, headers={**HEADERS, "Prefer": "count=exact", "Range": "0-0"})
    with urllib.request.urlopen(req) as resp:
        content_range = resp.headers.get("Content-Range", "0/0")
        total = int(content_range.split("/")[-1]) if "/" in content_range else 0

    print(f"📄 合計 {total} 件")

    offset = 0
    updated_count = 0
    skipped_count = 0
    error_count = 0
    batch_num = 0

    while offset < total:
        batch_num += 1
        rows = supabase_get(
            "wiki_translations",
            {
                "select": "id,content_html",
                "order": "id.asc",
                "limit": BATCH_SIZE,
                "offset": offset,
            },
        )

        if not rows:
            break

        print(f"\n📦 Batch {batch_num}: offset={offset} / {total} ({len(rows)}件)")

        for row in rows:
            row_id = row["id"]
            original = row.get("content_html") or ""

            if not original.strip():
                skipped_count += 1
                continue

            cleaned = sanitize(original)

            if cleaned == original:
                skipped_count += 1
                continue

            try:
                supabase_patch("wiki_translations", row_id, {"content_html": cleaned})
                updated_count += 1
                print(f"  ✅ id={row_id} updated ({len(original)} → {len(cleaned)} chars)")
            except Exception as e:
                error_count += 1
                print(f"  ❌ id={row_id} error: {e}")

        offset += BATCH_SIZE

        if offset < total:
            time.sleep(SLEEP_MS / 1000)

    print(f"\n{'='*50}")
    print(f"✅ 完了: {updated_count} 件更新 / {skipped_count} 件スキップ / {error_count} 件エラー")
    print(f"{'='*50}")


if __name__ == "__main__":
    main()
