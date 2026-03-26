/**
 * sanitize-wiki-zombies.ts
 *
 * Wiki content_html の残存ゾンビ要素を根こそぎ削除するスクリプト。
 *
 * 削除対象:
 *   1. <script> タグ（全て）
 *   2. #float-cta コンテナ（ニュースレターポップアップ）
 *   3. <a href*="beehiiv.com"> リンク（親要素がそのリンクのみなら親ごと削除）
 *   4. <nav aria-label="*navigation"> prev/next ナビゲーション
 *   5. <a href*="amazon.com">, <a href*="amzn.to"> アフィリエイトリンク（unwrap）
 *   6. 全要素の style= 属性を剥奪
 *
 * 実行方法（ユーザーの Mac で）:
 *   npm install cheerio
 *   npx tsx scripts/sanitize-wiki-zombies.ts
 *
 * 環境変数（.env.local から自動読み込み）:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import * as cheerio from "cheerio";
import * as fs from "fs";
import * as path from "path";

// ─── 環境変数読み込み ────────────────────────────────────────────
function loadEnv(): Record<string, string> {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) {
    console.error(".env.local not found");
    process.exit(1);
  }
  const env: Record<string, string> = {};
  fs.readFileSync(envPath, "utf-8")
    .split("\n")
    .forEach((line) => {
      const m = line.match(/^([^=]+)=(.*)$/);
      if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
    });
  return env;
}

// ─── HTML サニタイズ ─────────────────────────────────────────────
function sanitizeHtml(html: string): string | null {
  // クイック判定: 対象パターンがなければスキップ
  const needsSanitize =
    /<script/i.test(html) ||
    /id="float-cta"/i.test(html) ||
    /beehiiv\.com/i.test(html) ||
    /aria-label="[^"]*navigation/i.test(html) ||
    /(amazon\.com|amzn\.to)/i.test(html) ||
    / style="/i.test(html);

  if (!needsSanitize) return null;

  const $ = cheerio.load(html, { xmlMode: false });

  // 1. <script> 全削除
  $("script").remove();

  // 2. #float-cta 削除
  $("#float-cta").remove();

  // 3. beehiiv.com リンク（親が単一子なら親ごと削除、そうでなければリンクのみ削除）
  $('a[href*="beehiiv.com"]').each((_i, el) => {
    const $el = $(el);
    const $parent = $el.parent();
    const parentText = $parent.text().trim();
    const linkText = $el.text().trim();
    if (
      $parent.children().length === 1 &&
      parentText === linkText
    ) {
      $parent.remove();
    } else {
      $el.remove();
    }
  });

  // 4. <nav aria-label="*navigation"> 削除
  $("nav").each((_i, el) => {
    const ariaLabel = $(el).attr("aria-label") ?? "";
    if (/navigation/i.test(ariaLabel)) {
      $(el).remove();
    }
  });

  // 5. Amazon アフィリエイトリンク → テキストに unwrap
  $('a[href*="amazon.com"], a[href*="amzn.to"]').each((_i, el) => {
    const $el = $(el);
    $el.replaceWith($el.text());
  });

  // 6. 全要素の style= 属性を剥奪
  $("[style]").removeAttr("style");

  // <body> 内部の HTML を返す
  const newHtml = $("body").html() ?? html;
  if (newHtml === html) return null; // 変更なし
  return newHtml;
}

// ─── Supabase REST API ─────────────────────────────────────────
async function fetchBatch(
  supabaseUrl: string,
  serviceKey: string,
  offset: number,
  limit: number
): Promise<{ id: string; content_html: string }[]> {
  const url = `${supabaseUrl}/rest/v1/wiki_translations?select=id,content_html&offset=${offset}&limit=${limit}`;
  const res = await fetch(url, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
  });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function patchRecord(
  supabaseUrl: string,
  serviceKey: string,
  id: string,
  html: string
): Promise<void> {
  const url = `${supabaseUrl}/rest/v1/wiki_translations?id=eq.${id}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ content_html: html }),
  });
  if (!res.ok) throw new Error(`PATCH failed for ${id}: ${res.status}`);
}

// ─── メイン ─────────────────────────────────────────────────────
async function main() {
  const env = loadEnv();
  const SUPABASE_URL = env["NEXT_PUBLIC_SUPABASE_URL"];
  const SERVICE_KEY = env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error("Missing Supabase env vars");
    process.exit(1);
  }

  const BATCH_SIZE = 50;
  const SLEEP_MS = 1000;

  let offset = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;
  let total = 0;

  console.log("🧹 sanitize-wiki-zombies 開始...");

  while (true) {
    const rows = await fetchBatch(SUPABASE_URL, SERVICE_KEY, offset, BATCH_SIZE);
    if (rows.length === 0) break;

    const patches: Promise<void>[] = [];

    for (const row of rows) {
      total++;
      if (!row.content_html) {
        skipped++;
        continue;
      }
      const cleaned = sanitizeHtml(row.content_html);
      if (!cleaned) {
        skipped++;
        continue;
      }
      patches.push(
        patchRecord(SUPABASE_URL, SERVICE_KEY, row.id, cleaned)
          .then(() => { updated++; })
          .catch((e) => {
            console.error(`  ❌ ${row.id}: ${e.message}`);
            errors++;
          })
      );
    }

    await Promise.all(patches);

    console.log(
      `  offset=${offset} processed=${rows.length} updated=${updated} skipped=${skipped} errors=${errors}`
    );

    if (rows.length < BATCH_SIZE) break;
    offset += BATCH_SIZE;

    await new Promise((resolve) => setTimeout(resolve, SLEEP_MS));
  }

  console.log(
    `\n✅ 完了: total=${total} updated=${updated} skipped=${skipped} errors=${errors}`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
