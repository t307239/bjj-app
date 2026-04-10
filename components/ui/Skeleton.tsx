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
