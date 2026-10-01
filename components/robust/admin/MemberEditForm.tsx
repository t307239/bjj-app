"use client";

import { useState } from "react";
import { BELT_LABEL } from "@/lib/robust/labels";

/** 「月8回」プランで上限回数が未入力のときに使う月上限回数 */
const DEFAULT_MONTHLY_CAP = 8;

/** 編集フォームの対象になる会員の項目 */
type EditableMember = {
  id: string;
  name: string;
  email: string;
  status: string;
  plan_type: string;
  plan_cap: number | null;
  video_access: boolean;
  payment_method: string;
  belt: string;
  stripes: number;
};

/** 保存時に API へ送る値(会員一覧のローカル更新にもそのまま使う) */
export type MemberEditValues = {
  status: string;
  plan_type: string;
  plan_cap: number | null;
  video_access: boolean;
  payment_method: string;
  belt: string;
  stripes: number;
};

type Props = {
  member: EditableMember;
  saving: boolean;
  saveError: string;
  onSave: (values: MemberEditValues) => void;
  onCancel: () => void;
};

/**
 * 会員の編集フォーム。
 * 入力中の値(編集状態)はこのフォームの中だけで持ち、会員管理ページの再描画を増やさない。
 * 開く(マウントされる)たびに、会員の現在値を初期値にする。
 */
export default function MemberEditForm({ member, saving, saveError, onSave, onCancel }: Props) {
  const [editStatus, setEditStatus] = useState<string>(member.status);
  const [editPlan, setEditPlan] = useState<string>(member.plan_type);
  const [editCap, setEditCap] = useState<string>(
    member.plan_cap != null ? String(member.plan_cap) : "",
  );
  const [editVideoAccess, setEditVideoAccess] = useState<boolean>(member.video_access);
  const [editPaymentMethod, setEditPaymentMethod] = useState<string>(member.payment_method);
  const [editBelt, setEditBelt] = useState<string>(member.belt);
  const [editStripes, setEditStripes] = useState<number>(member.stripes);

  function handleSubmit() {
    onSave({
      status: editStatus,
      plan_type: editPlan,
      // Why: 上限回数は「月8回」プランでのみ意味を持つ。他プランでは null にして誤った上限を残さない
      plan_cap:
        editPlan === "twice_weekly" ? (editCap ? parseInt(editCap) : DEFAULT_MONTHLY_CAP) : null,
      video_access: editVideoAccess,
      payment_method: editPaymentMethod,
      belt: editBelt,
      stripes: editStripes,
    });
  }

  return (
    <div className="space-y-3">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-white font-medium">{member.name}</p>
          <p className="text-zinc-500 text-xs">{member.email}</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-zinc-400 mb-1">ステータス</label>
            <select
              value={editStatus}
              onChange={(e) => setEditStatus(e.target.value)}
              className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
            >
              <option value="active">有効</option>
              <option value="paused">休会中</option>
              <option value="cancelled">退会</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">プラン</label>
            <select
              value={editPlan}
              onChange={(e) => setEditPlan(e.target.value)}
              className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
            >
              <option value="fulltime">フルタイム</option>
              <option value="twice_weekly">月8回</option>
              <option value="drop_in">ドロップイン</option>
            </select>
          </div>
        </div>
        {/* Why: プラン変更は cap/超過の判定には効くが、Stripe の月額請求は自動で変わらない。
            （プラン種別だけでは男女別価格を確定できず自動同期できない）。誤解防止の注意書き。 */}
        {editPlan !== member.plan_type && (
          <p className="text-amber-400 text-xs bg-amber-500/10 rounded-lg px-3 py-2">
            ※ プラン変更は月額（Stripe）の請求額には自動反映されません。金額の変更が必要な場合は
            Stripe 側で行ってください。
          </p>
        )}
        {editPlan === "twice_weekly" && (
          <div>
            <label className="block text-xs text-zinc-400 mb-1">月上限回数</label>
            <input
              type="number"
              value={editCap}
              onChange={(e) => setEditCap(e.target.value)}
              min={1}
              max={99}
              placeholder="8"
              className="w-32 bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
            />
          </div>
        )}
        {/* 動画アクセス切替 */}
        <div className="flex items-center justify-between bg-zinc-800 rounded-lg px-3 py-2.5">
          <div>
            <p className="text-white text-sm">会員限定動画の閲覧</p>
            <p className="text-zinc-500 text-xs mt-0.5">オンにすると動画ページにアクセス可能</p>
          </div>
          <button
            type="button"
            onClick={() => setEditVideoAccess((v) => !v)}
            className={`relative w-11 h-6 rounded-full transition-colors ${editVideoAccess ? "bg-emerald-500" : "bg-zinc-600"}`}
            aria-label="動画アクセス切替"
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${editVideoAccess ? "translate-x-5" : "translate-x-0"}`}
            />
          </button>
        </div>
        {/* ⑤ 支払い方法（カード / 口座振替）切替 */}
        <div>
          <label className="block text-xs text-zinc-400 mb-1">支払い方法</label>
          <select
            value={editPaymentMethod}
            onChange={(e) => setEditPaymentMethod(e.target.value)}
            className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
          >
            <option value="stripe">カード（Stripe）</option>
            <option value="bank_transfer">口座振替</option>
          </select>
        </div>
        {/* 帯・ストライプ（依頼書 Section 9）。保存時に変更があれば昇格履歴に自動記録される。 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-zinc-400 mb-1">帯</label>
            <select
              value={editBelt}
              onChange={(e) => setEditBelt(e.target.value)}
              className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
            >
              <option value="white">白帯</option>
              <option value="blue">青帯</option>
              <option value="purple">紫帯</option>
              <option value="brown">茶帯</option>
              <option value="black">黒帯</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">ストライプ</label>
            <select
              value={String(editStripes)}
              onChange={(e) => setEditStripes(parseInt(e.target.value))}
              className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
            >
              <option value="0">0本</option>
              <option value="1">1本</option>
              <option value="2">2本</option>
              <option value="3">3本</option>
              <option value="4">4本</option>
            </select>
          </div>
        </div>
        {(editBelt !== member.belt || editStripes !== member.stripes) && (
          <p className="text-emerald-400 text-xs bg-emerald-500/10 rounded-lg px-3 py-2">
            ※ 保存すると昇格履歴に記録されます（{BELT_LABEL[member.belt] ?? member.belt}
            {member.stripes}本 → {BELT_LABEL[editBelt] ?? editBelt}
            {editStripes}本）
          </p>
        )}
        {saveError && <p className="text-red-400 text-xs">{saveError}</p>}
        <div className="flex gap-2">
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-sm rounded-lg py-2 font-medium"
          >
            {saving ? "保存中..." : "保存"}
          </button>
          <button
            onClick={onCancel}
            className="flex-1 bg-zinc-700 hover:bg-zinc-600 text-white text-sm rounded-lg py-2"
          >
            キャンセル
          </button>
        </div>
      </div>
    </div>
  );
}
