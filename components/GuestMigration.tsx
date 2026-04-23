"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/lib/i18n";
import { clientLogger } from "@/lib/clientLogger";

const STORAGE_KEY = "bjj_guest_logs";

type GuestLog = {
  id: string;
  date: string;
  duration_min: number;
  type: string;
  notes: string;
  created_at: string;
};

type ToastState =
  | { kind: "idle" }
  | { kind: "success"; count: number }
  | { kind: "failed"; count: number };

export default function GuestMigration({ userId }: { userId: string }) {
  const [toast, setToast] = useState<ToastState>({ kind: "idle" });
  const { t } = useLocale();
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const retryingRef = useRef(false);

  useEffect(() => {
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  const migrate = useCallback(async () => {
    if (typeof window === "undefined") return;
    if (retryingRef.current) return;
    retryingRef.current = true;

    try {
      let guestLogs: GuestLog[] = [];
      try {
        guestLogs = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      } catch (err: unknown) {
        clientLogger.error(
          "guest_migration.parse_failed",
          {},
          err instanceof Error ? err : new Error(String(err)),
        );
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

      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);

      if (!error) {
        localStorage.removeItem(STORAGE_KEY);
        setToast({ kind: "success", count: guestLogs.length });
        hideTimerRef.current = setTimeout(
          () => setToast({ kind: "idle" }),
          5000,
        );
      } else {
        // Keep localStorage so a future session (or explicit retry) can retry.
        clientLogger.error(
          "guest_migration.insert_failed",
          { count: rows.length },
          error,
        );
        setToast({ kind: "failed", count: guestLogs.length });
        // Do NOT auto-hide the error toast — user must see it and decide.
      }
    } finally {
      retryingRef.current = false;
    }
  }, [userId]);

  useEffect(() => {
    // マウント後に少し待ってから実行（セッション確立を確実に待つ）
    const timer = setTimeout(migrate, 500);
    return () => clearTimeout(timer);
  }, [migrate]);

  if (toast.kind === "idle") return null;

  if (toast.kind === "success") {
    return (
      <div
        role="status"
        aria-live="polite"
        className="fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4"
      >
        <div className="bg-green-600 text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-2 text-sm font-medium">
          <svg
            aria-hidden="true"
            className="w-4 h-4 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
          <span>{t("guest.migrated", { n: toast.count })}</span>
        </div>
      </div>
    );
  }

  // toast.kind === "failed"
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4"
    >
      <div className="bg-red-600 text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-3 text-sm font-medium">
        <svg
          aria-hidden="true"
          className="w-4 h-4 flex-shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
          />
        </svg>
        <span>{t("guest.migrationFailed", { n: toast.count })}</span>
        <button
          type="button"
          onClick={() => {
            setToast({ kind: "idle" });
            void migrate();
          }}
          className="ml-2 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold hover:bg-white/30 transition-colors"
        >
          {t("guest.migrationRetry")}
        </button>
      </div>
    </div>
  );
}
