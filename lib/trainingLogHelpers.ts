// Shared types and helpers for TrainingLog components
export { getLocalDateString } from "@/lib/timezone";

export type TrainingEntry = {
  id: string;
  date: string;
  duration_min: number;
  type: string;
  notes: string;
  created_at: string;
  /** B-04: Instructor name (optional) */
  instructor_name?: string | null;
  /** B-09: Sparring partner username (optional) */
  partner_username?: string | null;
};

export type CompData = {
  result: string;
  opponent: string;
  finish: string;
  event: string;
  opponent_rank: string;
  gi_type: string;
};

export const COMP_PREFIX = "__comp__";

export const BELT_RANKS = [
  { value: "", label: "Unknown" },
  { value: "white", label: "White Belt" },
  { value: "blue", label: "Blue Belt" },
  { value: "purple", label: "Purple Belt" },
  { value: "brown", label: "Brown Belt" },
  { value: "black", label: "Black Belt" },
];

export function formatDuration(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h${m}m` : `${h}h`;
}

export function encodeCompNotes(comp: CompData, userNotes: string): string {
  const filled = Object.values(comp).some((v) => v.trim() !== "");
  if (!filled) return userNotes;
  const jsonStr = JSON.stringify(comp);
  return userNotes.trim() ? `${COMP_PREFIX}${jsonStr}\n${userNotes}` : `${COMP_PREFIX}${jsonStr}`;
}

export function decodeCompNotes(notes: string): { comp: CompData | null; userNotes: string } {
  if (!notes || !notes.startsWith(COMP_PREFIX)) return { comp: null, userNotes: notes };
  const nl = notes.indexOf("\n");
  const jsonStr = nl === -1 ? notes.slice(COMP_PREFIX.length) : notes.slice(COMP_PREFIX.length, nl);
  const userNotes = nl === -1 ? "" : notes.slice(nl + 1);
  try {
    const comp = JSON.parse(jsonStr) as CompData;
    return { comp, userNotes };
  } catch {
    return { comp: null, userNotes: notes };
  }
}

export const RESULT_LABELS: Record<string, { label: string; color: string }> = {
  win:  { label: "Win 🏆", color: "text-green-400" },
  loss: { label: "Loss", color: "text-red-400" },
  draw: { label: "Draw", color: "text-yellow-400" },
};

export function buildXShareUrl(entry: { date: string; duration_min: number; type: string; notes: string }): string {
  const typeLabels: Record<string, string> = {
    gi: "Gi", nogi: "No-Gi", drilling: "Drilling", competition: "Competition", open_mat: "Open Mat",
  };
  const dur = entry.duration_min >= 60
    ? `${Math.floor(entry.duration_min / 60)}h${entry.duration_min % 60 > 0 ? `${entry.duration_min % 60}m` : ""}`
    : `${entry.duration_min}m`;
  const lines = [
    `🥋 Just trained BJJ! (${entry.date})`,
    `⏱ ${dur} | ${typeLabels[entry.type] ?? entry.type}`,
    entry.notes ? `📝 ${entry.notes}` : "",
    "",
    "Training Log → https://bjj-app.net",
    "#BJJ #JiuJitsu #BrazilianJiuJitsu",
  ].filter(Boolean).join("\n");
  return `https://x.com/intent/tweet?text=${encodeURIComponent(lines)}`;
}
