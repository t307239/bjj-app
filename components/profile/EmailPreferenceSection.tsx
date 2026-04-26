"use client";

/**
 * EmailPreferenceSection — z188: Settings 内 email 配信制御 UI
 *
 * Top app reference (Notion / Linear / Stripe):
 *   - Single switch per category (marketing / product / billing)
 *   - Immediate save on toggle (no separate "Save" button)
 *   - Clear language about what each category includes
 *   - GDPR Art 7-3: withdrawal must be as easy as giving consent
 *
 * BJJ App では現状 marketing と service の 2 区分:
 *   - marketing: gym-outreach (z177) / onboarding-email (z186) / 将来の promotion
 *   - service: weekly-email (記録ベース) は別 (notification_preferences で管理)
 */

import { useState, useEffect } from "react";
import { useLocale } from "@/lib/i18n";

export default function EmailPreferenceSection() {
  const { t } = useLocale();
  const [optedOut, setOptedOut] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/profile/email-preferences");
        const data = (await res.json()) as { email_marketing_opted_out?: boolean; error?: string };
        if (cancelled) return;
        if (!res.ok || data.error) {
          setError(data.error ?? "load_failed");
          return;
        }
        setOptedOut(Boolean(data.email_marketing_opted_out));
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const onToggle = async (newOptedOut: boolean) => {
    const prev = optedOut;
    setOptedOut(newOptedOut); // optimistic UI
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/profile/email-preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opted_out: newOptedOut }),
      });
      if (!res.ok) {
        setOptedOut(prev); // rollback
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "save_failed");
      }
    } catch (e) {
      setOptedOut(prev);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  if (optedOut === null) {
    return (
      <div className="bg-zinc-900/60 border border-white/8 rounded-xl px-4 py-3 animate-pulse">
        <div className="h-5 w-32 bg-white/10 rounded mb-2" />
        <div className="h-4 w-48 bg-white/5 rounded" />
      </div>
    );
  }

  // Marketing emails ENABLED when NOT opted_out
  const enabled = !optedOut;

  return (
    <div className="bg-zinc-900/60 border border-white/8 rounded-xl px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <svg aria-hidden="true" className="w-4 h-4 text-zinc-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
            <p className="text-sm font-semibold text-white">{t("settings.emailPrefTitle")}</p>
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed">
            {t("settings.emailPrefDesc")}
          </p>
          {error && (
            <p role="alert" className="text-xs text-red-400 mt-1">
              {t("common.error")}: {error}
            </p>
          )}
        </div>

        {/* Toggle switch */}
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label={t("settings.emailPrefToggle")}
          disabled={saving}
          onClick={() => onToggle(!enabled ? false : true)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 mt-1 ${
            enabled ? "bg-emerald-600" : "bg-zinc-600"
          } ${saving ? "opacity-50 cursor-wait" : "cursor-pointer"}`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
              enabled ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>
    </div>
  );
}
