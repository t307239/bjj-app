"use client";

import { useEffect, useState } from "react";
import { createRobustClient } from "@/lib/robust/supabase";

const GYM_ID = process.env.NEXT_PUBLIC_ROBUST_GYM_ID ?? "";
const MAX_POLLS = 10;
const POLL_INTERVAL_MS = 2000;

export default function RegisterSuccessPage() {
  const supabase = createRobustClient();
  const [status, setStatus] = useState<"polling" | "ready" | "timeout">("polling");
  const [pollCount, setPollCount] = useState(0);

  useEffect(() => {
    // Why: webhook は非同期のため checkout 完了直後は gym_members が未作成。
    //      ポーリングで member レコードの作成を確認してから QR へ誘導する。
    //      最大 10 回 × 2秒 = 20秒待ってタイムアウト。
    let cancelled = false;

    async function poll() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;

      for (let i = 0; i < MAX_POLLS; i++) {
        if (cancelled) return;
        setPollCount(i + 1);

        const { data } = await supabase
          .from("gym_members")
          .select("id")
          .eq("user_id", user.id)
          .eq("gym_id", GYM_ID)
          .maybeSingle();

        if (data) {
          if (!cancelled) setStatus("ready");
          await new Promise(r => setTimeout(r, 800)); // 少し待ってから遷移
          if (!cancelled) window.location.href = "/gym/robust/member/qr";
          return;
        }
        await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
      }
      if (!cancelled) setStatus("timeout");
    }

    poll();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="text-center max-w-xs">
        {status === "ready" ? (
          <>
            <div className="text-4xl mb-4">✅</div>
            <h1 className="text-xl font-bold text-white mb-2">登録完了！</h1>
            <p className="text-zinc-400 text-sm">QRコードページへ移動します...</p>
          </>
        ) : status === "timeout" ? (
          <>
            <div className="text-4xl mb-4">⏳</div>
            <h1 className="text-lg font-bold text-white mb-2">登録処理中です</h1>
            <p className="text-zinc-400 text-sm mb-4">
              決済は完了しています。QRコードの発行まで少しお待ちください。
            </p>
            <a href="/gym/robust/member/qr"
              className="block bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-xl py-3 px-4">
              QRコードページへ →
            </a>
          </>
        ) : (
          <>
            <div className="text-4xl mb-4">✅</div>
            <h1 className="text-xl font-bold text-white mb-2">ようこそ ROBUST 柔術へ！</h1>
            <p className="text-zinc-400 text-sm mb-4">QRコードを発行中です...</p>
            <div className="w-6 h-6 border-2 border-white/10 border-t-emerald-500 rounded-full animate-spin mx-auto" />
            <p className="text-zinc-600 text-xs mt-3">{pollCount}/{MAX_POLLS}</p>
          </>
        )}
      </div>
    </div>
  );
}
