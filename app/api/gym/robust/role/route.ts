import { NextResponse } from "next/server";
import { requireRobustManager } from "@/lib/robust/auth";

/**
 * クライアントの管理系ページ用の軽量ゲート。オーナー/管理者のみ 200、instructor は 403。
 * Why: /settings・/videos の GET は会員/instructor も通す(requireRobustAuth)ため、ページの
 *      ロード時の権限判定に使えない。manager 限定(requireRobustManager)の軽量エンドポイントを
 *      1つ用意し、動画管理・お知らせ配信など「オーナー/管理者のみ」の画面が共通のゲートとして
 *      使えるようにする（instructor の直URLアクセスを締め出す）。
 */
export async function GET() {
  const auth = await requireRobustManager();
  if (!auth.ok) return auth.response;
  return NextResponse.json({ role: auth.role });
}
