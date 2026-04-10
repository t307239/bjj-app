// ─── Shared types for Gym Dashboard components ──────────────────────────────

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

export type RiskLevel = "green" | "yellow" | "red";

// ─── Belt color helper ────────────────────────────────────────────────────────

export function beltColor(belt: string): string {
  switch (belt) {
    case "black": return "bg-zinc-900 text-white border-zinc-600";
    case "brown": return "bg-amber-900/50 text-amber-200 border-amber-700";
    case "purple": return "bg-purple-900/50 text-purple-200 border-purple-500";
    case "blue": return "bg-blue-900/50 text-blue-200 border-blue-500";
    default: return "bg-zinc-700/50 text-white border-zinc-500"; // white
  }
}

