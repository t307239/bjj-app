import Link from "next/link";
import { detectServerLocale, makeT } from "@/lib/i18n";

export default async function NotFound() {
  const locale = await detectServerLocale();
  const t = makeT(locale);

  return (
    <main className="min-h-[100dvh] bg-zinc-950 flex flex-col items-center justify-center px-4 text-center">
      <div className="text-6xl mb-4">🥋</div>
      <h1 className="text-4xl font-bold text-white mb-2">404</h1>
      <p className="text-zinc-400 mb-6 text-sm max-w-sm">{t("notFound.description")}</p>
      <Link
        href="/"
        className="bg-zinc-700 hover:bg-zinc-600 text-white font-semibold py-2 px-6 rounded-full transition-colors text-sm"
      >
        {t("notFound.backHome")}
      </Link>
    </main>
  );
}
