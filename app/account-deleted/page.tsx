"use client";
import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useLocale } from "@/lib/i18n";

export default function AccountDeletedPage() {
  const { t } = useLocale();
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;
  const router = useRouter();
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRestore = async () => {
    setRestoring(true);
    setError(null);
    try {
      const res = await fetch("/api/account/restore", { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? t("profile.restoreError"));
        setRestoring(false);
        return;
      }
      router.push("/dashboard");
    } catch {
      setError(t("profile.deleteNetworkError"));
      setRestoring(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div className="text-5xl">🗑️</div>
        <div className="space-y-2">
          <h1 className="text-xl font-bold text-white">{t("profile.accountDeletedTitle")}</h1>
          <p className="text-zinc-400 text-sm leading-relaxed">{t("profile.restoreDesc")}</p>
        </div>

        {error && (
          <p className="text-red-400 text-sm bg-red-950/30 border border-red-800/40 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="space-y-3">
          <button type="button"
            onClick={handleRestore}
            disabled={restoring}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold py-3 rounded-xl text-sm transition-colors active:scale-95"
          >
            {restoring ? t("profile.restoring") : t("profile.restoreBtn")}
          </button>
          <button type="button"
            onClick={handleSignOut}
            className="w-full bg-white/8 hover:bg-white/12 text-zinc-400 font-medium py-3 rounded-xl text-sm transition-colors"
          >
            {t("nav.logout")}
          </button>
        </div>
      </div>
    </div>
  );
}
