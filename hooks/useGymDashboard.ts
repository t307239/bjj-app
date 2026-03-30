"use client";

/**
 * useGymDashboard — Data layer hook for GymDashboard.
 * Manages member data, Supabase operations, and derived stats.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

// ─── Types ────────────────────────────────────────────────────────────────────

export type MemberRow = {
  student_id: string;
  belt: string;
  stripe_count: number;
  display_name: string | null;
  last_training_date: string | null;
  sessions_last_30d: number;
};

export type Gym = {
  id: string;
  name: string;
  invite_code: string;
  is_active: boolean;
  curriculum_url?: string | null;
  curriculum_set_at?: string | null;
};

// ─── Churn risk helper (shared with component) ────────────────────────────────

export type RiskLevel = "green" | "yellow" | "red";

export function churnRisk(lastDate: string | null, sessions30d: number): RiskLevel {
  if (!lastDate) return "red";
  const diffDays = Math.floor((Date.now() - new Date(lastDate).getTime()) / 86400000);
  if (diffDays > 21 || sessions30d === 0) return "red";
  if (diffDays > 10 || sessions30d <= 1) return "yellow";
  return "green";
}

// ─── Belt color helper (shared with component) ────────────────────────────────

export function beltColor(belt: string): string {
  switch (belt) {
    case "black": return "bg-zinc-900 text-white border-zinc-600";
    case "brown": return "bg-amber-900/50 text-amber-200 border-amber-700";
    case "purple": return "bg-purple-900/50 text-purple-200 border-purple-500";
    case "blue": return "bg-blue-900/50 text-blue-200 border-blue-500";
    default: return "bg-zinc-700/50 text-white border-zinc-500";
  }
}

type UseGymDashboardProps = {
  initialGym: Gym;
  t: (k: string, vars?: Record<string, string | number>) => string;
};

export function useGymDashboard({ initialGym, t }: UseGymDashboardProps) {
  const supabase = useRef(createClient()).current;
  // t is recreated every render by makeT() — use ref to keep deps stable
  const tRef = useRef(t);
  tRef.current = t;

  const [gym, setGym] = useState<Gym>(initialGym);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [kickTarget, setKickTarget] = useState<MemberRow | null>(null);
  const [upgrading, setUpgrading] = useState(false);

  // ── Load members ──────────────────────────────────────────────────────────
  const loadMembers = useCallback(async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, belt, stripe, gym_id, share_data_with_gym")
      .eq("gym_id", gym.id)
      .eq("share_data_with_gym", true);

    if (error || !data) { setLoading(false); return; }

    const memberIds = data.map((m) => m.id);
    if (memberIds.length === 0) { setMembers([]); setLoading(false); return; }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];

    const { data: logs } = await supabase
      .from("training_logs")
      .select("user_id, date")
      .in("user_id", memberIds)
      .order("date", { ascending: false });

    const rows: MemberRow[] = data.map((profile) => {
      const memberLogs = (logs ?? []).filter((l) => l.user_id === profile.id);
      const lastDate = memberLogs[0]?.date ?? null;
      const sessions30 = memberLogs.filter((l) => l.date >= thirtyDaysAgo).length;
      return {
        student_id: profile.id,
        belt: profile.belt ?? "white",
        stripe_count: profile.stripe ?? 0,
        display_name: null,
        last_training_date: lastDate,
        sessions_last_30d: sessions30,
      };
    });

    setMembers(rows);
    setLoading(false);
  }, [gym.id, supabase]);

  useEffect(() => { loadMembers(); }, [loadMembers]);

  // ── Gym upgrade (Stripe Checkout) ────────────────────────────────────────
  const handleGymUpgrade = useCallback(async () => {
    setUpgrading(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "gym" }),
      });
      const data = await res.json() as { url?: string | null; fallback?: boolean; error?: string };
      if (data.error) {
        setToast({ message: data.error, type: "error" }); return;
      }
      if (data.url) {
        window.location.href = data.url;
      } else {
        setToast({ message: "Stripe not configured. Please contact support.", type: "error" });
      }
    } catch {
      setToast({ message: "Network error. Please try again.", type: "error" });
    } finally {
      setUpgrading(false);
    }
  }, []);

  // ── Print leaderboard ─────────────────────────────────────────────────────
  const printLeaderboard = useCallback(() => {
    const now = new Date();
    const monthLabel = now.toLocaleString("en", { month: "long", year: "numeric" });
    const sorted = [...members].sort((a, b) => b.sessions_last_30d - a.sessions_last_30d);
    const rows = sorted
      .map((m, i) => {
        const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`;
        const stripes = m.stripe_count > 0 ? ` ${"▪".repeat(m.stripe_count)}` : "";
        return `<tr>
          <td style="padding:10px 16px;font-weight:700;font-size:18px;">${medal}</td>
          <td style="padding:10px 16px;">${m.display_name ?? "—"}</td>
          <td style="padding:10px 16px;text-transform:capitalize;">${m.belt}${stripes}</td>
          <td style="padding:10px 16px;text-align:center;font-weight:700;">${m.sessions_last_30d}</td>
        </tr>`;
      })
      .join("");
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${gym.name} — Monthly Leaderboard</title>
      <style>
        body{font-family:sans-serif;margin:40px;color:#111}
        h1{font-size:24px;margin-bottom:4px}p{color:#555;font-size:14px;margin:0 0 24px}
        table{width:100%;border-collapse:collapse}
        th{text-align:left;padding:8px 16px;background:#f4f4f4;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:.05em}
        tr:nth-child(even)td{background:#fafafa}
        @media print{@page{margin:20mm}}
      </style></head><body>
      <h1>🏆 ${gym.name} Monthly Leaderboard</h1>
      <p>${monthLabel} · Generated by BJJ App · bjj-app.net</p>
      <table><thead><tr><th>Rank</th><th>Athlete</th><th>Belt</th><th style="text-align:center">Sessions (30d)</th></tr></thead>
      <tbody>${rows}</tbody></table>
      <script>window.onload=()=>window.print();<\/script></body></html>`;
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); }
  }, [members, gym.name]);

  // ── Kick member ───────────────────────────────────────────────────────────
  const handleKickMember = useCallback(async (memberId: string) => {
    try {
      const res = await fetch("/api/gym/kick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ member_id: memberId }),
      });
      if (res.ok) {
        setMembers((prev) => prev.filter((m) => m.student_id !== memberId));
        setToast({ message: tRef.current("gym.memberKicked"), type: "success" });
      } else {
        const data = await res.json().catch(() => ({}));
        setToast({ message: data.error ?? tRef.current("gym.kickFailed"), type: "error" });
      }
    } catch {
      setToast({ message: tRef.current("gym.kickFailed"), type: "error" });
    }
    setKickTarget(null);
  }, []); // t via tRef

  const handleKickRequest = useCallback((member: MemberRow) => {
    setKickTarget(member);
  }, []);

  const handleInviteRegenerated = useCallback((newCode: string) => {
    setGym((prev) => ({ ...prev, invite_code: newCode }));
  }, []);

  // ── Derived stats ──────────────────────────────────────────────────────────
  const greenMembers = members.filter((m) => churnRisk(m.last_training_date, m.sessions_last_30d) === "green");
  const yellowMembers = members.filter((m) => churnRisk(m.last_training_date, m.sessions_last_30d) === "yellow");
  const redMembers = members.filter((m) => churnRisk(m.last_training_date, m.sessions_last_30d) === "red");
  const atRiskCount = yellowMembers.length + redMembers.length;
  const totalSessionsThisMonth = members.reduce((sum, m) => sum + m.sessions_last_30d, 0);
  const avgSessions30d =
    members.length > 0
      ? Math.round((totalSessionsThisMonth / members.length) * 10) / 10
      : 0;

  return {
    gym, setGym,
    members,
    loading,
    toast, setToast,
    kickTarget, setKickTarget,
    upgrading,
    handleGymUpgrade,
    printLeaderboard,
    handleKickMember,
    handleKickRequest,
    handleInviteRegenerated,
    greenMembers,
    yellowMembers,
    redMembers,
    atRiskCount,
    totalSessionsThisMonth,
    avgSessions30d,
  };
}
