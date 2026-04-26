/**
 * /unsubscribe — z187: User-facing confirmation after 1-click unsubscribe.
 *
 * No DB write here — just shows status from ?status query (set by /api/unsubscribe).
 * locale-aware copy.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { detectServerLocale } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Unsubscribe",
  robots: { index: false, follow: false },
};

const COPY = {
  ja: {
    okTitle: "✅ メール配信を停止しました",
    okBody: "今後マーケティングメール (新機能の案内、アップグレード案内など) は届きません。週次レポート等のサービスメールは設定から個別に管理できます。",
    okBack: "トップに戻る",
    errTitle: "❌ 配信停止できませんでした",
    errBody: "リンクが期限切れか、無効です。アプリの設定から手動で停止できます。",
    errBack: "アプリ設定へ",
  },
  pt: {
    okTitle: "✅ Cancelamento confirmado",
    okBody: "Você não receberá mais e-mails de marketing (anúncios de novos recursos, upgrades). E-mails de serviço (relatório semanal etc.) podem ser gerenciados individualmente nas configurações.",
    okBack: "Voltar ao início",
    errTitle: "❌ Não foi possível cancelar",
    errBody: "O link expirou ou é inválido. Você pode cancelar manualmente nas configurações do app.",
    errBack: "Ir para configurações",
  },
  en: {
    okTitle: "✅ Unsubscribed successfully",
    okBody: "You won't receive marketing emails (new features, upgrades) anymore. Service emails (weekly report etc.) can still be managed individually in settings.",
    okBack: "Back to home",
    errTitle: "❌ Couldn't unsubscribe",
    errBody: "The link is expired or invalid. You can unsubscribe manually in app settings.",
    errBack: "Go to settings",
  },
} as const;

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string; reason?: string }>;
}) {
  const sp = searchParams ? await searchParams : {};
  const ok = sp.status === "ok";
  const locale = await detectServerLocale();
  const c = COPY[locale === "ja" ? "ja" : locale === "pt" ? "pt" : "en"];

  return (
    <div className="min-h-[100dvh] bg-zinc-950 flex items-center justify-center px-4">
      <div className="max-w-lg w-full text-center">
        <h1 className="text-2xl font-bold text-white mb-4">
          {ok ? c.okTitle : c.errTitle}
        </h1>
        <p className="text-zinc-300 leading-relaxed mb-8">
          {ok ? c.okBody : c.errBody}
        </p>
        <Link
          href={ok ? "/" : "/settings"}
          className="inline-block bg-emerald-500 hover:bg-emerald-400 text-white font-bold py-3 px-6 rounded-xl"
        >
          {ok ? c.okBack : c.errBack}
        </Link>
      </div>
    </div>
  );
}
