"use client";

import { useState, useEffect } from "react";
import { createRobustClient } from "@/lib/robust/supabase";

type Video = {
  id: string;
  title: string;
  description: string | null;
  drive_file_id: string;
  thumbnail_url: string | null;
  class_type: string | null;
  created_at: string;
};

const CLASS_LABEL: Record<string, string> = {
  beginner: "白帯クラス", basic: "基礎", regular: "通常",
  nogi: "ノーギ", private: "個別", other: "その他",
};

export default function MemberVideosPage() {
  const supabase = createRobustClient();
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Video | null>(null);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = "/gym/robust/register"; return; }

      const res = await fetch("/api/gym/robust/videos");
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.error ?? "読み込みに失敗しました");
        setLoading(false);
        return;
      }
      const json = await res.json();
      setVideos(json.videos);
      setLoading(false);
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const classTypes = ["all", ...Array.from(new Set(videos.map(v => v.class_type).filter(Boolean))) as string[]];
  const filtered = filter === "all" ? videos : videos.filter(v => v.class_type === filter);

  if (loading) return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-white/10 border-t-white/60 rounded-full animate-spin" />
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="text-center">
        <p className="text-red-400 text-sm">{error}</p>
        <a href="/gym/robust/register" className="text-emerald-400 text-sm mt-2 block">← 会員登録ページへ</a>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-zinc-950 p-4">
      <div className="max-w-2xl mx-auto">
        {/* ヘッダー */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-white">会員限定動画</h1>
            <p className="text-zinc-500 text-xs mt-0.5">ROBUST 柔術</p>
          </div>
          <a href="/gym/robust/member/qr" className="text-zinc-400 text-xs hover:text-white">← QRコード</a>
        </div>

        {/* フィルター */}
        {classTypes.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
            {classTypes.map(ct => (
              <button key={ct} type="button" onClick={() => setFilter(ct)}
                className={`whitespace-nowrap text-xs px-3 py-1.5 rounded-full transition-colors ${filter === ct ? "bg-emerald-600 text-white" : "bg-zinc-800 text-zinc-400 hover:text-white"}`}>
                {ct === "all" ? "すべて" : CLASS_LABEL[ct] ?? ct}
              </button>
            ))}
          </div>
        )}

        {/* 動画プレーヤー（選択時） */}
        {selected && (
          <div className="mb-6 bg-zinc-900 border border-emerald-500/30 rounded-xl overflow-hidden">
            {/* Why: Google Drive の動画は iframe embed で認証不要で閲覧可能。
                     外部から直 URL アクセスは Drive の共有設定に依存するため、
                     管理者が "ジム内限定" で Drive 共有設定することを前提とする */}
            <div className="relative w-full" style={{ paddingTop: "56.25%" }}>
              <iframe
                src={`https://drive.google.com/file/d/${selected.drive_file_id}/preview`}
                className="absolute inset-0 w-full h-full"
                allow="autoplay"
                title={selected.title}
                width="640"
                height="360"
              />
            </div>
            <div className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-white font-medium">{selected.title}</h2>
                  {selected.class_type && (
                    <span className="text-xs bg-zinc-700 text-zinc-300 px-2 py-0.5 rounded mt-1 inline-block">
                      {CLASS_LABEL[selected.class_type] ?? selected.class_type}
                    </span>
                  )}
                  {selected.description && <p className="text-zinc-400 text-sm mt-2">{selected.description}</p>}
                </div>
                <button type="button" onClick={() => setSelected(null)}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center text-zinc-400 hover:text-white text-lg"
                  aria-label="動画を閉じる">
                  ✕
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 動画一覧 */}
        {filtered.length === 0 ? (
          <div className="bg-zinc-900 border border-white/10 rounded-xl p-8 text-center">
            <p className="text-zinc-400 text-sm">動画がありません</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(v => (
              <button key={v.id} type="button" onClick={() => setSelected(v === selected ? null : v)}
                className={`w-full text-left bg-zinc-900 border rounded-xl p-4 hover:border-emerald-500/40 transition-colors ${selected?.id === v.id ? "border-emerald-500/50" : "border-white/10"}`}>
                <div className="flex items-center gap-3">
                  {/* サムネイル or プレースホルダー */}
                  <div className="w-16 h-10 rounded-lg bg-zinc-800 overflow-hidden shrink-0 flex items-center justify-center">
                    {v.thumbnail_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={v.thumbnail_url} alt={v.title} className="w-full h-full object-cover" width={64} height={40} />
                    ) : (
                      <span className="text-zinc-600 text-lg">▶</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-white text-sm font-medium truncate" title={v.title}>{v.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {v.class_type && <span className="text-xs text-zinc-500">{CLASS_LABEL[v.class_type] ?? v.class_type}</span>}
                      {v.description && <span className="text-xs text-zinc-600 truncate" title={v.description}>{v.description}</span>}
                    </div>
                  </div>
                  <span className="text-zinc-600 text-sm shrink-0">▶</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
