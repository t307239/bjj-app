/**
 * sanitize-text-match.ts
 *
 * Wiki content_html 内に残存する「テキスト直書きのマーケティング要素」を
 * テキスト部分一致で検出・削除するスクリプト。
 *
 * 削除ターゲット（テキスト部分一致）:
 *   1. "Master this technique with world-class instruction"
 *   2. "Browse Instructionals"
 *   3. "Books, instructionals & gear"
 *   4. "Shop Wrestling Shoes"
 *   5. "Amazon"
 *   6. "Training Safety & Performance"
 *   7. "Yoga Poses"
 *   8. "Mark this technique as learned"
 *   9. "Open Skill Tree"
 *   10. Injury Prevention 等 (Training Safety & Performance 配下リンク群)
 *   11. Mermaid ダイアグラム（div.mermaid / pre.mermaid / graph LR 等を含む pre/code）
 *
 * 実装戦略:
 *   - `$('p, a, h2, h3, h4, li').filter(...)` でテキスト一致要素を特定
 *   - 親 div が「小さなウィジェット」（≤5子要素 かつ ≤500文字）なら丸ごと削除
 *   - そうでなければ当該要素のみ削除
 *   - :contains() は使わない（body まで巻き込む危険を回避）
 *
 * 実行方法（ユーザーの Mac で）:
 *   npm install cheerio
 *   npx tsx scripts/sanitize-text-match.ts
 */

import * as cheerio from "cheerio";
import * as fs from "fs";
import * as path from "path";

// ─── 削除ターゲット文字列 ────────────────────────────────────────
const TEXT_TARGETS: string[] = [
  "Master this technique with world-class instruction",
  "Browse Instructionals",
  "Books, instructionals & gear",
  "Shop Wrestling Shoes",
  "Amazon",
  "Training Safety & Performance",
  "Yoga Poses",
  "Mark this technique as learned",
  "Open Skill Tree",
  // Injury Prevention 関連（Training Safety & Performance 配下）
  "Injury Prevention",
  "BJJ Fitness & Conditioning",
  "Nutrition for BJJ",
  "Recovery & Mobility",
];

// 完全なウィジェット div と見なす閾値
const WIDGET_MAX_CHILDREN = 5;
const WIDGET_MAX_CHARS = 500;

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

// Mermaid キーワード（pre/code 内でこれらが見つかれば削除）
const MERMAID_KEYWORDS = [
  "graph LR", "graph TD", "graph TB", "graph RL",
  "flowchart", "sequenceDiagram", "classDiagram",
  "stateDiagram", "gantt", "pie title", "gitGraph",
];

// ─── HTML サニタイズ ─────────────────────────────────────────────
function sanitizeTextMatch(html: string): string | null {
  if (!html || html.length < 20) return null;

  // クイック判定: テキストターゲット または Mermaid が含まれなければスキップ
  const hasMermaid =
    html.includes("mermaid") ||
    MERMAID_KEYWORDS.some((k) => html.includes(k));
  const hasTarget = TEXT_TARGETS.some((t) => html.includes(t));
  if (!hasTarget && !hasMermaid) return null;

  const $ = cheerio.load(html, { xmlMode: false });

  let changed = false;

  // ── Mermaid 削除 ─────────────────────────────────────────────
  // 1. .mermaid クラスを持つ div / pre を丸ごと削除
  $("div.mermaid, pre.mermaid, .mermaid").each((_i, el) => {
    $(el).remove();
    changed = true;
  });

  // 2. Mermaid 構文キーワードを含む pre / code ブロックを削除
  $("pre, code").each((_i, el) => {
    const text = $(el).text();
    if (MERMAID_KEYWORDS.some((k) => text.includes(k))) {
      // code の場合は親 pre を探して削除
      const $pre = $(el).closest("pre");
      if ($pre.length > 0) {
        $pre.remove();
      } else {
        $(el).remove();
      }
      changed = true;
    }
  });

  for (const target of TEXT_TARGETS) {
    // p, a, h2, h3, h4, li で .text() に target を含む要素を探す
    $("p, a, h2, h3, h4, li, span, td").filter((_i, el) => {
      // 直接の text() のみでチェック（子孫を含めない場合は contents().filter(TextNode)）
      // ここでは .text() で子孫含めた全テキストを確認
      return $(el).text().includes(target);
    }).each((_i, el) => {
      const $el = $(el);

      // 親 div を探してウィジェット判定
      const $closestDiv = $el.closest("div");
      if ($closestDiv.length > 0) {
        const divText = $closestDiv.text().trim();
        const divChildren = $closestDiv.children().length;
        if (divChildren <= WIDGET_MAX_CHILDREN && divText.length <= WIDGET_MAX_CHARS) {
          // 小さなウィジェット → 親 div ごと削除
          $closestDiv.remove();
          changed = true;
          return;
        }
      }

      // 親 ul/ol を探して、その中の li が全部マーケ要素なら ul ごと削除
      if (el.tagName === "li") {
        const $ul = $el.closest("ul, ol");
        if ($ul.length > 0) {
          const allLiTexts = $ul.find("li").map((_j, li) => $(li).text().trim()).get();
          const allAreTargets = allLiTexts.every((t) =>
            TEXT_TARGETS.some((target) => t.includes(target))
          );
          if (allAreTargets) {
            $ul.remove();
            changed = true;
            return;
          }
        }
      }

      // それ以外は当該要素のみ削除
      $el.remove();
      changed = true;
    });
  }

  if (!changed) return null;

  return $("body").html() ?? html;
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

  console.log("🧹 sanitize-text-match 開始...");

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
      const cleaned = sanitizeTextMatch(row.content_html);
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
