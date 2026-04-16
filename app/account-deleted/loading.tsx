export default function AccountDeletedLoading() {
  return (
    <div className="min-h-[100dvh] bg-zinc-950 flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="h-12 w-12 bg-white/10 rounded-full animate-pulse mx-auto" />
        <div className="h-6 w-48 bg-white/10 rounded animate-pulse mx-auto" />
        <div className="h-4 w-64 bg-zinc-800 rounded animate-pulse mx-auto" />
      </div>
    </div>
  );
}
