"use client";

/**
 * 会員 QR コード表示ページ
 * - ログイン必須（Supabase Auth）
 * - qr_token を QR コードとして表示
 * - 入口タブレットまたは USB バーコードリーダーでスキャン
 */

import { useState, useEffect, useRef } from "react";
import { createRobustClient } from "@/lib/robust/supabase";
import type { GymMember } from "@/lib/robust/types";
import { PLAN_LABEL, STATUS_LABEL, STATUS_COLOR } from "@/lib/robust/labels";

const GYM_ID = process.env.NEXT_PUBLIC_ROBUST_GYM_ID ?? "";
// QR 画像の一辺(px)。表示サイズ(240)と揃える
const QR_IMAGE_SIZE_PX = 240;

export default function MemberQrPage() {
  const supabase = createRobustClient();
  const [member, setMember] = useState<GymMember | null>(null);
  const [loading, setLoading] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = "/gym/robust/register";
        return;
      }

      const { data } = await supabase
        .from("gym_members")
        .select("id, name, qr_token, plan_type, status")
        .eq("user_id", user.id)
        .eq("gym_id", GYM_ID)
        .maybeSingle(); // Why: webhook 未完了タイミングで開くと .single() は PGRST116 をthrowする

      setMember(data as GymMember | null);
      setLoading(false);
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // QR 画像はブラウザ内で生成する。
  // Why: 以前は外部サービス(api.qrserver.com)へ qr_token を送って画像を取得していた。
  //      外部往復で表示が遅れ、会員の識別トークンが第三者に渡る点もセキュリティ上好ましくないため。
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!member?.qr_token) return;
    let cancelled = false;
    // Why: qrcode は表示時にだけ必要なので動的 import でバンドルから分離する
    import("qrcode")
      .then((QRCode) => QRCode.toDataURL(member.qr_token, { width: QR_IMAGE_SIZE_PX, margin: 0 }))
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [member?.qr_token]);
  const qrUrl = qrDataUrl;

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-white/10 border-t-white/60 rounded-full animate-spin" />
      </div>
    );
  }

  if (!member) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-zinc-400 text-sm">会員情報が見つかりません</p>
          <a href="/gym/robust/register" className="text-emerald-400 text-sm mt-2 block">
            登録ページへ →
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="w-full max-w-xs text-center">
        <p className="text-zinc-400 text-sm mb-1">ROBUST 柔術</p>
        <h1 className="text-xl font-bold text-white mb-6">{member.name}</h1>

        {/* QR コード */}
        <div className="bg-white rounded-2xl p-4 inline-block mb-4">
          {qrUrl && (
            // Why: src は data URL(ブラウザ内生成)。next/image の最適化・遅延読込の対象外なので <img> が適切。
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qrUrl}
              alt="チェックイン用QRコード"
              width={240}
              height={240}
              className="block"
            />
          )}
        </div>

        {member.status === "active" ? (
          <p className="text-zinc-500 text-xs mb-6">入口の読み取り機にQRコードをかざしてください</p>
        ) : (
          <p className="text-yellow-500 text-xs mb-6">
            {member.status === "paused"
              ? "⚠️ 休会中のため現在チェックインできません"
              : "⚠️ 退会済みのためチェックインできません"}
          </p>
        )}

        <div className="bg-zinc-900 border border-white/10 rounded-xl p-4 text-left">
          <div className="flex justify-between items-center">
            <span className="text-xs text-zinc-500">プラン</span>
            <span className="text-sm text-white">
              {PLAN_LABEL[member.plan_type] ?? member.plan_type}
            </span>
          </div>
          <div className="flex justify-between items-center mt-2">
            <span className="text-xs text-zinc-500">ステータス</span>
            <span
              className={`text-xs px-2 py-0.5 rounded ${
                STATUS_COLOR[member.status] ?? "bg-zinc-700 text-zinc-400"
              }`}
            >
              {STATUS_LABEL[member.status] ?? member.status}
            </span>
          </div>
        </div>

        <canvas ref={canvasRef} className="hidden" />

        {/* ナビゲーション */}
        <div className="mt-6 space-y-2">
          <a
            href="/gym/robust/member/videos"
            className="block w-full text-center bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium rounded-xl py-3 transition-colors"
          >
            会員限定動画を見る →
          </a>
          <div className="flex gap-2">
            <a
              href="/gym/robust/member/history"
              className="flex-1 text-center bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-xs rounded-xl py-2.5 transition-colors"
            >
              来館履歴
            </a>
            <a
              href="/gym/robust/member/profile"
              className="flex-1 text-center bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-xs rounded-xl py-2.5 transition-colors"
            >
              マイページ
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
