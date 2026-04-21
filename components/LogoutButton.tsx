"use client";

import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useLocale } from "@/lib/i18n";

type Props = {
  onDone?: () => void;
  className?: string;
};

export default function LogoutButton({ onDone, className }: Props) {
  const router = useRouter();
  const { t } = useLocale();
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;
  const [isLoading, setIsLoading] = useState(false);

  const handleLogout = async () => {
    if (isLoading) return;
    setIsLoading(true);
    onDone?.();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  return (
    <button type="button"
      onClick={handleLogout}
      disabled={isLoading}
      className={className ?? "flex items-center gap-1.5 text-zinc-400 hover:text-white text-sm transition-colors px-2 py-1 rounded disabled:opacity-60"}
    >
      {isLoading && (
        <svg aria-hidden="true" className="animate-spin h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
      )}
      {isLoading ? t("nav.loggingOut") : t("nav.logout")}
    </button>
  );
}
