#!/usr/bin/env python3
"""
translate_wiki_db_titles.py — z255f cont: wiki_translations DB の英語残タイトル/desc を
Gemini で JA / PT に batch 翻訳し UPDATE。

【経緯】
z255f で wiki_translations.title/description の HTML/dual prefix/duplicate word を
SQL cleanup したが、JA で 568 件の title が英語のまま残っていた:
  - pure_english_no_prefix: 112 件 (e.g., "ADCC Rules Complete Guide")
  - bjj_prefix_then_english: 456 件 (e.g., "【BJJ】2-on-1 Arm Control System")

【設計】
- 1 row ずつ Gemini で翻訳 → UPDATE
- 【BJJ】 prefix は保持 (JA SEO 慣例)
- BJJ 専門用語はカタカナ化 (アームバー、ガード、サブミッション 等)
- Idempotent: 既に JA chars 含むものは skip
- Rate limit: 1 sec/call (Gemini free tier)
- Cost: ~$0.30 for 568 ja + 同程度の pt

【入力 / 出力】
- Supabase wiki_translations.title (UPDATE in place)
- Supabase wiki_translations.description (オプション、--include-desc flag)

Usage:
  python3 scripts/translate_wiki_db_titles.py --dry-run --lang ja --limit 5
  python3 scripts/translate_wiki_db_titles.py --apply --lang ja
  python3 scripts/translate_wiki_db_titles.py --apply --lang pt --include-desc
"""
from __future__ import annotations
import os
import sys
import re
import time
import json
import argparse
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
RATE_LIMIT_SLEEP = 1.0


def import_gemini():
    try:
        import google.generativeai as genai
        return genai
    except ImportError:
        print("❌ google-generativeai 未 install")
        sys.exit(1)


def import_supabase():
    try:
        from supabase import create_client
        return create_client
    except ImportError:
        print("❌ supabase-py 未 install。pip install supabase --break-system-packages")
        sys.exit(1)


def load_api_key(name: str) -> str:
    val = os.environ.get(name, "")
    if val:
        return val
    for p in [REPO.parent / "bjj-wiki" / ".env", REPO / ".env", Path.home() / ".secrets"]:
        if p.exists():
            for line in p.read_text().splitlines():
                if line.startswith(f"{name}="):
                    return line.split("=", 1)[1].strip().strip('"').strip("'")
    return ""


