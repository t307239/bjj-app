"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/lib/i18n";
import PushNotificationSection from "../PushNotificationSection";
import CsvExport from "../CsvExport";
import type { SupabaseClient } from "@supabase/supabase-js";

// Stripe Customer Portal URL — configure in .env.local (Stripe Dashboard > Customer Portal)
const CUSTOMER_PORTAL_URL = process.env.NEXT_PUBLIC_STRIPE_CUSTOMER_PORTAL_URL ?? "";

interface Props {
  userId: string;
  supabase: SupabaseClient;
}

export default function AccountSection({ userId, supabase }: Props) {
  const { t } = useLocale();
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);

  // ── Email change (self-serve) ─────────────────────────────────────────────
  const [emailEditing, setEmailEditing] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailMsg, setEmailMsg] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);

  // ── Display name change (self-serve) ────────────────────────────────────────
  const [nameEditing, setNameEditing] = useState(false);
  const [newName, setNewName] = useState("");
  const [nameSaving, setNameSaving] = useState(false);
  const [nameMsg, setNameMsg] = useState<string | null>(null);

  const handleNameChange = async () => {
    if (!newName.trim()) return;
    setNameSaving(true);
    setNameMsg(null);
    const { error } = await supabase.auth.updateUser({
      data: { full_name: newName.trim() },
    });
    if (error) {
      setNameMsg(error.message);
    } else {
      setNameMsg(t("profile.nameChanged"));
      setNewName("");
      setNameEditing(false);
      router.refresh();
    }
    setNameSaving(false);
  };

  const handleEmailChange = async () => {
    if (!newEmail || !newEmail.includes("@")) {
      setEmailError(t("profile.emailInvalid"));
      return;
    }
    setEmailSaving(true);
    setEmailError(null);
    setEmailMsg(null);
    const { error } = await supabase.auth.updateUser({ email: newEmail });
    if (error) {
      setEmailError(error.message);
    } else {
      setEmailMsg(t("profile.emailConfirmSent"));
      setNewEmail("");
    }
    setEmailSaving(false);
  };

  // ── CSV export (CCPA/GDPR Right to Data Portability) ────────────────────────
  const handleExportCsv = async () => {
    setExporting(true);
    const { data } = await supabase
      .from("training_logs")
      .select("date, type, duration_min, notes, created_at")
      .eq("user_id", userId)
      .order("date", { ascending: false });
    if (data) {
      const csv = [
        [t("profile.csvHeaderDate"), t("profile.csvHeaderType"), t("profile.csvHeaderDuration"), t("profile.csvHeaderNotes"), t("profile.csvHeaderCreatedAt")].join(","),
        ...data.map((r: { date: string; type: string; duration_min: number; notes: string; created_at: string }) => [
          r.date ?? "",
          r.type ?? "",
          r.duration_min ?? 0,
          `"${(r.notes ?? "").replace(/"/g, '""')}"`,
          r.created_at ?? "",
        ].join(",")),
      ].join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `bjjapp-logs-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
    setExporting(false);
  };

  // ── Account deletion (GDPR/CCPA Right to Erasure) ────────────────────────────
  const handleDelete = async () => {
    if (deleteInput !== "DELETE") return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch("/api/account/delete", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setDeleteError(body.error ?? t("profile.deleteError"));
        setDeleting(false);
        return;
      }
      await supabase.auth.signOut();
      router.push("/?deleted=1");
    } catch {
      setDeleteError(t("profile.deleteNetworkError"));
      setDeleting(false);
    }
  };

  return (
    <div className="mt-10 border-t border-white/10 pt-6 space-y-4">
      <h3 className="text-zinc-400 text-xs tracking-wider">{t("profile.account")}</h3>

      {/* Email change — self-serve (Axis 11 CS) */}
      <div className="bg-zinc-900/60 rounded-xl border border-white/10 px-4 py-3">
        {!emailEditing ? (
          <div className="flex items-center justify-between">
            <p className="text-zinc-400 text-xs">{t("profile.emailChangeDesc")}</p>
            <button
              type="button"
              onClick={() => { setEmailEditing(true); setEmailMsg(null); setEmailError(null); }}
              className="text-xs text-zinc-400 hover:text-white border border-white/20 hover:border-white/40 rounded-lg px-3 py-1.5 transition-colors"
            >
              {t("profile.emailChangeBtn")}
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-zinc-400 text-xs">{t("profile.emailChangeLabel")}</p>
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="new@example.com"
              aria-describedby={emailError ? "email-error" : undefined}
              className="w-full bg-zinc-800 text-white rounded-lg px-3 py-2 text-sm border border-white/10 focus:outline-none focus:border-emerald-500"
            />
            {emailError && <p id="email-error" role="alert" className="text-red-400 text-xs">{emailError}</p>}
            {emailMsg && <p aria-live="polite" className="text-emerald-400 text-xs">{emailMsg}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleEmailChange}
                disabled={emailSaving || !newEmail}
                className="text-xs bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold px-4 py-2 min-h-[36px] rounded-lg transition-colors"
              >
                {emailSaving ? "..." : t("profile.emailChangeSend")}
              </button>
              <button
                type="button"
                onClick={() => { setEmailEditing(false); setNewEmail(""); setEmailError(null); }}
                className="text-xs text-zinc-400 hover:text-white px-3 py-2 min-h-[36px]"
              >
                {t("training.cancel")}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Display name change — self-serve */}
      <div className="bg-zinc-900/60 rounded-xl border border-white/10 px-4 py-3">
        {!nameEditing ? (
          <div className="flex items-center justify-between">
            <p className="text-zinc-400 text-xs">{t("profile.nameChangeDesc")}</p>
            <button
              type="button"
              onClick={() => { setNameEditing(true); setNameMsg(null); }}
              className="text-xs text-zinc-400 hover:text-white border border-white/20 hover:border-white/40 rounded-lg px-3 py-1.5 transition-colors"
            >
              {t("profile.nameChangeBtn")}
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-zinc-400 text-xs">{t("profile.nameChangeLabel")}</p>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={t("profile.namePlaceholder")}
              maxLength={50}
              className="w-full bg-zinc-800 text-white rounded-lg px-3 py-2 text-sm border border-white/10 focus:outline-none focus:border-emerald-500"
            />
            {nameMsg && <p aria-live="polite" className="text-emerald-400 text-xs">{nameMsg}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleNameChange}
                disabled={nameSaving || !newName.trim()}
                className="text-xs bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold px-4 py-2 min-h-[36px] rounded-lg transition-colors"
              >
                {nameSaving ? "..." : t("profile.nameChangeSave")}
              </button>
              <button
                type="button"
                onClick={() => { setNameEditing(false); setNewName(""); setNameMsg(null); }}
                className="text-xs text-zinc-400 hover:text-white px-3 py-2 min-h-[36px]"
              >
                {t("training.cancel")}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Stripe Customer Portal — cancel/downgrade without chargeback risk */}
      <div className="bg-zinc-900/60 rounded-xl border border-white/10 px-4 py-3">
        <p className="text-zinc-400 text-xs mb-2">{t("profile.manageSubDesc")}</p>
        {CUSTOMER_PORTAL_URL ? (
          <a
            href={CUSTOMER_PORTAL_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t("profile.ariaManageSub")}
            className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white border border-white/20 hover:border-white/40 rounded-lg px-3 py-1.5 transition-colors"
          >
            💳 {t("profile.manageSub")}
          </a>
        ) : (
          <form method="POST" action="/api/stripe/portal" onSubmit={() => setPortalLoading(true)}>
            <button
              type="submit"
              disabled={portalLoading}
              aria-label={t("profile.ariaManageSub")}
              className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white border border-white/20 hover:border-white/40 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50 disabled:pointer-events-none"
            >
              {portalLoading ? "…" : <>💳 {t("profile.manageSub")}</>}
            </button>
          </form>
        )}
      </div>

      {/* Push Notifications opt-in */}
      <PushNotificationSection />

      {/* Data export — CCPA/GDPR Right to Data Portability */}
      <div className="bg-zinc-900/60 rounded-xl border border-white/10 px-4 py-3">
        <p className="text-zinc-400 text-xs mb-2">{t("profile.exportDesc")}</p>
        <CsvExport userId={userId} />
      </div>

      {/* Help & Support links — Axis 11 CS self-serve */}
      <div className="flex items-center gap-3 text-xs text-zinc-400 flex-wrap">
        <a
          href="/help"
          className="hover:text-white transition-colors underline underline-offset-2"
        >
          {t("profile.helpLink")}
        </a>
        <span className="text-zinc-700">|</span>
        <a
          href="mailto:307239t777@gmail.com?subject=BJJ%20App%20Support"
          className="hover:text-white transition-colors underline underline-offset-2"
        >
          {t("profile.contactSupport")}
        </a>
        <span className="text-zinc-700">|</span>
        <a
          href="/terms"
          className="hover:text-white transition-colors underline underline-offset-2"
        >
          {t("profile.termsLink")}
        </a>
        <span className="text-zinc-700">|</span>
        <a
          href="/privacy"
          className="hover:text-white transition-colors underline underline-offset-2"
        >
          {t("profile.privacyLink")}
        </a>
      </div>

      {/* Delete account — GDPR/CCPA Right to Erasure */}
      {!confirm ? (
        <button
          type="button"
          onClick={() => { setConfirm(true); setDeleteInput(""); setDeleteError(null); }}
          className="text-red-500 hover:text-red-400 text-sm underline"
        >
          {t("profile.deleteAccount")}
        </button>
      ) : (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 space-y-3">
          {/* Title + CSV export in one row */}
          <div className="flex items-center justify-between gap-2">
            <p className="text-red-400 text-sm font-semibold">{t("profile.deleteTitle")}</p>
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={exporting}
              className="text-xs text-amber-400 underline underline-offset-2 hover:text-amber-300 flex-shrink-0 disabled:opacity-50 whitespace-nowrap"
            >
              💾 {exporting ? t("profile.exporting") : t("profile.exportBtn")}
            </button>
          </div>
          <p className="text-zinc-400 text-xs leading-relaxed">{t("profile.deleteDesc")}</p>
          <div>
            <label className="text-zinc-400 text-xs mb-1 block">{t("profile.deleteTypeLabel")}</label>
            <input
              type="text"
              value={deleteInput}
              onChange={(e) => setDeleteInput(e.target.value)}
              placeholder={t("profile.deleteTypePlaceholder")}
              aria-label={t("profile.ariaDeleteInput")}
              aria-describedby={deleteError ? "delete-error" : undefined}
              className="w-full bg-zinc-800 text-white rounded-lg px-3 py-2 text-sm border border-white/10 focus:outline-none focus:border-red-500 font-mono"
            />
          </div>
          {deleteError && <p id="delete-error" role="alert" className="text-red-400 text-xs">{deleteError}</p>}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting || deleteInput !== "DELETE"}
              aria-label={t("profile.ariaDeleteConfirm")}
              className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white font-bold py-2 rounded-lg text-sm transition-colors"
            >
              {deleting ? t("profile.deletingLabel") : t("profile.deleteAccountPermanently")}
            </button>
            <button
              type="button"
              onClick={() => { setConfirm(false); setDeleteInput(""); setDeleteError(null); }}
              className="flex-1 bg-white/10 hover:bg-white/15 text-zinc-300 font-bold py-2 rounded-lg text-sm"
            >
              {t("training.cancel")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
