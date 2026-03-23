import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-[100dvh] flex flex-col items-center justify-center px-4 text-center">
      <div className="text-6xl mb-4">🥋</div>
      <h1 className="text-4xl font-bold mb-2">404</h1>
      <p className="text-gray-400 mb-6">Page not found</p>
      <Link
        href="/"
        className="bg-zinc-700 hover:bg-zinc-600 text-white font-semibold py-2 px-6 rounded-full transition-colors"
      >
        Back to Home
      </Link>
    </main>
  );
}
