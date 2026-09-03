import Link from "next/link";

// ROBUST 配下の 404。本体アプリのルート("/")へ戻さず、ジムの会員トップへ誘導する。
export default function RobustNotFound() {
  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 text-center">
      <div className="text-5xl mb-4" aria-hidden="true">🥋</div>
      <h1 className="text-white text-3xl font-bold mb-2">404</h1>
      <p className="text-zinc-400 text-sm mb-6">このページは存在しないか、移動された可能性があります。</p>
      <Link
        href="/gym/robust/member/qr"
        className="bg-zinc-800 hover:bg-zinc-700 text-white text-sm rounded-full px-6 py-2.5 transition-colors"
      >
        会員トップへ戻る
      </Link>
    </div>
  );
}
