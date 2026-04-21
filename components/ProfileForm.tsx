"use client";

import { useState, useEffect, useRef } from "react";
import { formatBjjDuration } from "@/lib/bjjDuration";
import { getLocalDateString } from "@/lib/timezone";
import { useProfile } from "@/hooks/useProfile";
import { useRouter } from "next/navigation";
import { useLocale } from "@/lib/i18n";
import { useOnlineStatus } from "@/lib/useOnlineStatus";
import { useUnsavedChanges } from "@/lib/useUnsavedChanges";
import { trackEvent } from "@/lib/analytics";
import Toast from "./Toast";
import BeltPromotionCelebration, { isBeltPromotion } from "./BeltPromotionCelebration";
import GymMembershipSection from "./profile/GymMembershipSection";
import AccountSection from "./profile/AccountSection";
import type { SupabaseClient } from "@supabase/supabase-js";
import { clientLogger } from "@/lib/clientLogger";

type Profile = {
  belt: string;
  stripe: number;
  gym: string;   // = gym_name in Supabase profiles table (B2B Trojan horse key field)
  bio: string;
  start_date: string;
  timezone?: string;  // IANA timezone (e.g. "Asia/Tokyo")
};

type Stats = {
  totalCount: number;
  totalMinutes: number;
  techniqueCount: number;
};

