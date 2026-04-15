/**
 * lib/api/ — Domain-specific Supabase query layer
 *
 * Each module exports pure async functions that accept a SupabaseClient
 * and return typed results. No React state — usable from hooks, server
 * components, API routes, and scripts alike.
 *
 * Usage:
 *   import { fetchTrainingLogs } from "@/lib/api/training";
 *   import { fetchProfile } from "@/lib/api/profiles";
 *   import { countTechniques } from "@/lib/api/techniques";
 */

export { fetchTrainingLogs, fetchTrainingSummary, countTrainingLogs } from "./training";
export type { TrainingLogRow, TrainingSummary } from "./training";

export { fetchProfile, fetchProStatus, updateProfile } from "./profiles";
export type { ProfileView, ProfileUpdatePayload } from "./profiles";

export { fetchTechniques, countTechniques, fetchTechniqueSummary } from "./techniques";
export type { TechniqueRow, TechniqueSummary } from "./techniques";
