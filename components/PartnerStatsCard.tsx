"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/lib/i18n";
import { clientLogger } from "@/lib/clientLogger";

const TOP_N = 5;
const UNLOCK_AT = 5;

type PartnerRecord = {
  partner_username: string | null;
};

type PartnerStat = {
  username: string;
  count: number;
  pct: number;
};

// ── Sub-components ────────────────────────────────────────────────────────────
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold text-zinc-400 tracking-wide uppercase mb-2">
      {children}
    </p>
  );
}

function BarRow({ label, count, pct, accent }: { label: string; count: number; pct: number; accent?: string }) {
  return (
    <div className="mb-2">
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-xs text-zinc-300 truncate max-w-[70%]">@{label}</span>
        <span className="text-xs text-zinc-500 flex-shrink-0">{count}</span>
      </div>
      <div className="w-full h-1.5 bg-zinc-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${accent ?? "bg-violet-500"}`}
          style={{ width: `${Math.max(pct, 2)}%` }}
        />
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function PartnerStatsCard({ userId }: { userId: string }) {
  const { t } = useLocale();
  const [stats, setStats] = useState<PartnerStat[]>([]);
  const [totalWithPartner, setTotalWithPartner] = useState(0);
  const [uniqueCount, setUniqueCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("training_logs")
        .select("partner_username")
        .eq("user_id", userId)
        .not("partner_username", "is", null)
        .neq("partner_username", "");
      if (error) clientLogger.error("partnerstatscard.query", {}, error);

      if (!data) { setLoading(false); return; }

      const rows = data as PartnerRecord[];
      const counts: Record<string, number> = {};
      for (const r of rows) {
        const p = r.partner_username?.trim();
        if (p) counts[p] = (counts[p] ?? 0) + 1;
      }

      const total = rows.length;
      const unique = Object.keys(counts).length;
      const sorted: PartnerStat[] = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, TOP_N)
        .map(([username, count]) => ({
          username,
          count,
          pct: total > 0 ? Math.round((count / total) * 100) : 0,
        }));

      setStats(sorted);
      setTotalWithPartner(total);
      setUniqueCount(unique);
      setLoading(false);
    };
    void load();
  }, [userId]);

  if (loading) {
    return (
      <div className="bg-zinc-900/50 ring-1 ring-inset ring-white/[0.04] shadow-lg shadow-black/40 rounded-2xl p-4 animate-pulse">
        <div className="h-4 bg-zinc-800 rounded w-1/3 mb-3" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-3 bg-zinc-800 rounded" />)}
        </div>
      </div>
    );
  }

  const notEnough = totalWithPartner < UNLOCK_AT;

  return (
    <div className="bg-zinc-900/50 ring-1 ring-inset ring-white/[0.04] shadow-lg shadow-black/40 rounded-2xl p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-base">🤼</span>
          <span className="text-sm font-semibold text-white">
            {t("partnerStats.title")}
          </span>
        </div>
        {!notEnough && (
          <div className="flex gap-3 text-xs text-zinc-500">
            <span>{t("partnerStats.uniquePartners", { n: String(uniqueCount) })}</span>
            <span>{t("partnerStats.rolledWith", { n: String(totalWithPartner) })}</span>
          </div>
        )}
      </div>

      {notEnough ? (
        /* Unlock hint */
        <div className="text-center py-4">
          <p className="text-xs text-zinc-400 mb-1">
            {(() => {
              const remaining = UNLOCK_AT - totalWithPartner;
              return remaining === 1
                ? t("partnerStats.unlockHintOne")
                : t("partnerStats.unlockHint", { n: String(remaining) });
            })()}
          </p>
          <p className="text-[11px] text-zinc-600">
            {t("partnerStats.unlockTip")}
          </p>
        </div>
      ) : (
        <>
          {/* Top partners */}
          <SectionTitle>{t("partnerStats.topPartners")}</SectionTitle>
          <div className="mb-4">
            {stats.map((s, i) => (
              <BarRow
                key={s.username}
                label={s.username}
                count={s.count}
                pct={s.pct}
                accent={
                  i === 0 ? "bg-violet-500" :
                  i === 1 ? "bg-indigo-500" :
                  i === 2 ? "bg-blue-500" :
                             "bg-zinc-500"
                }
              />
            ))}
          </div>

          {/* Compatibility insight */}
          {stats.length > 0 && (
            <div className="pt-3 border-t border-white/8">
              <SectionTitle>{t("partnerStats.insights")}</SectionTitle>
              <div className="bg-zinc-800/60 rounded-xl p-3 text-xs text-zinc-400 leading-relaxed">
                {stats[0] && (
                  <p>
                    {t("partnerStats.mostFrequentInsight", {
                      partner: stats[0].username,
                      count: String(stats[0].count),
                      pct: String(stats[0].pct),
                    })}
                  </p>
                )}
                {uniqueCount >= 3 && (
                  <p className="mt-1">
                    {t("partnerStats.diversityInsight", { n: String(uniqueCount) })}
                  </p>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
