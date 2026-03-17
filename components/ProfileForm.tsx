"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Toast from "./Toast";
import type { SupabaseClient } from "@supabase/supabase-js";

type Profile = {
  belt: string;
  stripe: number;
  gym: string;
  bio: string;
  start_date: string;
};

type Props = {
  userId: string;
};

// JST対応: toISOString()はUTCなので、ローカル日付を返すヘルパー
function getLocalDateString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
      <div className="mt-10 border-t border-gray-800 pt-6">
        <h3 className="text-gray-500 text-xs uppercase tracking-wider mb-3">アカウント</h3>
        <button
          type="button"
          onClick={() => setConfirm(true)}
          className="text-red-500 hover:text-red-400 text-sm underline"
        >
          退会する（データをすべて削除）
        </button>
      </div>
    );
  }

  return (
    <div className="mt-10 border-t border-gray-800 pt-6">
      <h3 className="text-gray-500 text-xs uppercase tracking-wider mb-3">アカウント</h3>
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
        <p className="text-red-400 text-sm font-semibold mb-1">本当に退会しますか？</p>
        <p className="text-gray-400 text-xs mb-4">
          練習記録・テクニックノート・プロフィールがすべて削除されます。この操作は取り消せません。
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold py-2 rounded-lg text-sm"
          >
            {deleting ? "削除中..." : "はい、退会します"}
          </button>
          <button
            type="button"
            onClick={() => setConfirm(false)}
            className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-300 font-bold py-2 rounded-lg text-sm"
          >
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
  { value: "black", label: "黒帯", color: "bg-gray-900 text-white border border-gray-600" },
];

// --- プロフィール表示カード（閲覧モード）---
function ProfileViewCard({
  profile,
  onEdit,
}: {
  profile: Profile;
  onEdit: () => void;
}) {
  const beltInfo = BELTS.find((b) => b.value === profile.belt);
  return (
    <div className="bg-gradient-to-br from-[#16213e] to-[#0f3460] rounded-xl p-5 border border-gray-700">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs text-gray-500 uppercase tracking-wider">プロフィール</h3>
        <button
          onClick={onEdit}
          className="text-xs text-[#e94560] hover:text-red-400 border border-[#e94560]/40 hover:border-[#e94560] rounded-lg px-3 py-1 transition-colors"
        >
          ✏️ 編集
        </button>
      </div>

      {/* 帯 + ライン */}
      <div className="flex items-center gap-3 mb-4">
        <span className={`px-5 py-1.5 rounded-full text-sm font-bold ${beltInfo?.color}`}>
          {beltInfo?.label}
        </span>
        <div className="flex gap-1">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={`w-3 h-3 rounded-full border-2 ${
                s <= profile.stripe ? "bg-white border-white" : "bg-transparent border-gray-600"
              }`}
            />
          ))}
        </div>
        <span className="text-gray-400 text-xs">{profile.stripe}本線</span>
      </div>

      {/* 詳細情報 */}
      <div className="space-y-2">
        {profile.gym && (
          <div className="flex items-center gap-2 text-sm text-gray-300">
            <span className="text-gray-500">🏛</span>
            <span>{profile.gym}</span>
          </div>
        )}
        {profile.start_date && (
          <div className="flex items-center gap-2 text-sm text-gray-300">
            <span className="text-gray-500">🥋</span>
            <span>BJJ歴 {calcBjjMonths(profile.start_date)}ヶ月</span>
            <span className="text-gray-600 text-xs">（{profile.start_date} 〜）</span>
          </div>
        )}
        {!profile.gym && !profile.start_date && (
          <p className="text-gray-600 text-xs">ジム・開始日が未設定です</p>
        )}
      </div>

      {/* 目標メモ */}
      {profile.bio && (
        <p className="text-gray-400 text-sm mt-3 border-t border-gray-700/60 pt-3 leading-relaxed">
          {profile.bio}
        </p>
      )}
    </div>
  );
}

