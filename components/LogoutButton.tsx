"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useLocale } from "@/lib/i18n";

export default function LogoutButton() {
  const router = useRouter();
  const { t } = useLocale();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  return (
    <button
      onClick={handleLogout}
      className="text-gray-400 hover:text-white text-sm transition-colors px-2 py-1 rounded"
    >
      {t("nav.logout")}
    </button>
  );
}
