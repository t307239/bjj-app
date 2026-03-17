"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/lib/i18n";

const STORAGE_KEY = "bjj_guest_logs";

type GuestLog = {
  id: string;
  date: string;
  duration_min: number;
  type: string;
  notes: string;
  created_at: string;
};

export default function GuestMigration({ userId }: { userId: string }) {
  const [migrated, setMigrated] = useState(0);
  const [show, setShow] = useState(false);
  const { t } = useLocale();

  useEffect(() => {
    const migrate = async () => {
      if (typeof window === "undefined") return;

      let guestLogs: GuestLog[] = [];
      try {
        guestLogs = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      } catch {
        return;
      }
      if (guestLogs.length === 0) return;

      const supabase = createClient();
      const rows = guestLogs.map((log) => ({
        user_id: userId,
        date: log.date,
        duration_min: log.duration_min,
        type: log.type,
        notes: log.notes || "",
      }));

      const { error } = await supabase.from("training_logs").insert(rows);
      if (!error) {
        localStorage.removeItem(STORAGE_KEY);
        setMigrated(guestLogs.length);
        setShow(true);
        setTimeout(() => setShow(false), 5000);
      }
    };

    // マウント後に少し待ってから実行（セッション確立を確実に待つ）
    const timer = setTimeout(migrate, 500);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  if (!show || migrated === 0) return null;

  return (
    <div className="fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4">
      <div className="bg-green-600 text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-2 text-sm font-medium">
        <span>{t("guest.migrated", { n: migrated })}</span>
      </div>
    </div>
  );
}
