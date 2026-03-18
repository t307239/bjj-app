export const TRAINING_TYPES = [
  { value: "gi",          label: "道衣 (Gi)",      color: "bg-blue-500/20 text-blue-300",   icon: "🥋" },
  { value: "nogi",        label: "ノーギ (No-Gi)",  color: "bg-orange-500/20 text-orange-300", icon: "👕" },
  { value: "drilling",    label: "ドリル",           color: "bg-purple-500/20 text-purple-300", icon: "🎯" },
  { value: "competition", label: "試合",             color: "bg-red-500/20 text-red-300",     icon: "🏆" },
  { value: "open_mat",    label: "オープンマット",   color: "bg-green-500/20 text-green-300", icon: "🤝" },
] as const;

export type TrainingTypeValue = typeof TRAINING_TYPES[number]["value"];
