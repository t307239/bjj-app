"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { getLocalDateString } from "@/lib/timezone";
import { useProfile } from "@/hooks/useProfile";
import { useRouter } from "next/navigation";
import { useLocale } from "@/lib/i18n";
import { useOnlineStatus } from "@/lib/useOnlineStatus";
import Toast from "./Toast";
import PushNotificationSection from "./PushNotificationSection";
import BeltPromotionCelebration, { isBeltPromotion } from "./BeltPromotionCelebration";
import type { SupabaseClient } from "@supabase/supabase-js";

type Profile = {
  belt: string;
  stripe: number;
  gym: string;   // = gym_name in Supabase profiles table (B2B Trojan horse key field)
  bio: string;
  start_date: string;
};

/*
 * B2B Trojan Horse — 将来の自動メール機能のための集計クエリ
 *
 * 同じジムのユーザーが10人以上集まったら、道場主に自動メールを送る:
 *
 * SELECT gym, COUNT(*) as user_count
 * FROM profiles
 * WHERE gym IS NOT NULL AND gym != ''
 * GROUP BY gym
 * HAVING COUNT(*) >= 10
 * ORDER BY user_count DESC;
 *
 * → 結果を `gym_owner_emails` テーブルと照合し、
 *   未送信の道場に Beehiiv / SendGrid 経由で自動メール送信:
 *   「あなたの道場の生徒が{N}人このアプリを使っています。
 *    月$49で全員の練習データを確認できます。14日無料試用どうぞ」
 *
 * Note: gym = gym_name フィールド。schemas では profiles.gym カラムを使用。
 */

type Stats = {
  totalCount: number;
  totalMinutes: number;
  techniqueCount: number;
};

type Props = {
  userId: string;
  hideAccount?: boolean;
};

// getLocalDateString() from lib/timezone replaces the old JST-hardcoded getJSTDateString()

/**
 * formatBjjDuration
 * Returns human-readable BJJ experience from "YYYY-MM" or "YYYY-MM-DD".
 *   0y 0m  → "Just started"
 *   0y Nm  → "N months"
 *   Ny 0m  → "N years"
 *   Ny Nm  → "N years N months"
 */
function formatBjjDuration(
  startDate: string,
  t: (k: string, v?: Record<string, string | number>) => string
): string {
  const parts = startDate.split("-").map(Number);
  const start = new Date(parts[0], (parts[1] ?? 1) - 1, 1);
  const now = new Date();
  const totalMonths = Math.max(
    0,
    (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth())
  );
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;

  if (years === 0 && months === 0) return t("profile.bjjHistoryJustStarted");
  if (years === 0) return t("profile.bjjHistoryMonths", { n: months });
  if (months === 0) return t("profile.bjjHistoryYears", { n: years });
  return t("profile.bjjHistoryYearsMonths", { y: years, m: months });
}

// Stripe Customer Portal URL — configure in .env.local (Stripe Dashboard > Customer Portal)
const CUSTOMER_PORTAL_URL = process.env.NEXT_PUBLIC_STRIPE_CUSTOMER_PORTAL_URL ?? "";

// ─── Gym Membership Section ───────────────────────────────────────────────────