type Props = {
  userId: string;
  hideAccount?: boolean;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function BELTS({ t }: { t: (key: string, obj?: Record<string, string | number>) => string }) {
  return [
    { value: "white", label: t("profile.belts.white"), color: "bg-white text-gray-900" },
    { value: "blue", label: t("profile.belts.blue"), color: "bg-blue-500 text-white" },
    { value: "purple", label: t("profile.belts.purple"), color: "bg-purple-600 text-white" },
    { value: "brown", label: t("profile.belts.brown"), color: "bg-amber-800 text-white" },
    { value: "black", label: t("profile.belts.black"), color: "bg-zinc-950 text-white border border-white/10" },
  ];
}

const TIMEZONE_OPTIONS = [
  { value: "Asia/Tokyo",        label: "Asia/Tokyo" },
  { value: "America/New_York",  label: "America/New_York" },
  { value: "America/Sao_Paulo", label: "America/Sao_Paulo" },
  { value: "Europe/London",     label: "Europe/London" },
  { value: "UTC",               label: "UTC" },
] as const;

// ─── ProfileViewCard ─────────────────────────────────────────────────────────

function ProfileViewCard({ profile, stats, onEdit }: { profile: Profile; stats: Stats | null; onEdit: () => void }) {
  const { t } = useLocale();
  const belts = BELTS({ t });
  const beltInfo = belts.find((b) => b.value === profile.belt);
  return (
    <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 rounded-xl p-5 ring-1 ring-inset ring-white/[0.04] shadow-lg shadow-black/40">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs text-zinc-400 tracking-wider">{t("profile.title")}</h3>
        <button type="button" onClick={onEdit} className="text-xs text-zinc-400 hover:text-white border border-white/20 hover:border-white/40 rounded-lg px-3 py-2 min-h-[44px] transition-colors">
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
          <div className="flex items-center gap-2 text-sm text-zinc-300">
            <span className="text-zinc-400">🏗</span>
            <span>{profile.gym}</span>
          </div>
        )}
        {profile.start_date && (
          <div className="flex items-center gap-2 text-sm text-zinc-300">
            <span className="text-zinc-400">🥋</span>
            <span>{formatBjjDuration(profile.start_date, t)}</span>
            <span className="text-zinc-400 text-xs">
              {(() => {
                const [y, m] = profile.start_date.split("-");
                const d = new Date(parseInt(y), parseInt(m) - 1, 1);
                const fmt = new Intl.DateTimeFormat(undefined, { month: "short", year: "numeric" }).format(d);
                return `(${fmt} – ${t("profile.datePresent")})`;
              })()}
            </span>
          </div>
        )}
        {!profile.gym && !profile.start_date && (
          <p className="text-zinc-400 text-xs">{t("profile.gymNotSet")}</p>
        )}
      </div>
      {profile.bio && (
        <p className="text-zinc-400 text-sm mt-3 border-t border-white/10 pt-3 leading-relaxed">{profile.bio}</p>
      )}
      {stats && (
        <div className="mt-4 pt-4 border-t border-white/10 grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-lg font-bold text-white">{stats.totalCount}</div>
            <div className="text-xs text-zinc-400">{t("stats.totalSessions")}</div>
          </div>
          <div>
            <div className="text-lg font-bold text-[#10B981]">
              {stats.totalMinutes >= 60
                ? `${Math.floor(stats.totalMinutes / 60)}h${stats.totalMinutes % 60 > 0 ? `${stats.totalMinutes % 60}m` : ""}`
                : `${stats.totalMinutes}m`}
            </div>
            <div className="text-xs text-zinc-400">{t("stats.totalMinutes")}</div>
          </div>
          <div>
            <div className="text-lg font-bold text-purple-400">{stats.techniqueCount}</div>
            <div className="text-xs text-zinc-400">{t("dashboard.techniques")}</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ProfileEditForm ─────────────────────────────────────────────────────────

function ProfileEditForm({ profile, onSave, onCancel, supabase, userId }: {
  profile: Profile;
  onSave: (updated: Profile) => void;
  onCancel: () => void;
  supabase: SupabaseClient;
  userId: string;
}) {
  const { t } = useLocale();
  const isOnline = useOnlineStatus();
  const [form, setForm] = useState<Profile>(profile);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [promotionFrom, setPromotionFrom] = useState<string | null>(null);
  const [gymSuggestions, setGymSuggestions] = useState<{ id: string; name: string }[]>([]);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const today = getLocalDateString();
  const belts = BELTS({ t });
  const currentBelt = belts.find((b) => b.value === form.belt);

  // Warn on page leave if form has unsaved changes
  const isDirty = form.belt !== profile.belt || form.stripe !== profile.stripe ||
    form.gym !== profile.gym || form.bio !== profile.bio ||
    form.start_date !== profile.start_date || form.timezone !== profile.timezone;
  useUnsavedChanges(isDirty);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  // Fetch all gym names for autocomplete + gym_id auto-linking (T-30)
  useEffect(() => {
    const fetchGyms = async () => {
      const { data, error } = await supabase
        .from("gyms")
        .select("id, name")
        .order("name", { ascending: true });
      if (error) { clientLogger.error("gym_list_fetch_failed", {}, error); return; }
      if (data) setGymSuggestions(data as { id: string; name: string }[]);
    };
    fetchGyms();
  }, [supabase]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (form.start_date && form.start_date > today) {
      setFormError(t("profile.futureDateError"));
      return;
    }
    setLoading(true);
    // Check if disclaimer has already been recorded; if not, record it now.
    const { data: existingProfile, error: disclaimerError } = await supabase
      .from("profiles")
      .select("training_disclaimer_agreed_at")
      .eq("id", userId)
      .single();
    if (disclaimerError) clientLogger.error("profileeditform.query", {}, disclaimerError);
    const disclaimerAlreadyRecorded = !!existingProfile?.training_disclaimer_agreed_at;

    // Auto-link gym_id when user's typed gym name exactly matches a known gym (T-30)
    const matchedGymId = gymSuggestions.find(
      (g) => g.name.trim().toLowerCase() === form.gym.trim().toLowerCase()
    )?.id ?? null;

    const { error: upsertError } = await supabase.from("profiles").upsert(
      {
        id: userId,
        belt: form.belt,
        stripe: form.stripe,
        gym: form.gym,
        bio: form.bio,
        start_date: form.start_date || null,
        timezone: form.timezone || "UTC",
        // Auto-link gym_id when name matches a known gym — only set, never clear (B2B Trojan Horse)
        ...(matchedGymId ? { gym_id: matchedGymId } : {}),
        // Training disclaimer: set once, never cleared (legal defense evidence)
        ...(disclaimerAlreadyRecorded ? {} : {
          training_disclaimer_agreed: true,
          training_disclaimer_agreed_at: new Date().toISOString(),
        }),
      },
      { onConflict: "id" }
    );
    if (!upsertError) {
      // Record belt change in belt_history (upsert: one entry per belt per user)
      if (form.belt !== profile.belt) {
        const today = getLocalDateString();
        await supabase.from("belt_history").upsert(
          { user_id: userId, belt: form.belt, promoted_at: today },
          { onConflict: "user_id,belt" }
        );
      }
      // Detect belt promotion (viral celebration moment)
      if (isBeltPromotion(profile.belt, form.belt)) {
        setPromotionFrom(profile.belt);
      }
      setToast({ message: t("profile.saved"), type: "success" });
      // §6 Telemetry: Track onboarding profile setup (belt/gym/start_date)
      trackEvent("onboarding_profile_set", {
        belt: form.belt,
        has_gym: form.gym ? "yes" : "no",
        has_start_date: form.start_date ? "yes" : "no",
      });
      toastTimerRef.current = setTimeout(() => { setToast(null); onSave(form); }, 1200);
    } else {
      setToast({ message: t("profile.saveFailed") + ": " + (upsertError.message || upsertError.code || t("profile.saveFailedUnknown")), type: "error" });
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
      <form onSubmit={handleSave} noValidate className="space-y-5">
        <div className="bg-zinc-900 rounded-xl p-5 ring-1 ring-inset ring-white/[0.04] shadow-md shadow-black/30 text-center">
          <div className="inline-flex items-center gap-3 mb-1">
            <span className={"px-6 py-2 rounded-full text-sm font-bold " + (currentBelt?.color ?? "")}>{currentBelt?.label}</span>
            <div className="flex gap-1">
              {[1, 2, 3, 4].map((s) => (
                <div key={s} className={"w-3 h-3 rounded-full border-2 " + (s <= form.stripe ? "bg-white border-white" : "bg-transparent border-white/10")} />
              ))}
            </div>
          </div>
          <p className="text-zinc-400 text-xs">{currentBelt?.label}</p>
        </div>
        <div className="bg-zinc-900 rounded-xl p-4 ring-1 ring-inset ring-white/[0.04] shadow-md shadow-black/30">
          <label className="block text-zinc-300 text-sm font-medium mb-3">{t("profile.belt")}</label>
          <div className="grid grid-cols-5 gap-2">
            {belts.map((belt) => (
              <button key={belt.value} type="button" onClick={() => setForm({ ...form, belt: belt.value })}
                className={"py-2 rounded-lg text-xs font-semibold transition-all " + belt.color + " " + (form.belt === belt.value ? "ring-2 ring-white/60 scale-105" : "opacity-60 hover:opacity-90")}>
                {belt.label}
              </button>
            ))}
          </div>
        </div>
        <div className="bg-zinc-900 rounded-xl p-4 ring-1 ring-inset ring-white/[0.04] shadow-md shadow-black/30">
          <label className="block text-zinc-300 text-sm font-medium mb-3">{t("profile.stripe")} (0–4)</label>
          <div className="flex gap-2">
            {[0, 1, 2, 3, 4].map((s) => (
              <button key={s} type="button" onClick={() => setForm({ ...form, stripe: s })}
                className={"flex-1 py-2 rounded-lg text-sm font-semibold transition-all active:scale-95 " + (form.stripe === s ? "bg-[#10B981] text-white" : "bg-zinc-800 text-zinc-400 hover:text-white")}>
                {s}
              </button>
            ))}
          </div>
        </div>
        <div className="bg-zinc-900 rounded-xl p-4 ring-1 ring-inset ring-white/[0.04] shadow-md shadow-black/30">
          <label className="block text-zinc-300 text-sm font-medium mb-1">{t("profile.gym")}</label>
          <p className="text-zinc-400 text-xs mb-2">{t("profile.gymSubtext")}</p>
          <input
            type="text"
            value={form.gym}
            onChange={(e) => setForm({ ...form, gym: e.target.value })}
            placeholder={t("profile.gymPlaceholder")}
            list="gym-name-suggestions"
            autoComplete="off"
            className="w-full bg-zinc-800 text-white rounded-lg px-3 py-2 text-sm border border-white/10 focus:outline-none focus:border-white/30"
          />
          <datalist id="gym-name-suggestions">
            {gymSuggestions.map((g) => (
              <option key={g.id} value={g.name} />
            ))}
          </datalist>
          {gymSuggestions.some((g) => g.name.trim().toLowerCase() === form.gym.trim().toLowerCase()) && form.gym.trim() !== "" && (
            <p className="text-xs text-emerald-400 mt-1">✓ {t("profile.gymMatched")}</p>
          )}
        </div>
        <div className="bg-zinc-900 rounded-xl p-4 ring-1 ring-inset ring-white/[0.04] shadow-md shadow-black/30">
          <label className="block text-zinc-300 text-sm font-medium mb-2">{t("profile.startDate")}</label>
          <input type="date" value={form.start_date} max={today} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className="w-full bg-zinc-800 text-white rounded-lg px-3 py-2 text-sm border border-white/10 focus:outline-none focus:border-white/30" />
          {form.start_date && (
            <p className="text-zinc-400 text-xs mt-1">
              {(() => {
                const [y, m] = form.start_date.split("-");
                const d = new Date(parseInt(y), parseInt(m) - 1, 1);
                const fmt = new Intl.DateTimeFormat(undefined, { year: "numeric", month: "long" }).format(d);
                return `${fmt} → ${formatBjjDuration(form.start_date, t)}`;
              })()}
            </p>
          )}
        </div>
        <div className="bg-zinc-900 rounded-xl p-4 ring-1 ring-inset ring-white/[0.04] shadow-md shadow-black/30">
          <label className="block text-zinc-300 text-sm font-medium mb-2">{t("profile.bio")}</label>
          <textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} placeholder={t("profile.bioPlaceholder")} rows={3} className="w-full bg-zinc-800 text-white rounded-lg px-3 py-2 text-sm border border-white/10 focus:outline-none focus:border-white/30 resize-none" />
        </div>
        <div className="bg-zinc-900 rounded-xl p-4 ring-1 ring-inset ring-white/[0.04] shadow-md shadow-black/30">
          <label className="block text-zinc-300 text-sm font-medium mb-1">{t("profile.timezone")}</label>
          <p className="text-zinc-400 text-xs mb-2">{t("profile.timezoneDesc")}</p>
          <select
            value={form.timezone || "UTC"}
            onChange={(e) => setForm({ ...form, timezone: e.target.value })}
            aria-label={t("profile.timezone")}
            className="w-full bg-zinc-800 text-white rounded-lg px-3 py-2 text-sm border border-white/10 focus:outline-none focus:border-white/30"
          >
            {TIMEZONE_OPTIONS.map((tz) => (
              <option key={tz.value} value={tz.value}>{tz.label}</option>
            ))}
          </select>
        </div>
        {formError && <div role="alert" className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">{formError}</div>}
        <div className="flex gap-3">
          <button type="submit" disabled={loading || !isOnline} className="flex-1 bg-[#10B981] hover:bg-[#0d9668] active:scale-95 disabled:opacity-50 text-white font-bold py-3 rounded-xl text-sm transition-all">
            {loading ? t("profile.saving") : t("profile.save")}
          </button>
          <button type="button" onClick={onCancel} className="flex-1 bg-zinc-900 hover:bg-white/5 text-zinc-300 font-bold py-3 rounded-xl text-sm border border-white/10 transition-colors">
            {t("training.cancel")}
          </button>
        </div>
      </form>
    </>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

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
      <div className="text-center py-8 text-zinc-400">
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
          <ProfileEditForm profile={profile} onSave={(updated) => { setProfile(updated); setIsEditing(false); router.refresh(); }} onCancel={() => setIsEditing(false)} supabase={supabase} userId={userId} />
        </>
      ) : (
        <ProfileViewCard profile={profile} stats={stats} onEdit={() => setIsEditing(true)} />
      )}
      <GymMembershipSection userId={userId} supabase={supabase} />
      {!hideAccount && <AccountSection userId={userId} supabase={supabase} />}
    </div>
  );
}
