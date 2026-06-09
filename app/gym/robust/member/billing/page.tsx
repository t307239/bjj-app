"use client";

import { useEffect, useState } from "react";
import { createRobustClient } from "@/lib/robust/supabase";

export default function MemberBillingPage() {
  const supabase = createRobustClient();
  const [message, setMessage] = useState("");

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = "/gym/robust/register"; return; }

      const res = await fetch("/api/gym/robust/member/billing");
      if (!res.ok) {
        // Stripe顧客なし（口座振替・未決済など）→ 黙って戻さず案内を表示する
        setMessage("オンライン決済（カード）の登録がありません。口座振替などでお支払いの方はカード変更の必要はありません。ご不明な点は道場までお問い合わせください。");
        return;
      }
      const { url } = await res.json();
      window.location.href = url;
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (message) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <p className="text-zinc-300 text-sm mb-4">{message}</p>
          <a href="/gym/robust/member/profile" className="text-emerald-400 text-sm">← マイページへ戻る</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="text-center">
        <div className="w-6 h-6 border-2 border-white/10 border-t-white/60 rounded-full animate-spin mx-auto mb-3" />
        <p className="text-zinc-400 text-sm">お支払いページに移動中...</p>
      </div>
    </div>
  );
}
