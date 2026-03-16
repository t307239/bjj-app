"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Toast from "./Toast";

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

const BELTS = [
  { value: "white", label: "白帯", color: "bg-white text-gray-900" },
  { value: "blue", label: "青帯", color: "bg-blue-500 text-white" },
  { value: "purple", label: "紫帯", color: "bg-purple-600 text-white" },
  { value: "brown", label: "茶帯", color: "bg-amber-800 text-white" },
  { value: "black", label: "黒帯", color: "bg-gray-900 text-white border border-gray-600" },
];

export default function ProfileForm({ userId }: Props) {
  const [profile, setProfile] = useState<Profile>({
    belt: "white",
    stripe: 0,
    gym: "",
    bio: "",
    start_date: "",
  });
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const today = new Date().toISOString().split("T")[0];
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
      }
      setInitialLoading(false);
    };
    loadProfile();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSaved(false);

    // バリデーション
    if (profile.start_date && profile.start_date > today) {
      setFormError("BJJ開始日に未来の日付は設定できません");
      return;
    }

    setLoading(true);

    const { error } = await supabase
      .from("profiles")
      .upsert({ id: userId, ...profile, updated_at: new Date().toISOString() });

    if (!error) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      setToast({ message: "プロフィールを保存しました！", type: "success" });
    } else {
      setToast({ message: "保存に失敗しました", type: "error" });
    }
    setLoading(false);
  };

  const currentBelt = BELTS.find((b) => b.value === profile.belt);

  if (initialLoading) {
    return (
      <div className="text-center py-8 text-gray-500">
        <div className="inline-block w-6 h-6 border-2 border-gray-600 border-t-[#e94560] rounded-full animate-spin mb-2" />
        <p className="text-sm">読み込み中...</p>
      </div>
    );
  }

  return (
    <>
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
      <form onSubmit={handleSave} className="space-y-6">
      {/* 帯表示 */}
      <div className="bg-[#16213e] rounded-xl p-6 border border-gray-700 text-center">
        <div className="inline-flex items-center gap-3 mb-2">
          <span
            className={`px-6 py-2 rounded-full text-sm font-bold ${currentBelt?.color}`}
          >
            {currentBelt?.label}
          </span>
          <div className="flex gap-1">
            {[1, 2, 3, 4].map((s) => (
              <div
                key={s}
                className={`w-3 h-3 rounded-full border-2 ${
                  s <= profile.stripe
                    ? "bg-white border-white"
                    : "bg-transparent border-gray-600"
                }`}
              />
            ))}
          </div>
        </div>
        <p className="text-gray-400 text-xs">
          {profile.stripe}本線 · {currentBelt?.label}
        </p>
      </div>

      {/* 帯選択 */}
      <div className="bg-[#16213e] rounded-xl p-4 border border-gray-700">
        <label className="block text-gray-300 text-sm font-medium mb-3">帯</label>
        <div className="grid grid-cols-5 gap-2">
          {BELTS.map((belt) => (
            <button
              key={belt.value}
              type="button"
              onClick={() => setProfile({ ...profile, belt: belt.value })}
              className={`py-2 rounded-lg text-xs font-semibold transition-all ${belt.color} ${
                profile.belt === belt.value
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
        <label className="block text-gray-300 text-sm font-medium mb-3">
          ライン数 (0〜4)
        </label>
        <div className="flex gap-2">
          {[0, 1, 2, 3, 4].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setProfile({ ...profile, stripe: s })}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                profile.stripe === s
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
        <label className="block text-gray-300 text-sm font-medium mb-2">
          道場・ジム名
        </label>
        <input
          type="text"
          value={profile.gym}
          onChange={(e) => setProfile({ ...profile, gym: e.target.value })}
          placeholder="例: Gracie Academy Tokyo"
          className="w-full bg-[#0f3460] text-white rounded-lg px-3 py-2 text-sm border border-gray-600 focus:outline-none focus:border-blue-400"
        />
      </div>

      {/* BJJ開始日 */}
      <div className="bg-[#16213e] rounded-xl p-4 border border-gray-700">
        <label className="block text-gray-300 text-sm font-medium mb-2">
          BJJ開始日
        </label>
        <input
          type="date"
          value={profile.start_date}
          max={today}
          onChange={(e) => setProfile({ ...profile, start_date: e.target.value })}
          className="w-full bg-[#0f3460] text-white rounded-lg px-3 py-2 text-sm border border-gray-600 focus:outline-none focus:border-blue-400"
        />
        {profile.start_date && (
          <p className="text-gray-500 text-xs mt-1">
            BJJ歴:{" "}
            {Math.floor(
              (new Date().getTime() - new Date(profile.start_date).getTime()) /
                (1000 * 60 * 60 * 24 * 30)
            )}
            ヶ月
          </p>
        )}
      </div>

      {/* 自己紹介 */}
      <div className="bg-[#16213e] rounded-xl p-4 border border-gray-700">
        <label className="block text-gray-300 text-sm font-medium mb-2">
          目標・メモ
        </label>
        <textarea
          value={profile.bio}
          onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
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

      {/* 保存ボタン */}
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-[#e94560] hover:bg-[#c73652] disabled:opacity-50 text-white font-bold py-3 rounded-xl text-sm transition-colors"
      >
        {loading ? "保存中..." : saved ? "✓ 保存しました" : "プロフィールを保存"}
      </button>
    </form>
    </>
  );
}
