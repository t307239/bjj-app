/**
 * /contact — z255oo: お問い合わせ / バグ報告 form
 * z260h: og:image / twitter:image / ContactPoint JSON-LD 追加
 *
 * Public page (no auth required). 3 locale 対応 (ja/en/pt) via generateMetadata.
 */
import type { Metadata } from "next";
import { detectServerLocale } from "@/lib/i18n";
import { safeJsonLd } from "@/lib/safeJsonLd";
import ContactForm from "@/components/ContactForm";

const CONTACT_OG_IMAGE = "https://bjj-app.net/api/og?belt=white&count=0&months=0&streak=0&mode=lp";

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
      images: [{ url: CONTACT_OG_IMAGE, width: 1200, height: 630, alt: "BJJ App Contact" }],
      locale: locale === "ja" ? "ja_JP" : locale === "pt" ? "pt_BR" : "en_US",
    },
    twitter: {
      card: "summary_large_image",
      title: m.title,
      description: m.desc,
      images: [CONTACT_OG_IMAGE],
    },
  };
}

// z260h: ContactPage + Organization.contactPoint で SERP に正式 contact 情報を伝える
const contactJsonLd = {
  "@context": "https://schema.org",
  "@type": "ContactPage",
  name: "Contact BJJ App",
  url: "https://bjj-app.net/contact",
  description: "Contact form for BJJ App bug reports, feature requests, and general inquiries.",
  isPartOf: {
    "@type": "WebSite",
    name: "BJJ App",
    url: "https://bjj-app.net",
  },
};

export default async function ContactPage() {
  const locale = await detectServerLocale();
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(contactJsonLd) }}
      />
      <ContactForm locale={locale} />
    </>
  );
}
