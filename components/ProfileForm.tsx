"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Toast from "./Toast";
import type { SupabaseClient } from "@supabase/supabase-js";

type Profile = {
  belt: string;
  stripe: number;
  gym: string;   // = gym_name in Supabase profiles table (B2B Trojan horse key field)
  bio: string;
  start_date: string;
};

/*
 * B2B Trojan Horse — 将来の自動メール機能のための集計クエリ
 *
 * 同じジムのユーザーが10人以上集まったら、道場主に自動メールを送る:
 *
 * SELECT gym, COUNT(*) as user_count
 * FROM profiles
 * WHERE gym IS NOT NULL AND gym != ''
 * GROUP BY gym
 * HAVING COUNT(*) >= 10
 * ORDER BY user_count DESC;
 *
 * → 結果を `gym_owner_emails` テーブルと照合し、
 *   未送信の道場に Beehiiv / SendGrid 経由で自動メール送信:
 *   「あなたの道場の生徒が{N}人このアプリを使っています。
 *    月$49で全員の練習データを確認できます。14日無料試用どうぞ」
 *
 * Note: gym = gym_name フィールド。schemas では profiles.gym カラムを使用。
 */

type Stats = {
  totalCount: number;
  totalMinutes: number;
  techniqueCount: number;
};

type Props = {
  userId: string;
  hideAccount?: boolean;
};

function getLocalDateString(): string {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

function calcBjjMonths(startDate: string): number {
  return Math.floor(
    (new Date().getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24 * 30)
  );
}

function DeleteAccountSection({ userId, supabase }: { userId: string; supabase: SupabaseClient }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    await supabase.from("training_logs").delete().eq("user_id", userId);
    await supabase.from("techniques").delete().eq("user_id", userId);
    await supabase.from("profiles").delete().eq("id", userId);
    await supabase.auth.signOut();
    router.push("/?deleted=1");
  };

  if (!confirm) {
    return (
      <div className="mt-10 border-t border-white/10 pt-6">
        <h3 className="text-gray-500 text-xs uppercase tracking-wider mb-3">アカウント</h3>
        <button type="button" onClick={() => setConfirm(true)} className="text-red-500 hover:text-red-400 text-sm underline">
          退会する（データをすべて削除）
        </button>
      </div>
    );
  }

  return (
    <div className="mt-10 border-t border-white/10 pt-6">
      <h3 className="text-gray-500 text-xs uppercase tracking-wider mb-3">アカウント</h3>
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
        <p className="text-red-400 text-sm font-semibold mb-1">本当に退会しますか？</p>
        <p className="text-gray-400 text-xs mb-4">
          練習記録・テクニックノート・プロフィールがすべて削除されます。この操作は取り消せません。
        </p>
        <div className="flex gap-3">
          <button type="button" onClick={handleDelete} disabled={deleting} className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold py-2 rounded-lg text-sm">
            {deleting ? "削除中..." : "はい、退会します"}
          </button>
          <button type="button" onClick={() => setConfirm(false)} className="flex-1 bg-white/10 hover:bg-white/15 text-gray-300 font-bold py-2 rounded-lg text-sm">
            キャンセル
          </button>
        </div>
      </div>
    </div>
  );
}

const BELTS = [
  { value: "white", label: "白帯", color: "bg-white text-gray-900" },
  { value: "blue", label: "青帯", color: "bg-blue-500 text-white" },
  { value: "purple", label: "紫帯", color: "bg-purple-600 text-white" },
  { value: "brown", label: "茶帯", color: "bg-amber-800 text-white" },
  { value: "black", label: "黒帯", color: "bg-gray-900 text-white border border-white/10" },
];

