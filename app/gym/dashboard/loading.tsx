import Skeleton from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="min-h-[100dvh] bg-zinc-950 px-4 py-6">
      <div className="max-w-4xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
        <div className="grid gap-3 mt-6">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
