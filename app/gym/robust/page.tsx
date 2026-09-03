import { redirect } from "next/navigation";

// /gym/robust の index。単体では 404 になり本体アプリ側へ誘導されてしまうため、
// ROBUST の会員トップ(QR)へリダイレクトしてジム内に留める（未ログインは会員トップ側で登録導線を表示）。
export default function RobustIndexPage() {
  redirect("/gym/robust/member/qr");
}