function ProfileViewCard({ profile, stats, onEdit }: { profile: Profile; stats: Stats | null; onEdit: () => void }) {
  const beltInfo = BELTS.find((b) => b.value === profile.belt);
  return (
    <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 rounded-xl p-5 border border-white/10">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs text-gray-500 uppercase tracking-wider">プロフィール</h3>
        <button onClick={onEdit} className="text-xs text-[#e94560] hover:text-red-400 border border-[#e94560]/40 hover:border-[#e94560] rounded-lg px-3 py-1 transition-colors">
          ✏️ 編集
        </button>
      </div>
      <div className="flex items-center gap-3 mb-4">
        <span className={"px-5 py-1.5 rounded-full text-sm font-bold " + (beltInfo?.color ?? "")}>
          {beltInfo?.label}
        </span>
        <div className="flex gap-1">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className={"w-3 h-3 rounded-full border-2 " + (s <= profile.stripe ? "bg-white border-white" : "bg-transparent border-white/10")} />
          ))}
        </div>
        <span className="text-gray-400 text-xs">{profile.stripe}本線</span>
      </div>
      <div className="space-y-2">
        {profile.gym && (
          <div className="flex items-center gap-2 text-sm text-gray-300">
            <span className="text-gray-500">🏗</span>
            <span>{profile.gym}</span>
          </div>
        )}
        {profile.start_date && (
          <div className="flex items-center gap-2 text-sm text-gray-300">
            <span className="text-gray-500">🥋</span>
            <span>BJJ歴 {calcBjjMonths(profile.start_date)}ヶ月</span>
            <span className="text-gray-600 text-xs">（{profile.start_date} ～）</span>
          </div>
        )}
        {!profile.gym && !profile.start_date && (
          <p className="text-gray-600 text-xs">ジム・開始日が未設定です</p>
        )}
      </div>
      {profile.bio && (
        <p className="text-gray-400 text-sm mt-3 border-t border-white/10/60 pt-3 leading-relaxed">{profile.bio}</p>
      )}
      {stats && (
        <div className="mt-4 pt-4 border-t border-white/10/60 grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-lg font-bold text-[#e94560]">{stats.totalCount}</div>
            <div className="text-[10px] text-gray-500">総練習回</div>
          </div>
          <div>
            <div className="text-lg font-bold text-blue-400">
              {stats.totalMinutes >= 60 ? Math.floor(stats.totalMinutes / 60) + "h" : stats.totalMinutes + "m"}
            </div>
            <div className="text-[10px] text-gray-500">総練習時間</div>
          </div>
          <div>
            <div className="text-lg font-bold text-purple-400">{stats.techniqueCount}</div>
            <div className="text-[10px] text-gray-500">テクニック</div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProfileEditForm({ profile, onSave, onCancel }: { profile: Profile; onSave: (updated: Profile) => void; onCancel: () => void }) {
  const [form, setForm] = useState<Profile>(profile);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const today = getLocalDateString();
  const supabase = createClient();
  const currentBelt = BELTS.find((b) => b.value === form.belt);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (form.start_date && form.start_date > today) {
      setFormError("BJJ開始日に未来の日付は設定できません");
      return;
    }
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setFormError("ログイン情報が取得できませんでした");
      setLoading(false);
      return;
    }
    const { error } = await supabase.from("profiles").upsert(
      {
        id: user.id,
        belt: form.belt,
        stripe: form.stripe,
        gym: form.gym,          // existing column
        // gym_name: form.gym,  // TODO: add gym_name column via migration when B2B aggregation query is activated
        bio: form.bio,
        start_date: form.start_date || null,
      },
      { onConflict: "id" }
    );
    if (!error) {
      setToast({ message: "プロフィールを保存しました！", type: "success" });
      setTimeout(() => { setToast(null); onSave(form); }, 1200);
    } else {
      setToast({ message: "保存に失敗しました: " + (error.message || error.code || "不明なエラー"), type: "error" });
    }
    setLoading(false);
  };

  return (
    <>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <form onSubmit={handleSave} className="space-y-5">
        <div className="bg-zinc-900 rounded-xl p-5 border border-white/10 text-center">
          <div className="inline-flex items-center gap-3 mb-1">
            <span className={"px-6 py-2 rounded-full text-sm font-bold " + (currentBelt?.color ?? "")}>{currentBelt?.label}</span>
            <div className="flex gap-1">
              {[1, 2, 3, 4].map((s) => (
                <div key={s} className={"w-3 h-3 rounded-full border-2 " + (s <= form.stripe ? "bg-white border-white" : "bg-transparent border-white/10")} />
              ))}
            </div>
          </div>
          <p className="text-gray-400 text-xs">{form.stripe}本線 · {currentBelt?.label}</p>
        </div>
        <div className="bg-zinc-900 rounded-xl p-4 border border-white/10">
          <label className="block text-gray-300 text-sm font-medium mb-3">帯</label>
          <div className="grid grid-cols-5 gap-2">
            {BELTS.map((belt) => (
              <button key={belt.value} type="button" onClick={() => setForm({ ...form, belt: belt.value })}
                className={"py-2 rounded-lg text-xs font-semibold transition-all " + belt.color + " " + (form.belt === belt.value ? "ring-2 ring-[#e94560] scale-105" : "opacity-60 hover:opacity-90")}>
                {belt.label}
              </button>
            ))}
          </div>
        </div>
        <div className="bg-zinc-900 rounded-xl p-4 border border-white/10">
          <label className="block text-gray-300 text-sm font-medium mb-3">ライン数 (0～4)</label>
          <div className="flex gap-2">
            {[0, 1, 2, 3, 4].map((s) => (
              <button key={s} type="button" onClick={() => setForm({ ...form, stripe: s })}
                className={"flex-1 py-2 rounded-lg text-sm font-semibold transition-all " + (form.stripe === s ? "bg-[#e94560] text-white" : "bg-zinc-800 text-gray-400 hover:text-white")}>
                {s}
              </button>
            ))}
          </div>
        </div>
        <div className="bg-zinc-900 rounded-xl p-4 border border-white/10">
          <label className="block text-gray-300 text-sm font-medium mb-1">道場・ジム名</label>
          <p className="text-gray-600 text-[10px] mb-2">同じジムの仲間を繋ぐために使われます</p>
          <input type="text" value={form.gym} onChange={(e) => setForm({ ...form, gym: e.target.value })} placeholder="例: Gracie Academy Tokyo" className="w-full bg-zinc-800 text-white rounded-lg px-3 py-2 text-sm border border-white/10 focus:outline-none focus:border-[#7c3aed]" />
        </div>
        <div className="bg-zinc-900 rounded-xl p-4 border border-white/10">
          <label className="block text-gray-300 text-sm font-medium mb-2">BJJ開始日</label>
          <input type="date" value={form.start_date} max={today} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className="w-full bg-zinc-800 text-white rounded-lg px-3 py-2 text-sm border border-white/10 focus:outline-none focus:border-[#7c3aed]" />
          {form.start_date && <p className="text-gray-500 text-xs mt-1">BJJ歴: {calcBjjMonths(form.start_date)}ヶ月</p>}
        </div>
        <div className="bg-zinc-900 rounded-xl p-4 border border-white/10">
          <label className="block text-gray-300 text-sm font-medium mb-2">目標・メモ</label>
          <textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} placeholder="目標、得意なポジション、練習への想いなど..." rows={3} className="w-full bg-zinc-800 text-white rounded-lg px-3 py-2 text-sm border border-white/10 focus:outline-none focus:border-[#7c3aed] resize-none" />
        </div>
        {formError && <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">{formError}</div>}
        <div className="flex gap-3">
          <button type="submit" disabled={loading} className="flex-1 bg-[#e94560] hover:bg-[#c73652] disabled:opacity-50 text-white font-bold py-3 rounded-xl text-sm transition-colors">
            {loading ? "保存中..." : "保存する"}
          </button>
          <button type="button" onClick={onCancel} className="flex-1 bg-zinc-900 hover:bg-white/5 text-gray-300 font-bold py-3 rounded-xl text-sm border border-white/10 transition-colors">
            キャンセル
          </button>
        </div>
      </form>
    </>
  );
}

