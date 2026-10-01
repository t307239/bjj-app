"use client";

import { useState } from "react";

/**
 * 来館CSV（期間指定）: 出席ログを日付範囲で出力（売上・稼働レポート用）。
 * 期間の入力状態はこのコンポーネント内で完結させ、会員管理ページの再描画を増やさない。
 */
export default function AttendanceCsvExport() {
  // 来館CSVの期間（既定=今月1日〜今日, JST）。Why: 出席ログを期間指定で出力するため。
  const [attFrom, setAttFrom] = useState(() => {
    const t = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
    return t.slice(0, 7) + "-01";
  });
  const [attTo, setAttTo] = useState(() =>
    new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" }),
  );

  return (
    <div className="bg-zinc-900 border border-white/10 rounded-xl p-4 mb-6 flex flex-wrap items-end gap-3">
      <div>
        <label htmlFor="att-from" className="block text-xs text-zinc-400 mb-1">
          来館CSV：開始日
        </label>
        <input
          id="att-from"
          type="date"
          value={attFrom}
          max={attTo}
          onChange={(e) => setAttFrom(e.target.value)}
          className="bg-zinc-800 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm"
        />
      </div>
      <div>
        <label htmlFor="att-to" className="block text-xs text-zinc-400 mb-1">
          終了日
        </label>
        <input
          id="att-to"
          type="date"
          value={attTo}
          min={attFrom}
          onChange={(e) => setAttTo(e.target.value)}
          className="bg-zinc-800 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm"
        />
      </div>
      <a
        href={`/api/gym/robust/export/attendance?from=${attFrom}&to=${attTo}`}
        className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg px-4 py-2 whitespace-nowrap"
        title="指定期間の来館データをCSVでダウンロード"
      >
        ⬇ 来館サマリーCSV（月別回数）
      </a>
      <p className="text-xs text-zinc-500 basis-full">
        指定期間の「会員 ×
        各月の来館回数」を一覧で出力します（稼働・売上分析用）。会員の連絡先など詳細は「会員CSV」から。
      </p>
    </div>
  );
}