function GymMembershipSection({ userId, supabase }: { userId: string; supabase: SupabaseClient }) {
  const { t } = useLocale();
  const [gymName, setGymName] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [gymId, setGymId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [toggleLoading, setToggleLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("gym_id, share_data_with_gym")
        .eq("id", userId)
        .single();
      if (!data?.gym_id) { setLoading(false); return; }
      setGymId(data.gym_id);
      setSharing(data.share_data_with_gym ?? false);
      // Fetch gym name
      const { data: gym } = await supabase
        .from("gyms")
        .select("name")
        .eq("id", data.gym_id)
        .single();
      setGymName(gym?.name ?? null);
      setLoading(false);
    };
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const handleLeave = async () => {
    setLeaving(true);
    await supabase
      .from("profiles")
      .update({ gym_id: null, share_data_with_gym: false })
      .eq("id", userId);
    setGymId(null);
    setGymName(null);
    setSharing(false);
    setConfirmLeave(false);
    setLeaving(false);
  };

  const handleToggleSharing = async () => {
    setToggleLoading(true);
    const next = !sharing;
    await supabase
      .from("profiles")
      .update({ share_data_with_gym: next })
      .eq("id", userId);
    setSharing(next);
    setToggleLoading(false);
  };

  if (loading) return null;
  if (!gymId) return null;

  if (confirmLeave) {
    return (
      <div className="bg-zinc-900 border border-white/10 rounded-xl p-4">
        <p className="text-sm text-white mb-1">{t("gym.leaveConfirmTitle", { name: gymName ?? t("gym.unknownGym") })}</p>
        <p className="text-xs text-gray-400 mb-4">
          {t("gym.leaveConfirmDesc")}
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => setConfirmLeave(false)}
            className="flex-1 bg-zinc-700 hover:bg-zinc-600 text-gray-300 py-2 rounded-lg text-sm"
            aria-label={t("profile.ariaLeaveGymCancel")}
          >
            {t("training.cancel")}
          </button>
          <button
            onClick={handleLeave}
            disabled={leaving}
            className="flex-1 bg-[#e94560] hover:bg-[#c73652] disabled:opacity-50 text-white py-2 rounded-lg text-sm font-semibold"
            aria-label={t("profile.ariaLeaveGymConfirm")}
          >
            {leaving ? t("gym.leaving") : t("gym.leaveGym")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900 border border-white/10 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm font-semibold text-white">{t("gym.currentGym")}</p>
          <p className="flex items-center gap-1 text-xs text-gray-400 mt-0.5 max-w-[180px]">
            <svg className="w-3 h-3 flex-shrink-0 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
            </svg>
            <span className="truncate">{gymName ?? t("gym.unknownGym")}</span>
          </p>
        </div>
        <button
          onClick={() => setConfirmLeave(true)}
          className="text-xs text-gray-500 hover:text-red-400 transition-colors"
          aria-label={t("profile.ariaLeaveGym")}
        >
          {t("gym.leaveGym")}
        </button>
      </div>
      {/* Data sharing toggle */}
      <div className="flex items-center justify-between pt-3 border-t border-white/10">
        <div>
          <p className="text-xs text-gray-300">{t("gym.shareData")}</p>
          <p className="text-xs text-gray-500 mt-0.5">{t("gym.shareDataSub")}</p>
        </div>
        <button
          onClick={handleToggleSharing}
          disabled={toggleLoading}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${sharing ? "bg-[#10B981]" : "bg-zinc-700"}`}
          aria-label={sharing ? t("profile.ariaDisableSharing") : t("profile.ariaEnableSharing")}
          role="switch"
          aria-checked={sharing}
        >
          <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${sharing ? "translate-x-6" : "translate-x-1"}`} />
        </button>
      </div>
    </div>
  );
}


function AccountSection({ userId, supabase }: { userId: string; supabase: SupabaseClient }) {
  const { t } = useLocale();
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

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
      <h3 className="text-gray-500 text-xs tracking-wider">{t("profile.account")}</h3>

      {/* Email change — self-serve (Axis 11 CS) */}
      <div className="bg-zinc-900/60 rounded-xl border border-white/10 px-4 py-3">
        {!emailEditing ? (
          <div className="flex items-center justify-between">
            <p className="text-gray-400 text-xs">{t("profile.emailChangeDesc")}</p>
            <button
              type="button"
              onClick={() => { setEmailEditing(true); setEmailMsg(null); setEmailError(null); }}
              className="text-xs text-gray-400 hover:text-white border border-white/20 hover:border-white/40 rounded-lg px-3 py-1.5 transition-colors"
            >
              {t("profile.emailChangeBtn")}
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-gray-400 text-xs">{t("profile.emailChangeLabel")}</p>
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="new@example.com"
              className="w-full bg-zinc-800 text-white rounded-lg px-3 py-2 text-sm border border-white/10 focus:outline-none focus:border-emerald-500"
            />
            {emailError && <p className="text-red-400 text-xs">{emailError}</p>}
            {emailMsg && <p className="text-emerald-400 text-xs">{emailMsg}</p>}
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
                className="text-xs text-gray-400 hover:text-white px-3 py-2 min-h-[36px]"
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
            <p className="text-gray-400 text-xs">{t("profile.nameChangeDesc")}</p>
            <button
              type="button"
              onClick={() => { setNameEditing(true); setNameMsg(null); }}
              className="text-xs text-gray-400 hover:text-white border border-white/20 hover:border-white/40 rounded-lg px-3 py-1.5 transition-colors"
            >
              {t("profile.nameChangeBtn")}
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-gray-400 text-xs">{t("profile.nameChangeLabel")}</p>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Your Name"
              maxLength={50}
              className="w-full bg-zinc-800 text-white rounded-lg px-3 py-2 text-sm border border-white/10 focus:outline-none focus:border-emerald-500"
            />
            {nameMsg && <p className="text-emerald-400 text-xs">{nameMsg}</p>}
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
                className="text-xs text-gray-400 hover:text-white px-3 py-2 min-h-[36px]"
              >
                {t("training.cancel")}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Stripe Customer Portal — cancel/downgrade without chargeback risk */}
      <div className="bg-zinc-900/60 rounded-xl border border-white/10 px-4 py-3">
        <p className="text-gray-400 text-xs mb-2">{t("profile.manageSubDesc")}</p>
        {CUSTOMER_PORTAL_URL ? (
          <a
            href={CUSTOMER_PORTAL_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t("profile.ariaManageSub")}
            className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-white border border-white/20 hover:border-white/40 rounded-lg px-3 py-1.5 transition-colors"
          >
            💳 {t("profile.manageSub")}
          </a>
        ) : (
          <form method="POST" action="/api/stripe/portal">
            <button
              type="submit"
              aria-label={t("profile.ariaManageSub")}
              className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-white border border-white/20 hover:border-white/40 rounded-lg px-3 py-1.5 transition-colors"
            >
              💳 {t("profile.manageSub")}
            </button>
          </form>
        )}
      </div>

      {/* Push Notifications opt-in */}
      <PushNotificationSection />

      {/* Data export — CCPA/GDPR Right to Data Portability */}
      <div className="bg-zinc-900/60 rounded-xl border border-white/10 px-4 py-3">
        <p className="text-gray-400 text-xs mb-2">{t("profile.exportDesc")}</p>
        <button
          type="button"
          onClick={handleExportCsv}
          disabled={exporting}
          aria-label={t("profile.ariaDownloadCSV")}
          className="inline-flex items-center gap-1.5 text-xs text-[#10B981] hover:text-[#0d9668] border border-[#10B981]/30 hover:border-[#10B981]/60 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50"
        >
          {exporting ? t("profile.exporting") : t("profile.exportBtn")}
        </button>
      </div>

      {/* Help & Support links — Axis 11 CS self-serve */}
      <div className="flex items-center gap-3 text-xs text-gray-400 flex-wrap">
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
          <p className="text-red-400 text-sm font-semibold">{t("profile.deleteTitle")}</p>
          {/* Data portability reminder before deletion — GDPR/CCPA best practice */}
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 flex items-center gap-2">
            <span className="text-amber-400 text-xs flex-shrink-0">💾</span>
            <p className="text-amber-400 text-xs">{t("profile.deleteExportFirst")}</p>
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={exporting}
              className="ml-auto text-xs text-amber-400 underline underline-offset-2 hover:text-amber-300 flex-shrink-0 disabled:opacity-50"
            >
              {exporting ? t("profile.exporting") : t("profile.exportBtn")}
            </button>
          </div>
          <p className="text-gray-400 text-xs leading-relaxed">
            {t("profile.deleteDesc")}
          </p>
          <div>
            <label className="text-gray-500 text-xs mb-1 block">{t("profile.deleteTypeLabel")} <span className="font-mono text-white">{t("profile.deleteTypePlaceholder")}</span> {t("profile.deleteTypeToConfirm")}</label>
            <input
              type="text"
              value={deleteInput}
              onChange={(e) => setDeleteInput(e.target.value)}
              placeholder={t("profile.deleteTypePlaceholder")}
              aria-label={t("profile.ariaDeleteInput")}
              className="w-full bg-zinc-800 text-white rounded-lg px-3 py-2 text-sm border border-white/10 focus:outline-none focus:border-red-500 font-mono"
            />
          </div>
          {deleteError && <p className="text-red-400 text-xs">{deleteError}</p>}
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
              className="flex-1 bg-white/10 hover:bg-white/15 text-gray-300 font-bold py-2 rounded-lg text-sm"
            >
              {t("training.cancel")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function BELTS({ t }: { t: (key: string, obj?: Record<string, string | number>) => string }) {
  return [
    { value: "white", label: t("profile.belts.white"), color: "bg-white text-gray-900" },
    { value: "blue", label: t("profile.belts.blue"), color: "bg-blue-500 text-white" },
    { value: "purple", label: t("profile.belts.purple"), color: "bg-purple-600 text-white" },
    { value: "brown", label: t("profile.belts.brown"), color: "bg-amber-800 text-white" },
    { value: "black", label: t("profile.belts.black"), color: "bg-zinc-950 text-white border border-white/10" },
  ];
}

function ProfileViewCard({ profile, stats, onEdit }: { profile: Profile; stats: Stats | null; onEdit: () => void }) {
  const { t } = useLocale();
  const belts = BELTS({ t });
  const beltInfo = belts.find((b) => b.value === profile.belt);
  return (
    <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 rounded-xl p-5 border border-white/10">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs text-gray-500 tracking-wider">{t("profile.title")}</h3>
        <button onClick={onEdit} className="text-xs text-gray-400 hover:text-white border border-white/20 hover:border-white/40 rounded-lg px-3 py-2 min-h-[44px] transition-colors">
          ✏️ {t("training.edit")}
        </button>
      </div>
      <div className="flex items-center gap-3 mb-4">
        <span className={"px-5 py-1.5 rounded-full text-sm font-bold " + (beltInfo?.color ?? "")}>
          {beltInfo?.label}
        </span>
        <div className="flex gap-1">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className={"w-3 h-3 rounded-full border-2 " + (s <= profile.stripe ? "bg-white border-white" : "bg-transparent border-white/10")} />
          ))}
        </div>
      </div>
      <div className="space-y-2">
        {profile.gym && (
          <div className="flex items-center gap-2 text-sm text-gray-300">
            <span className="text-gray-500">🏗</span>
            <span>{profile.gym}</span>
          </div>
        )}
        {profile.start_date && (
          <div className="flex items-center gap-2 text-sm text-gray-300">
            <span className="text-gray-500">🥋</span>
            <span>{formatBjjDuration(profile.start_date, t)}</span>
            <span className="text-gray-500 text-xs">
              {(() => {
                const [y, m] = profile.start_date.split("-");
                const d = new Date(parseInt(y), parseInt(m) - 1, 1);
                const fmt = new Intl.DateTimeFormat("en", { month: "short", year: "numeric" }).format(d);
                return `(${fmt} – Present)`;
              })()}
            </span>
          </div>
        )}
        {!profile.gym && !profile.start_date && (
          <p className="text-gray-500 text-xs">{t("profile.gymNotSet")}</p>
        )}
      </div>
      {profile.bio && (
        <p className="text-gray-400 text-sm mt-3 border-t border-white/10 pt-3 leading-relaxed">{profile.bio}</p>
      )}
      {stats && (
        <div className="mt-4 pt-4 border-t border-white/10 grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-lg font-bold text-white">{stats.totalCount}</div>
            <div className="text-xs text-gray-500">{t("stats.totalSessions")}</div>
          </div>
          <div>
            <div className="text-lg font-bold text-[#10B981]">
              {stats.totalMinutes >= 60 ? Math.floor(stats.totalMinutes / 60) + "h" : stats.totalMinutes + "m"}
            </div>
            <div className="text-xs text-gray-500">{t("stats.totalMinutes")}</div>
          </div>
          <div>
            <div className="text-lg font-bold text-purple-400">{stats.techniqueCount}</div>
            <div className="text-xs text-gray-500">{t("dashboard.techniques")}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProfileEditForm({ profile, onSave, onCancel }: { profile: Profile; onSave: (updated: Profile) => void; onCancel: () => void }) {
  const { t } = useLocale();
  const isOnline = useOnlineStatus();
  const [form, setForm] = useState<Profile>(profile);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [promotionFrom, setPromotionFrom] = useState<string | null>(null);
  const today = getLocalDateString();
  const supabase = createClient();
  const belts = BELTS({ t });
  const currentBelt = belts.find((b) => b.value === form.belt);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (form.start_date && form.start_date > today) {
      setFormError(t("profile.futureDateError"));
      return;
    }
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setFormError(t("profile.authError"));
      setLoading(false);
      return;
    }
    // Check if disclaimer has already been recorded; if not, record it now.
    // (Migration: supabase/migrations/20260322_add_disclaimer_agreed.sql)
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("training_disclaimer_agreed_at")
      .eq("id", user.id)
      .single();
    const disclaimerAlreadyRecorded = !!existingProfile?.training_disclaimer_agreed_at;

    const { error } = await supabase.from("profiles").upsert(
      {
        id: user.id,
        belt: form.belt,
        stripe: form.stripe,
        gym: form.gym,          // existing column
        // gym_name: form.gym,  // TODO: add gym_name column via migration when B2B aggregation query is activated
        bio: form.bio,
        start_date: form.start_date || null,
        // Training disclaimer: set once, never cleared (legal defense evidence)
        ...(disclaimerAlreadyRecorded ? {} : {
          training_disclaimer_agreed: true,
          training_disclaimer_agreed_at: new Date().toISOString(),
        }),
      },
      { onConflict: "id" }
    );
    if (!error) {
      // Detect belt promotion (viral celebration moment)
      if (isBeltPromotion(profile.belt, form.belt)) {
        setPromotionFrom(profile.belt);
      }
      setToast({ message: t("profile.saved"), type: "success" });
      setTimeout(() => { setToast(null); onSave(form); }, 1200);
    } else {
      setToast({ message: t("profile.saveFailed") + ": " + (error.message || error.code || t("profile.saveFailedUnknown")), type: "error" });
    }
    setLoading(false);
  };

  return (
    <>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      {/* Belt promotion celebration overlay */}
      {promotionFrom !== null && (
        <BeltPromotionCelebration
          fromBelt={promotionFrom}
          toBelt={form.belt}
          onClose={() => setPromotionFrom(null)}
        />
      )}
      <form onSubmit={handleSave} className="space-y-5">
        <div className="bg-zinc-900 rounded-xl p-5 border border-white/10 text-center">
          <div className="inline-flex items-center gap-3 mb-1">
            <span className={"px-6 py-2 rounded-full text-sm font-bold " + (currentBelt?.color ?? "")}>{currentBelt?.label}</span>
            <div className="flex gap-1">
              {[1, 2, 3, 4].map((s) => (
                <div key={s} className={"w-3 h-3 rounded-full border-2 " + (s <= form.stripe ? "bg-white border-white" : "bg-transparent border-white/10")} />
              ))}
            </div>
          </div>
          <p className="text-gray-400 text-xs">{currentBelt?.label}</p>
        </div>
        <div className="bg-zinc-900 rounded-xl p-4 border border-white/10">
          <label className="block text-gray-300 text-sm font-medium mb-3">{t("profile.belt")}</label>
          <div className="grid grid-cols-5 gap-2">
            {belts.map((belt) => (
              <button key={belt.value} type="button" onClick={() => setForm({ ...form, belt: belt.value })}
                className={"py-2 rounded-lg text-xs font-semibold transition-all " + belt.color + " " + (form.belt === belt.value ? "ring-2 ring-white/60 scale-105" : "opacity-60 hover:opacity-90")}>
                {belt.label}
              </button>
            ))}
          </div>
        </div>
        <div className="bg-zinc-900 rounded-xl p-4 border border-white/10">
          <label className="block text-gray-300 text-sm font-medium mb-3">{t("profile.stripe")} (0–4)</label>
          <div className="flex gap-2">
            {[0, 1, 2, 3, 4].map((s) => (
              <button key={s} type="button" onClick={() => setForm({ ...form, stripe: s })}
                className={"flex-1 py-2 rounded-lg text-sm font-semibold transition-all active:scale-95 " + (form.stripe === s ? "bg-[#10B981] text-white" : "bg-zinc-800 text-gray-400 hover:text-white")}>
                {s}
              </button>
            ))}
          </div>
        </div>
        <div className="bg-zinc-900 rounded-xl p-4 border border-white/10">
          <label className="block text-gray-300 text-sm font-medium mb-1">{t("profile.gym")}</label>
          <p className="text-gray-500 text-xs mb-2">{t("profile.gymSubtext")}</p>
          <input type="text" value={form.gym} onChange={(e) => setForm({ ...form, gym: e.target.value })} placeholder="e.g. Gracie Academy Tokyo" className="w-full bg-zinc-800 text-white rounded-lg px-3 py-2 text-sm border border-white/10 focus:outline-none focus:border-white/30" />
        </div>
        <div className="bg-zinc-900 rounded-xl p-4 border border-white/10">
          <label className="block text-gray-300 text-sm font-medium mb-2">{t("profile.startDate")}</label>
          <input type="date" value={form.start_date} max={today} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className="w-full bg-zinc-800 text-white rounded-lg px-3 py-2 text-sm border border-white/10 focus:outline-none focus:border-white/30" />
          {form.start_date && <p className="text-gray-500 text-xs mt-1">{formatBjjDuration(form.start_date, t)}</p>}
        </div>
        <div className="bg-zinc-900 rounded-xl p-4 border border-white/10">
          <label className="block text-gray-300 text-sm font-medium mb-2">{t("profile.bio")}</label>
          <textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} placeholder={t("profile.bioPlaceholder")} rows={3} className="w-full bg-zinc-800 text-white rounded-lg px-3 py-2 text-sm border border-white/10 focus:outline-none focus:border-white/30 resize-none" />
        </div>
        {formError && <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">{formError}</div>}
        <div className="flex gap-3">
          <button type="submit" disabled={loading || !isOnline} className="flex-1 bg-[#10B981] hover:bg-[#0d9668] active:scale-95 disabled:opacity-50 text-white font-bold py-3 rounded-xl text-sm transition-all">
            {loading ? t("profile.saving") : t("profile.save")}
          </button>
          <button type="button" onClick={onCancel} className="flex-1 bg-zinc-900 hover:bg-white/5 text-gray-300 font-bold py-3 rounded-xl text-sm border border-white/10 transition-colors">
            {t("training.cancel")}
          </button>
        </div>
      </form>
    </>
  );
}

export default function ProfileForm({ userId, hideAccount }: Props) {
  const { t } = useLocale();
  const router = useRouter();
  const {
    supabase,
    profile, setProfile,
    stats,
    initialLoading,
    isEditing, setIsEditing,
  } = useProfile({ userId });

  if (initialLoading) {
    return (
      <div className="text-center py-8 text-gray-500">
        <div className="inline-block w-6 h-6 border-2 border-white/10 border-t-white/60 rounded-full animate-spin mb-2" />
        <p className="text-sm">{t("training.loading")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {isEditing ? (
        <>
          <div className="flex items-center gap-2 mb-2">
            <h2 className="text-white font-semibold text-sm">{t("profile.title")}</h2>
          </div>
          <ProfileEditForm profile={profile} onSave={(updated) => { setProfile(updated); setIsEditing(false); router.refresh(); }} onCancel={() => setIsEditing(false)} />
        </>
      ) : (
        <ProfileViewCard profile={profile} stats={stats} onEdit={() => setIsEditing(true)} />
      )}
      <GymMembershipSection userId={userId} supabase={supabase} />
      {!hideAccount && <AccountSection userId={userId} supabase={supabase} />}
    </div>
  );
}