export default function ProfileForm({ userId, hideAccount }: Props) {
  const [profile, setProfile] = useState<Profile>({ belt: "white", stripe: 0, gym: "", bio: "", start_date: "" });
  const [stats, setStats] = useState<Stats | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    const loadProfile = async () => {
      setInitialLoading(true);
      const [profileRes, logsRes, techRes] = await Promise.all([
        supabase.from("profiles").select("belt, stripe, gym, bio, start_date").eq("id", userId).single(),
        supabase.from("training_logs").select("duration_min").eq("user_id", userId),
        supabase.from("techniques").select("*", { count: "exact", head: true }).eq("user_id", userId),
      ]);
      if (profileRes.data) {
        setProfile({
          belt: profileRes.data.belt || "white",
          stripe: profileRes.data.stripe || 0,
          gym: profileRes.data.gym || "",
          bio: profileRes.data.bio || "",
          start_date: profileRes.data.start_date || "",
        });
      } else {
        setIsEditing(true);
      }
      if (logsRes.data) {
        setStats({
          totalCount: logsRes.data.length,
          totalMinutes: logsRes.data.reduce((s: number, l: { duration_min: number }) => s + (l.duration_min || 0), 0),
          techniqueCount: techRes.count ?? 0,
        });
      }
      setInitialLoading(false);
    };
    loadProfile();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  if (initialLoading) {
    return (
      <div className="text-center py-8 text-gray-500">
        <div className="inline-block w-6 h-6 border-2 border-white/10 border-t-[#e94560] rounded-full animate-spin mb-2" />
        <p className="text-sm">読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {isEditing ? (
        <>
          <div className="flex items-center gap-2 mb-2">
            <h2 className="text-white font-semibold text-sm">プロフィールを編集</h2>
          </div>
          <ProfileEditForm profile={profile} onSave={(updated) => { setProfile(updated); setIsEditing(false); }} onCancel={() => setIsEditing(false)} />
        </>
      ) : (
        <ProfileViewCard profile={profile} stats={stats} onEdit={() => setIsEditing(true)} />
      )}
      {!hideAccount && <DeleteAccountSection userId={userId} supabase={supabase} />}
    </div>
  );
}
