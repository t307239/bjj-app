"use client";

/**
 * ROBUST 管理ページの「権限なし/エラー」用の行き止まり回避画面。
 * Why: ログイン済みだが権限が無い(403)会員などが管理URLに来たとき、赤文字だけの
 *      行き止まりだと戻れない。管理者ログイン・会員トップ・ログイン/新規登録への導線を出す。
 */
export default function RobustAccessDenied({
  message,
  onLogin,
}: {
  message?: string;
  onLogin?: () => void;
}) {
  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 text-center gap-5">
      <div>
        <p className="text-red-400 text-sm mb-1">{message ?? "権限がありません"}</p>
        <p className="text-zinc-500 text-xs">この画面はオーナー・管理者のみ利用できます。</p>
      </div>
      <div className="flex flex-col gap-2 w-full max-w-xs">
        {onLogin && (
          <button
            type="button"
            onClick={onLogin}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-sm rounded-lg py-2.5 transition-colors"
          >
            管理者としてログイン
          </button>
        )}
        <a
          href="/gym/robust/member/qr"
          className="w-full bg-zinc-800 hover:bg-zinc-700 text-white text-sm rounded-lg py-2.5 transition-colors"
        >
          会員トップへ
        </a>
        <a href="/gym/robust/register" className="text-zinc-400 hover:text-white text-xs py-2">
          ログイン／新規登録へ
        </a>
      </div>
    </div>
  );
}
