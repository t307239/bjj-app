"use client";

import { useState, useEffect } from "react";
import { createRobustClient } from "@/lib/robust/supabase";

type Announcement = {
  id: string;
  title: string;
  body: string;
  urgent: boolean;
  created_at: string;
};

export default function MemberAnnouncementsPage() {
  const supabase = createRobustClient();
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = "/gym/robust/register"; return; }
      const res = await fetch("/api/gym/robust/member/announcements");
      if (!res.ok) { setLoading(false); return; }
      const json = await res.json();
      setItems(json.announcements ?? []);
      setLoading(false);
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <div className="min-h-screen bg-zinc-950 flex items-center justify-center"><div className="w-6 h-6 border-2 border-white/10 border-t-white/60 rounded-full animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-zinc-950 p-4">
      <div className="max-w-md mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-white">お知らせ</h1>
          <a href="/gym/robust/member/profile" className="text-zinc-400 text-xs hover:text-white">← マイページ</a>
        </div>

        {items.length === 0 ? (
          <div className="bg-zinc-900 border border-white/10 rounded-xl p-8 text-center">
            <p className="text-zinc-400 text-sm">お知らせはまだありません</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {items.map(a => (
              <li key={a.id} className="bg-zinc-900 border border-white/10 rounded-xl p-4">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    {a.urgent && <span className="shrink-0 text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded">緊急</span>}
                    <h2 className="text-white text-sm font-medium truncate">{a.title}</h2>
                  </div>
                  <span className="shrink-0 text-zinc-500 text-[11px] tabular-nums">
                    {new Date(a.created_at).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" })}
                  </span>
                </div>
                <p className="text-zinc-300 text-sm whitespace-pre-wrap leading-relaxed">{a.body}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