def gemini_translate_title(genai, title: str, target_lang: str) -> str | None:
    """1 タイトルを翻訳。【BJJ】 prefix 保持 + BJJ 用語の現地語化."""
    if target_lang == "ja":
        instr = """日本語に翻訳。BJJ 専門用語はカタカナ統一 (Armbar→アームバー、Guard→ガード、Pass→パス、Sweep→スイープ、Submission→サブミッション、Mount→マウント、Side Control→サイドコントロール、Back Control→バック、Half Guard→ハーフガード、Triangle→トライアングルチョーク、Kimura→キムラ、Heel Hook→ヒールフック、Rear Naked Choke→リアネイキッドチョーク、Ankle Lock→アンクルロック、Setup→セットアップ、Drill→ドリル、Sprawl→スプロール、Takedown→テイクダウン、Escape→エスケープ等)。
人名/組織名 (Andre Galvao, Marcelo Garcia, Gordon Ryan, ADCC, IBJJF 等) は英語のまま保持。【BJJ】 prefix があればそのまま保持して残りを翻訳。"""
        sample = "【BJJ】2-on-1 Arm Control System → 【BJJ】2on1 アームコントロールシステム / ADCC Rules Complete Guide → ADCC ルール完全ガイド / Triangle From Guard → ガードからのトライアングルチョーク"
    else:  # pt
        instr = """Brazilian Portuguese (PT-BR) に翻訳。BJJ 専門用語は PT BJJ コミュニティの慣例 (Armbar→Armlock or Chave de Braço, Guard→Guarda, Pass→Passagem, Sweep→Raspagem, Submission→Finalização, Mount→Montada, Back Control→Costas, Triangle→Triângulo, Kimura→Kimura, Heel Hook→Heel Hook, Rear Naked Choke→Mata-Leão 等)。
人名/組織名は英語のまま保持。"""
        sample = "2-on-1 Arm Control System → Sistema de Controle de Braço 2-on-1 / ADCC Rules Complete Guide → Guia Completo das Regras do ADCC"

    prompt = f"""{instr}

例: {sample}

入力: {title}

出力 ONLY 翻訳済タイトル (説明や引用符不要):"""

    try:
        api_key = load_api_key("GEMINI_API_KEY")
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("gemini-2.5-flash-lite")
        resp = model.generate_content(prompt)
        translated = resp.text.strip().strip('"').strip("'")
        # safety check: 結果が空または異常に長い (元の 3 倍 +20) なら NG
        if not translated or len(translated) > len(title) * 3 + 50:
            return None
        return translated
    except Exception as e:
        print(f"  ⚠️ Gemini error: {e}")
        return None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--lang", choices=["ja", "pt"], required=True)
    ap.add_argument("--limit", type=int, default=10000)
    ap.add_argument("--include-desc", action="store_true",
                    help="title に加えて description も翻訳")
    args = ap.parse_args()

    do_write = args.apply
    if not do_write and not args.dry_run:
        do_write = False

    sb_url = load_api_key("SUPABASE_URL") or load_api_key("NEXT_PUBLIC_SUPABASE_URL")
    sb_key = load_api_key("SUPABASE_SERVICE_ROLE_KEY") or load_api_key("SUPABASE_SECRET_KEY")
    if not sb_url or not sb_key:
        print("❌ SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY を .env にセット")
        sys.exit(1)

    create_client = import_supabase()
    sb = create_client(sb_url, sb_key)

    genai = import_gemini()

    # 英語のままの row を fetch (JA chars 含まず)
    # PostgreSQL regex: !~ '[぀-ヿ一-龯]' で JA 文字なし判定
    if args.lang == "ja":
        # JA: 漢字・ひらがな・カタカナ含まないものは英語残り
        en_filter_sql = "title !~ '[\\u3040-\\u30ff\\u4e00-\\u9fff]'"
    else:
        # PT: アクセント文字 (ã/ç/é等) も marker word も含まない場合は英語残り
        en_filter_sql = "title !~ '[ãâáàçéêíóôõúÃÂÁÀÇÉÊÍÓÔÕÚ]' AND title !~ '\\b(de|do|da|guia|guarda|raspagem|passagem|finalização|finalizacao|atletas|sobre|regras|controle|sistema|defesa|ataque|tecnica|técnica)\\b'"

    rpc_q = f"""
        SELECT page_id, title, description
        FROM wiki_translations
        WHERE language_code = '{args.lang}' AND {en_filter_sql}
        ORDER BY page_id
        LIMIT {args.limit};
    """
    # supabase-py doesn't directly support raw SQL well; use rpc or just filter via select
    # Use direct REST API instead
    import requests
    headers = {
        "apikey": sb_key,
        "Authorization": f"Bearer {sb_key}",
        "Content-Type": "application/json",
    }
    rest_url = f"{sb_url}/rest/v1/wiki_translations"
    # 一旦全件 fetch、client side で「英語のみ」 row を filter
    all_rows = []
    offset = 0
    page_size = 1000
    while True:
        params = {
            "select": "page_id,title,description",
            "language_code": f"eq.{args.lang}",
            "limit": str(page_size),
            "offset": str(offset),
            "order": "page_id.asc",
        }
        resp = requests.get(rest_url, headers=headers, params=params)
        resp.raise_for_status()
        chunk = resp.json()
        if not chunk:
            break
        all_rows.extend(chunk)
        if len(chunk) < page_size:
            break
        offset += page_size

    # client-side filter
    if args.lang == "ja":
        ja_re = re.compile(r"[぀-ヿ一-龯]")
        rows = [r for r in all_rows if not ja_re.search(r["title"] or "")]
    else:
        pt_accent_re = re.compile(r"[ãâáàçéêíóôõúÃÂÁÀÇÉÊÍÓÔÕÚ]")
        # PT: アクセント or PT marker word を含むものは skip
        pt_marker_re = re.compile(r"\b(de|do|da|guia|guarda|raspagem|passagem|atletas|sobre|regras|controle|sistema|defesa|ataque|tecnica)\b", re.IGNORECASE)
        rows = [r for r in all_rows if not pt_accent_re.search(r["title"] or "") and not pt_marker_re.search(r["title"] or "")]
    rows = rows[:args.limit]

    print(f"📋 翻訳対象: {len(rows)} rows ({args.lang})")
    if not rows:
        print("✅ 既に全 row 翻訳済")
        return 0

    print(f"  Mode: {'APPLY' if do_write else 'DRY-RUN'}")
    print(f"  --include-desc: {args.include_desc}")
    print()

    done = 0
    fail = 0
    for i, row in enumerate(rows):
        title = row["title"]
        new_title = gemini_translate_title(genai, title, args.lang)
        if not new_title:
            fail += 1
            print(f"  [{i+1}/{len(rows)}] page={row['page_id']}: ❌ Gemini fail")
            continue

        new_desc = None
        if args.include_desc and row.get("description"):
            time.sleep(RATE_LIMIT_SLEEP)
            desc = row["description"]
            new_desc = gemini_translate_title(genai, desc, args.lang) or desc

        if do_write:
            update_payload = {"title": new_title}
            if new_desc:
                update_payload["description"] = new_desc
            up_resp = requests.patch(
                rest_url,
                headers={**headers, "Prefer": "return=minimal"},
                params={
                    "page_id": f"eq.{row['page_id']}",
                    "language_code": f"eq.{args.lang}",
                },
                json=update_payload,
            )
            if up_resp.status_code >= 300:
                print(f"  [{i+1}/{len(rows)}] page={row['page_id']}: ❌ DB update fail {up_resp.status_code}")
                fail += 1
                continue

        if i < 5 or i % 50 == 0:
            print(f"  [{i+1}/{len(rows)}] {title[:40]} → {new_title[:40]}")
        done += 1
        time.sleep(RATE_LIMIT_SLEEP)

    print()
    mode = "APPLIED" if do_write else "DRY-RUN"
    print(f"📊 [{mode}] done={done}, fail={fail}")
    return 0 if fail == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
