"use client";

import { useEffect } from "react";
import { createRobustClient } from "@/lib/robust/supabase";

export default function MemberBillingPage() {
  const supabase = createRobustClient();

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = "/gym/robust/register"; return; }

      const res = await fetch("/api/gym/robust/member/billing");
      if (!res.ok) {
        // Stripe未設定 or 顧客なし → プロフィールへ戻す
        window.location.href = "/gym/robust/member/profile";
        return;
      }
      const { url } = await res.json();
      window.location.href = url;
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="text-center">
        <div className="w-6 h-6 border-2 border-white/10 border-t-white/60 rounded-full animate-spin mx-auto mb-3" />
        <p className="text-zinc-400 text-sm">お支払いページに移動中...</p>
      </div>
    </div>
  );
}
