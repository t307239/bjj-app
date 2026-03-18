/**
 * Utility functions for encoding/decoding competition data
 * stored in the training_logs.notes field.
 *
 * Format:  __comp__{JSON}\n{userNotes}
 * Example: __comp__{"result":"win","opponent":"Tanaka","finish":"submission",
 *                    "event":"IBJJF Tokyo","opponent_rank":"blue","gi_type":"gi"}
 *          Optional user note text on the next line
 */

export type CompData = {
  result: string;
  opponent: string;
  finish: string;
  event: string;
  opponent_rank: string;
  gi_type: string;
};

export const COMP_PREFIX = "__comp__";

export const RESULT_LABELS: Record<string, { label: string; color: string }> = {
  win:  { label: "Win 🏆",   color: "text-green-400" },
  loss: { label: "Loss",     color: "text-red-400" },
  draw: { label: "Draw",     color: "text-yellow-400" },
};

export function encodeCompNotes(comp: CompData, userNotes: string): string {
  const filled = Object.values(comp).some((v) => v.trim() !== "");
  if (!filled) return userNotes;
  const jsonStr = JSON.stringify(comp);
  return userNotes.trim()
    ? `${COMP_PREFIX}${jsonStr}\n${userNotes}`
    : `${COMP_PREFIX}${jsonStr}`;
}

export function decodeCompNotes(notes: string): {
  comp: CompData | null;
  userNotes: string;
} {
  if (!notes || !notes.startsWith(COMP_PREFIX)) {
    return { comp: null, userNotes: notes };
  }
  const nl = notes.indexOf("\n");
  const jsonStr =
    nl === -1
      ? notes.slice(COMP_PREFIX.length)
      : notes.slice(COMP_PREFIX.length, nl);
  const userNotes = nl === -1 ? "" : notes.slice(nl + 1);
  try {
    return { comp: JSON.parse(jsonStr) as CompData, userNotes };
  } catch {
    return { comp: null, userNotes: notes };
  }
}

/** Format minutes as "1h30m" or "45m" */
export function formatDuration(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h${m}m` : `${h}h`;
}

/** Empty CompData object */
export const emptyCompData = (): CompData => ({
  result: "",
  opponent: "",
  finish: "",
  event: "",
  opponent_rank: "",
  gi_type: "",
});
