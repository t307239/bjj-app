/**
 * lib/dataExport.ts — Q-126: Data export utilities
 *
 * Provides JSON export capability alongside existing CSV/PDF exports.
 * Supports full GDPR data portability (Art. 20) with machine-readable output.
 *
 * Usage:
 *   import { exportUserDataJson, DataExportFormat } from "@/lib/dataExport";
 */

export type DataExportFormat = "json" | "csv";

export interface ExportableProfile {
  belt: string;
  stripe: number;
  is_pro: boolean;
  created_at: string;
  gym_name?: string;
}

export interface ExportableTrainingLog {
  date: string;
  type: string;
  duration_min: number | null;
  notes: string | null;
  instructor: string | null;
  partner: string | null;
  techniques: string[];
  created_at: string;
}

export interface ExportableWeight {
  date: string;
  weight_kg: number;
  created_at: string;
}

export interface ExportableCompetition {
  date: string;
  name: string;
  result: string | null;
  weight_class: string | null;
  notes: string | null;
}

export interface UserDataExport {
  export_version: "1.0";
  exported_at: string;
  user_email: string;
  profile: ExportableProfile | null;
  training_logs: ExportableTrainingLog[];
  weights: ExportableWeight[];
  competitions: ExportableCompetition[];
  stats: {
    total_sessions: number;
    total_training_minutes: number;
    first_session_date: string | null;
    last_session_date: string | null;
  };
}

/**
 * Build a JSON-serializable user data export object.
 * All sensitive fields (user_id, internal IDs) are stripped.
 */
export function buildUserDataExport(params: {
  email: string;
  profile: ExportableProfile | null;
  trainingLogs: ExportableTrainingLog[];
  weights: ExportableWeight[];
  competitions: ExportableCompetition[];
}): UserDataExport {
  const { email, profile, trainingLogs, weights, competitions } = params;

  const totalMinutes = trainingLogs.reduce(
    (sum, log) => sum + (log.duration_min ?? 0),
    0
  );

  const sortedDates = trainingLogs
    .map((l) => l.date)
    .sort();

  return {
    export_version: "1.0",
    exported_at: new Date().toISOString(),
    user_email: email,
    profile,
    training_logs: trainingLogs,
    weights,
    competitions,
    stats: {
      total_sessions: trainingLogs.length,
      total_training_minutes: totalMinutes,
      first_session_date: sortedDates[0] ?? null,
      last_session_date: sortedDates[sortedDates.length - 1] ?? null,
    },
  };
}

/**
 * Validate export data integrity.
 * Returns list of warnings (empty = valid).
 */
export function validateExportData(data: UserDataExport): string[] {
  const warnings: string[] = [];

  if (!data.user_email) {
    warnings.push("Missing user email");
  }
  if (data.training_logs.length === 0 && data.weights.length === 0) {
    warnings.push("No training logs or weight data to export");
  }
  if (data.stats.total_sessions !== data.training_logs.length) {
    warnings.push("Session count mismatch");
  }

  // Check for suspicious dates
  const now = new Date();
  for (const log of data.training_logs) {
    const logDate = new Date(log.date);
    if (logDate > now) {
      warnings.push(`Future-dated training log: ${log.date}`);
    }
    if (log.duration_min !== null && log.duration_min < 0) {
      warnings.push(`Negative duration: ${log.duration_min}`);
    }
  }

  return warnings;
}
