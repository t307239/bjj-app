/**
 * /records/[id] — Deep link to a specific training log entry.
 * Server Component: authenticates via Supabase, fetches the single log.
 * RLS ensures only the owner can view their own records.
 */
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import NavBar from "@/components/NavBar";
import Link from "next/link";
import { detectServerLocale, makeT } from "@/lib/i18n";
import { TRAINING_TYPES } from "@/lib/trainingTypes";
import { decodeCompNotes, decodeRollNotes, formatRollBadge } from "@/lib/trainingLogHelpers";
import RecordDetailClient from "./RecordDetailClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return { title: `Record ${id.slice(0, 8)} | BJJ App` };
}

export default async function RecordDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(`/login?next=/records/${id}`);

  const locale = await detectServerLocale();
  const t = makeT(locale);

  // RLS-protected: only returns if user_id matches the authenticated user
  const { data: log, error } = await supabase
    .from("training_logs")
    .select("id, date, duration_min, type, notes, instructor, partner, created_at")
    .eq("id", id)
    .single();

  const displayName =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email?.split("@")[0] ||
    "";

  if (error || !log) {
    return (
      <div className="min-h-screen bg-[#0B1120]">
        <NavBar
          displayName={displayName}
          avatarUrl={user.user_metadata?.avatar_url}
          isPro={false}
        />
        <main className="max-w-2xl mx-auto px-4 pt-24 pb-32 text-center">
          <div className="bg-zinc-900 border border-white/10 rounded-2xl p-8">
            <p className="text-2xl mb-2">📋</p>
            <h1 className="text-white text-lg font-semibold mb-2">
              {t("training.detailNotFound")}
            </h1>
            <p className="text-zinc-400 text-sm mb-6">
              {t("training.detailNotFoundDesc")}
            </p>
            <Link
              href="/records"
              className="inline-flex items-center gap-1.5 text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              ← {t("training.backToRecords")}
            </Link>
          </div>
        </main>
      </div>
    );
  }

  // Decode structured notes
  const { comp, userNotes } = decodeCompNotes(log.notes ?? "");
  const { roll } = decodeRollNotes(log.notes ?? "");
  const typeInfo = TRAINING_TYPES.find((tt) => tt.value === log.type);
  const typeLabel = t(`training.${log.type}`);

  // Format duration
  const dur = log.duration_min ?? 0;
  const durStr = dur >= 60
    ? `${Math.floor(dur / 60)}h${dur % 60 > 0 ? `${dur % 60}m` : ""}`
    : `${dur}m`;

  return (
    <div className="min-h-screen bg-[#0B1120]">
      <NavBar
        displayName={displayName}
        avatarUrl={user.user_metadata?.avatar_url}
        isPro={false}
      />
      <main className="max-w-2xl mx-auto px-4 pt-24 pb-32">
        {/* Back link */}
        <Link
          href="/records"
          className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white transition-colors mb-4"
        >
          ← {t("training.backToRecords")}
        </Link>

        {/* Main card */}
        <div className="bg-zinc-900 border border-white/10 rounded-2xl p-5 space-y-4">
          {/* Header: date + type */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-white text-lg font-semibold">{log.date}</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-zinc-300">
                  {typeInfo?.icon ?? "🥋"} {typeLabel}
                </span>
                <span className="text-xs text-zinc-400 whitespace-nowrap">{durStr}</span>
              </div>
            </div>
            {/* Client-side copy link button */}
            <RecordDetailClient recordId={log.id} />
          </div>

          {/* Competition details */}
          {comp && (
            <div className="bg-white/5 rounded-xl p-3 space-y-1">
              <p className="text-xs text-zinc-400 uppercase tracking-wide">{t("csv.header.result")}</p>
              <p className="text-white text-sm font-medium">
                {comp.result === "win" ? "🏆" : comp.result === "loss" ? "💪" : "🤝"}{" "}
                {t(`csv.${comp.result}`)}
                {comp.opponent && <span className="text-zinc-400 ml-2">vs {comp.opponent}</span>}
              </p>
              {comp.finish && (
                <p className="text-zinc-400 text-xs">{t("csv.header.finish")}: {comp.finish}</p>
              )}
              {comp.event && (
                <p className="text-zinc-400 text-xs">{t("csv.header.event")}: {comp.event}</p>
              )}
            </div>
          )}

          {/* Roll data */}
          {roll && (
            <div className="bg-white/5 rounded-xl p-3 space-y-1.5">
              <p className="text-xs text-zinc-400 uppercase tracking-wide">{t("training.rollDetailsTitle")}</p>
              <p className="text-zinc-300 text-sm">{formatRollBadge(roll)}</p>
            </div>
          )}

          {/* Notes */}
          {userNotes && (
            <div>
              <p className="text-xs text-zinc-400 uppercase tracking-wide mb-1">{t("csv.header.notes")}</p>
              <p className="text-zinc-300 text-sm whitespace-pre-wrap">{userNotes}</p>
            </div>
          )}

          {/* Instructor / partner */}
          {(log.instructor || log.partner) && (
            <div className="flex gap-4 text-xs text-zinc-400 pt-2 border-t border-white/5">
              {log.instructor && <span>👨‍🏫 {log.instructor}</span>}
              {log.partner && <span>🤝 {log.partner}</span>}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