// --- プロフィール編集フォーム ---
function ProfileEditForm({
  profile,
  onSave,
  onCancel,
}: {
  profile: Profile;
  onSave: (updated: Profile) => void;
  onCancel: () => void;
}) {
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

    // fix: start_date が空文字列 "" だと PostgreSQL の date 型でエラーになるため null に変換
    const { error } = await supabase
      .from("profiles")
      .upsert(
        {
          id: user.id,
          belt: form.belt,
          stripe: form.stripe,
          gym: form.gym,
          bio: form.bio,
          start_date: form.start_date || null,
        },
        { onConflict: "id" }
      );

    if (!error) {
      setToast({ message: "プロフィールを保存しました！", type: "success" });
      setTimeout(() => {
        setToast(null);
        onSave(form);
      }, 1200);
    } else {
      console.error("Profile save error:", error);
      setToast({ message: `保存に失敗しました: ${error.message || error.code || "不明なエラー"}`, type: "error" });
    }
    setLoading(false);
  };

  return (
    <>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <form onSubmit={handleSave} className="space-y-5">
        {/* 帯プレビュー */}
        <div className="bg-[#16213e] rounded-xl p-5 border border-gray-700 text-center">
          <div className="inline-flex items-center gap-3 mb-1">
            <span className={`px-6 py-2 rounded-full text-sm font-bold ${currentBelt?.color}`}>
              {currentBelt?.label}
            </span>
            <div className="flex gap-1">
              {[1, 2, 3, 4].map((s) => (
                <div
                  key={s}
                  className={`w-3 h-3 rounded-full border-2 ${
                    s <= form.stripe ? "bg-white border-white" : "bg-transparent border-gray-600"
                  }`}
                />
              ))}
            </div>
          </div>
          <p className="text-gray-400 text-xs">{form.stripe}本線 · {currentBelt?.label}</p>
        </div>

        {/* 帯選択 */}
        <div className="bg-[#16213e] rounded-xl p-4 border border-gray-700">
          <label className="block text-gray-300 text-sm font-medium mb-3">帯</label>
          <div className="grid grid-cols-5 gap-2">
            {BELTS.map((belt) => (
              <button
                key={belt.value}
                type="button"
                onClick={() => setForm({ ...form, belt: belt.value })}
                className={`py-2 rounded-lg text-xs font-semibold transition-all ${belt.color} ${
                  form.belt === belt.value
                    ? "ring-2 ring-[#e94560] scale-105"
                    : "opacity-60 hover:opacity-90"
                }`}
              >
                {belt.label}
              </button>
            ))}
          </div>
        </div>

        {/* ライン数 */}
        <div className="bg-[#16213e] rounded-xl p-4 border border-gray-700">
          <label className="block text-gray-300 text-sm font-medium mb-3">ライン数 (0〜4)</label>
          <div className="flex gap-2">
            {[0, 1, 2, 3, 4].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setForm({ ...form, stripe: s })}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                  form.stripe === s
                    ? "bg-[#e94560] text-white"
                    : "bg-[#0f3460] text-gray-400 hover:text-white"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* ジム名 */}
        <div className="bg-[#16213e] rounded-xl p-4 border border-gray-700">
          <label className="block text-gray-300 text-sm font-medium mb-2">道場・ジム名</label>
          <input
            type="text"
            value={form.gym}
            onChange={(e) => setForm({ ...form, gym: e.target.value })}
            placeholder="例: Gracie Academy Tokyo"
            className="w-full bg-[#0f3460] text-white rounded-lg px-3 py-2 text-sm border border-gray-600 focus:outline-none focus:border-blue-400"
          />
        </div>

        {/* BJJ開始日 */}
        <div className="bg-[#16213e] rounded-xl p-4 border border-gray-700">
          <label className="block text-gray-300 text-sm font-medium mb-2">BJJ開始日</label>
          <input
            type="date"
            value={form.start_date}
            max={today}
            onChange={(e) => setForm({ ...form, start_date: e.target.value })}
            className="w-full bg-[#0f3460] text-white rounded-lg px-3 py-2 text-sm border border-gray-600 focus:outline-none focus:border-blue-400"
          />
          {form.start_date && (
            <p className="text-gray-500 text-xs mt-1">
              BJJ歴: {calcBjjMonths(form.start_date)}ヶ月
            </p>
          )}
        </div>

        {/* 目標・メモ */}
        <div className="bg-[#16213e] rounded-xl p-4 border border-gray-700">
          <label className="block text-gray-300 text-sm font-medium mb-2">目標・メモ</label>
          <textarea
            value={form.bio}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
            placeholder="目標、得意なポジション、練習への想いなど..."
            rows={3}
            className="w-full bg-[#0f3460] text-white rounded-lg px-3 py-2 text-sm border border-gray-600 focus:outline-none focus:border-blue-400 resize-none"
          />
        </div>

        {/* バリデーションエラー */}
        {formError && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">
            {formError}
          </div>
        )}

        {/* ボタン */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-[#e94560] hover:bg-[#c73652] disabled:opacity-50 text-white font-bold py-3 rounded-xl text-sm transition-colors"
          >
            {loading ? "保存中..." : "保存する"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 bg-[#16213e] hover:bg-[#1a2a4a] text-gray-300 font-bold py-3 rounded-xl text-sm border border-gray-700 transition-colors"
          >
            キャンセル
          </button>
        </div>
      </form>
    </>
  );
}

// --- メインコンポーネント ---
export default function ProfileForm({ userId }: Props) {
  const [profile, setProfile] = useState<Profile>({
    belt: "white",
    stripe: 0,
    gym: "",
    bio: "",
    start_date: "",
  });
  const [initialLoading, setInitialLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    const loadProfile = async () => {
      setInitialLoading(true);
      const { data } = await supabase
        .from("profiles")
        .select("belt, stripe, gym, bio, start_date")
        .eq("id", userId)
        .single();

      if (data) {
        setProfile({
          belt: data.belt || "white",
          stripe: data.stripe || 0,
          gym: data.gym || "",
          bio: data.bio || "",
          start_date: data.start_date || "",
        });
      } else {
        // プロフィール未設定 → 編集モードを開く
        setIsEditing(true);
      }
      setInitialLoading(false);
    };
    loadProfile();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  if (initialLoading) {
    return (
      <div className="text-center py-8 text-gray-500">
        <div className="inline-block w-6 h-6 border-2 border-gray-600 border-t-[#e94560] rounded-full animate-spin mb-2" />
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
          <ProfileEditForm
            profile={profile}
            onSave={(updated) => {
              setProfile(updated);
              setIsEditing(false);
            }}
            onCancel={() => setIsEditing(false)}
          />
        </>
      ) : (
        <ProfileViewCard
          profile={profile}
          onEdit={() => setIsEditing(true)}
        />
      )}

      {/* 退会セクション（常時表示） */}
      <DeleteAccountSection userId={userId} supabase={supabase} />
    </div>
  );
}
