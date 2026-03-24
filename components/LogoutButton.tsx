"use client";

import { useState } from "react";
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
  const supabase = createClient();
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
    <button
      onClick={handleLogout}
      disabled={isLoading}
      className={className ?? "text-gray-400 hover:text-white text-sm transition-colors px-2 py-1 rounded disabled:opacity-60"}
    >
      {isLoading ? t("nav.loggingOut") : t("nav.logout")}
    </button>
  );
}
