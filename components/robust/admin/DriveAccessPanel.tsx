"use client";

import { useCopyFeedback } from "@/lib/robust/hooks/useCopyFeedback";
import { STATUS_LABEL } from "@/lib/robust/labels";

/** Drive共有管理に必要な会員の最小項目(会員管理ページの Member が代入可能) */
type DriveAccessMember = {
  id: string;
  name: string;
  email: string;
  status: string;
  video_access: boolean;
};

/**
 * 動画アクセス（Drive 共有）管理パネル。
 * Why: 動画は Drive フォルダを各会員の Google アカウントに手動共有する運用。
 *      アプリの動画リンクは status==active かつ video_access でゲートされるが、
 *      手動共有した Drive 権限はアプリのゲートが効かない（退会後も直接閲覧可能）。
 *      「共有すべき人」「権限を外すべき人」を可視化し剥奪忘れの事故を防ぐ。
 */
export default function DriveAccessPanel({ members }: { members: DriveAccessMember[] }) {
  const driveShareTargets = members.filter((m) => m.status === "active" && m.video_access);
  const driveRevokeTargets = members.filter((m) => m.video_access && m.status !== "active");

  const { copiedKey, copyText } = useCopyFeedback();
  // Why: 会員が多いとDrive共有先を1件ずつコピーするのは非現実的。カンマ区切りで一括コピー。
  const copyEmails = (key: string, emails: string[]) => copyText(key, emails.join(", "));

  if (driveShareTargets.length === 0 && driveRevokeTargets.length === 0) return null;

  return (
    <div className="bg-zinc-900 border border-white/10 rounded-xl p-4 mb-6">
      <h2 className="text-sm font-medium text-white mb-1">📹 動画アクセス（Drive 共有管理）</h2>
      <p className="text-zinc-500 text-xs mb-3">
        動画フォルダを各会員の Google アカウントに手動共有する運用です。下記を Drive
        の共有設定に反映してください。
      </p>

      {driveRevokeTargets.length > 0 && (
        <details
          open={driveRevokeTargets.length <= 8}
          className="mb-3 rounded-lg bg-red-500/10 border border-red-500/30 p-3"
        >
          <summary className="text-red-400 text-xs font-medium cursor-pointer">
            ⚠️ Drive 権限を外す（{driveRevokeTargets.length}名）— 退会・休会したが動画ONのまま
          </summary>
          <div className="mt-2">
            <button
              type="button"
              onClick={() =>
                copyEmails(
                  "revoke",
                  driveRevokeTargets.map((m) => m.email),
                )
              }
              className="text-[11px] bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded px-2 py-1 mb-2"
            >
              📋 メールを一括コピー{copiedKey === "revoke" ? " ✓" : ""}
            </button>
            <ul className="space-y-1 max-h-56 overflow-auto">
              {driveRevokeTargets.map((m) => (
                <li key={m.id} className="text-xs text-zinc-300 flex items-center gap-2 flex-wrap">
                  <span>{m.name}</span>
                  <span className="text-zinc-500">{m.email}</span>
                  <span className="text-red-400">（{STATUS_LABEL[m.status] ?? m.status}）</span>
                </li>
              ))}
            </ul>
          </div>
        </details>
      )}

      {driveShareTargets.length === 0 ? (
        <p className="text-emerald-400 text-xs font-medium">
          ✅ Drive を共有する対象（0名）— 有効かつ動画ON：対象なし
        </p>
      ) : (
        <details open={driveShareTargets.length <= 8}>
          <summary className="text-emerald-400 text-xs font-medium cursor-pointer">
            ✅ Drive を共有する対象（{driveShareTargets.length}名）— 有効かつ動画ON
          </summary>
          <div className="mt-2">
            <button
              type="button"
              onClick={() =>
                copyEmails(
                  "share",
                  driveShareTargets.map((m) => m.email),
                )
              }
              className="text-[11px] bg-emerald-600 hover:bg-emerald-500 text-white rounded px-2 py-1 mb-2"
            >
              📋 メールを一括コピー{copiedKey === "share" ? " ✓" : ""}
            </button>
            <ul className="space-y-1 max-h-56 overflow-auto">
              {driveShareTargets.map((m) => (
                <li key={m.id} className="text-xs text-zinc-300 flex items-center gap-2 flex-wrap">
                  <span>{m.name}</span>
                  <span className="text-zinc-500">{m.email}</span>
                </li>
              ))}
            </ul>
          </div>
        </details>
      )}
    </div>
  );
}
