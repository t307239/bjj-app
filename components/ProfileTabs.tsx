"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import PersonalBests from "./PersonalBests";
import ProfileForm from "./ProfileForm";

function AccountSection({ userId }: { userId: string }) {
  const supabase = createClient();
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

  return (
    <div className="space-y-4">
      <div className="bg-[#16213e] rounded-xl p-5 border border-gray-700">
        <h3 className="text-gray-400 text-sm font-semibold mb-3">アプリ設定</h3>
        <p className="text-gray-600 text-xs">今後の設定項目がここに追加されます。</p>
      </div>
      <div className="bg-[#16213e] rounded-xl p-5 border border-red-900/30">
        <h3 className="text-red-500/70 text-xs uppercase tracking-wider mb-3">危険な操作</h3>
        {!confirm ? (
          <button
            type="button"
            onClick={() => setConfirm(true)}
            className="text-red-500 hover:text-red-400 text-sm underline"
          >
            退会する（データをすべて削除）
          </button>
        ) : (
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
        )}
      </div>
    </div>
  );
}

const TABS = [
  { id: "stats", label: "📊 統計" },
  { id: "profile", label: "✏️ プロフィール" },
  { id: "account", label: "⚙️ 設定" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function ProfileTabs({ userId }: { userId: string }) {
  const [activeTab, setActiveTab] = useState<TabId>("stats");

  return (
    <div>
      <div className="flex gap-1 bg-[#16213e] rounded-xl p-1 mb-6 border border-gray-700">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === tab.id
                ? "bg-[#e94560] text-white shadow"
                : "text-gray-400 hover:text-white"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {activeTab === "stats" && <PersonalBests userId={userId} />}
      {activeTab === "profile" && <ProfileForm userId={userId} hideAccount />}
      {activeTab === "account" && <AccountSection userId={userId} />}
    </div>
  );
}
