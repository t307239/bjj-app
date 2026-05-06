/**
 * /contact — z255oo: お問い合わせ / バグ報告 form
 *
 * Public page (no auth required). 3 locale 対応 (ja/en/pt) via generateMetadata.
 */
import type { Metadata } from "next";
import { detectServerLocale } from "@/lib/i18n";
import ContactForm from "@/components/ContactForm";

const META = {
  en: {
    title: "Contact / Bug Report",
    desc: "Report bugs, request features, or ask questions. We read every message.",
  },
  ja: {
    title: "お問い合わせ / バグ報告",
    desc: "バグ報告・機能リクエスト・質問など、お気軽にお送りください。すべて確認します。",
  },
  pt: {
    title: "Contato / Reportar Bug",
    desc: "Reporte bugs, peça features ou tire dúvidas. Lemos todas as mensagens.",
  },
} as const;

export async function generateMetadata(): Promise<Metadata> {
  const locale = await detectServerLocale();
  const m = META[locale === "ja" ? "ja" : locale === "pt" ? "pt" : "en"];
  return {
    title: m.title,
    description: m.desc,
    alternates: { canonical: "https://bjj-app.net/contact" },
    openGraph: {
      type: "website",
      url: "https://bjj-app.net/contact",
      siteName: "BJJ App",
      title: m.title,
      description: m.desc,
      locale: locale === "ja" ? "ja_JP" : locale === "pt" ? "pt_BR" : "en_US",
    },
  };
}

export default async function ContactPage() {
  const locale = await detectServerLocale();
  return <ContactForm locale={locale} />;
}
