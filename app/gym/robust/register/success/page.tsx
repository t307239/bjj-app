"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function RegisterSuccessPage() {
  const router = useRouter();

  useEffect(() => {
    // webhook 処理を待って5秒後にマイページへ
    const timer = setTimeout(() => {
      router.replace("/gym/robust/member");
    }, 5000);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="text-center">
        <div className="text-4xl mb-4">✅</div>
        <h1 className="text-xl font-bold text-white mb-2">登録完了！</h1>
        <p className="text-zinc-400 text-sm mb-6">ようこそ ROBUST 柔術へ</p>
        <p className="text-zinc-500 text-xs">マイページへ移動中...</p>
        <div className="w-6 h-6 border-2 border-white/10 border-t-emerald-500 rounded-full animate-spin mx-auto mt-4" />
      </div>
    </div>
  );
}
