/**
 * B-07: Skeleton Loader コンポーネント
 * animate-pulse で視覚的なローディング状態を表示。
 * 使い方: <Skeleton height={120} className="mb-4" />
 */
type SkeletonProps = {
  height?: number | string;
  width?: number | string;
  className?: string;
  rounded?: "md" | "lg" | "xl" | "2xl" | "full";
};

export default function Skeleton({
  height = 60,
  width = "100%",
  className = "",
  rounded = "xl",
}: SkeletonProps) {
  const roundedClass = {
    md: "rounded-md",
    lg: "rounded-lg",
    xl: "rounded-xl",
    "2xl": "rounded-2xl",
    full: "rounded-full",
  }[rounded];

  return (
    <div
      className={`animate-pulse bg-zinc-800/60 ${roundedClass} ${className}`}
      style={{ height, width }}
      aria-hidden="true"
    />
  );
}

/** 複数のSkeletonをまとめたカードスケルトン */
export function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <div className={`bg-zinc-900/50 rounded-2xl p-4 border border-white/10 ${className}`} aria-hidden="true">
      <Skeleton height={12} width="40%" rounded="md" className="mb-3" />
      <Skeleton height={48} width="60%" rounded="lg" className="mb-2" />
      <Skeleton height={10} width="30%" rounded="md" />
    </div>
  );
}
