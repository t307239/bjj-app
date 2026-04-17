/**
 * lib/trainingTypes.ts — Training session type definitions.
 *
 * Central registry of all BJJ training types with display metadata.
 * Used by TrainingLog forms, charts, and PDF export.
 *
 * @example
 *   import { TRAINING_TYPES, TrainingTypeValue } from "@/lib/trainingTypes";
 *   const label = TRAINING_TYPES.find(t => t.value === "gi")?.label;
 */
export const TRAINING_TYPES = [
  { value: "gi",          label: "Gi",          color: "bg-blue-500/20 text-blue-300",     icon: "🥋" },
  { value: "nogi",        label: "No-Gi",       color: "bg-orange-500/20 text-orange-300", icon: "👕" },
  { value: "drilling",    label: "Drilling",    color: "bg-purple-500/20 text-purple-300", icon: "🎯" },
  { value: "competition", label: "Competition", color: "bg-red-500/20 text-red-300",       icon: "🏆" },
  { value: "open_mat",    label: "Open Mat",    color: "bg-green-500/20 text-green-300",   icon: "🤝" },
  { value: "recovery",    label: "Recovery",    color: "bg-teal-500/20 text-teal-300",     icon: "🧘" },
] as const;

export type TrainingTypeValue = typeof TRAINING_TYPES[number]["value"];
