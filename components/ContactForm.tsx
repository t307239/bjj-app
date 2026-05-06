"use client";
/**
 * ContactForm — z255oo: 一般 user 向けお問い合わせ / バグ報告 form.
 *
 * Surface: /contact (public)
 * - category radio: bug / feature / question / other
 * - email + name (optional) + message
 * - 自動収集: page URL (referrer or current) + UA
 * - submit → /api/contact → Resend → owner inbox
 */

import { useState } from "react";
import Link from "next/link";
import type { Locale } from "@/lib/i18n";
import { clientLogger } from "@/lib/clientLogger";
import { fetchWithTimeout } from "@/lib/fetchWithRetry";

type Category = "bug" | "feature" | "question" | "other";

const COPY = {
  ja: {
    pageTitle: "お問い合わせ / バグ報告",
    intro: "バグ報告・機能リクエスト・質問など、お気軽にお送りください。すべて確認します (通常 1-3 日以内に返信)。",
    backToApp: "← アプリに戻る",
    categoryLabel: "種類",
    categories: {
      bug: "🐛 バグ報告",
      feature: "💡 機能リクエスト",
      question: "❓ 質問",
      other: "📩 その他",
    },
    nameLabel: "お名前 (任意)",
    namePlaceholder: "例: 田中太郎",
    emailLabel: "メールアドレス",
    emailPlaceholder: "your@email.com",
    emailHint: "返信用に使います。公開されません。",
    messageLabel: "メッセージ",
    messagePlaceholder: {
      bug: "どの画面で何が起きましたか? どう動くべきだと思いますか? (10 文字以上)",
      feature: "どんな機能があると便利ですか? どう使いたいですか? (10 文字以上)",
      question: "ご質問内容を教えてください (10 文字以上)",
      other: "ご用件を教えてください (10 文字以上)",
    } as Record<Category, string>,
    submit: "送信",
    submitting: "送信中…",
    successTitle: "✅ 送信しました",
    successDesc: "ご連絡ありがとうございます。通常 1-3 日以内に返信します。",
    sendAnother: "もう 1 件送る",
    privacy: "送信されたメッセージは bjj-app.net 運営者のみが閲覧します。詳細は",
    privacyLink: "プライバシーポリシー",
  },
  en: {
    pageTitle: "Contact / Bug Report",
    intro: "Report bugs, request features, or ask questions. We read every message (reply within 1-3 days).",
    backToApp: "← Back to app",
    categoryLabel: "Type",
    categories: {
      bug: "🐛 Bug Report",
      feature: "💡 Feature Request",
      question: "❓ Question",
      other: "📩 Other",
    },
    nameLabel: "Name (optional)",
    namePlaceholder: "e.g. John Smith",
    emailLabel: "Email",
    emailPlaceholder: "your@email.com",
    emailHint: "For reply only. Not made public.",
    messageLabel: "Message",
    messagePlaceholder: {
      bug: "Which screen? What happened? What did you expect? (10+ chars)",
      feature: "What feature would help? How would you use it? (10+ chars)",
      question: "What's your question? (10+ chars)",
      other: "Tell us what's on your mind (10+ chars)",
    } as Record<Category, string>,
    submit: "Send",
    submitting: "Sending…",
    successTitle: "✅ Sent",
    successDesc: "Thanks for the message. We'll reply within 1-3 days.",
    sendAnother: "Send another",
    privacy: "Submitted messages are only seen by bjj-app.net owner. See",
    privacyLink: "Privacy Policy",
  },
  pt: {
    pageTitle: "Contato / Reportar Bug",
    intro: "Reporte bugs, peça features ou tire dúvidas. Lemos todas (resposta em 1-3 dias).",
    backToApp: "← Voltar para o app",
    categoryLabel: "Tipo",
    categories: {
      bug: "🐛 Reportar Bug",
      feature: "💡 Pedido de Feature",
      question: "❓ Pergunta",
      other: "📩 Outro",
    },
    nameLabel: "Nome (opcional)",
    namePlaceholder: "ex: João Silva",
    emailLabel: "E-mail",
    emailPlaceholder: "seu@email.com",
    emailHint: "Apenas para resposta. Não fica público.",
    messageLabel: "Mensagem",
    messagePlaceholder: {
      bug: "Qual tela? O que aconteceu? O que esperava? (10+ caracteres)",
      feature: "Qual feature ajudaria? Como usaria? (10+ caracteres)",
      question: "Qual sua pergunta? (10+ caracteres)",
      other: "Conte o que está em mente (10+ caracteres)",
    } as Record<Category, string>,
    submit: "Enviar",
    submitting: "Enviando…",
    successTitle: "✅ Enviado",
    successDesc: "Obrigado pela mensagem. Respondemos em 1-3 dias.",
    sendAnother: "Enviar outra",
    privacy: "Mensagens enviadas são vistas apenas pelo dono do bjj-app.net. Ver",
    privacyLink: "Política de Privacidade",
  },
} as const;

interface Props {
  locale: Locale;
}

export default function ContactForm({ locale }: Props) {
  const c = COPY[locale === "ja" ? "ja" : locale === "pt" ? "pt" : "en"];

  const [category, setCategory] = useState<Category>("bug");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending) return;
    setSending(true);
    setErrorMsg(null);
    try {
      const pageContext =
        typeof document !== "undefined" ? document.referrer || "" : "";
      const userAgent =
        typeof navigator !== "undefined" ? navigator.userAgent : "";

      const res = await fetchWithTimeout("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || undefined,
          email: email.trim(),
          category,
          message: message.trim(),
          pageContext: pageContext || undefined,
          userAgent: userAgent.slice(0, 500) || undefined,
        }),
        timeoutMs: 15_000,
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        setErrorMsg(json.error ?? "送信に失敗しました。");
        setSending(false);
        return;
      }
      setDone(true);
      // Reset form for re-use
      setName("");
      setEmail("");
      setMessage("");
      setCategory("bug");
      setSending(false);
    } catch (err) {
      clientLogger.error("contact.submit_failed", {}, err as Error);
      setErrorMsg("ネットワークエラー。時間をおいて再度お試しください。");
      setSending(false);
    }
  };

  return (
    <main className="min-h-[100dvh] bg-zinc-950 text-white py-10 px-4">
      <div className="max-w-xl mx-auto">
        <Link
          href="/dashboard"
          className="text-xs text-zinc-400 hover:text-white transition-colors inline-block mb-4"
        >
          {c.backToApp}
        </Link>

        <h1 className="text-2xl font-bold mb-2">{c.pageTitle}</h1>
        <p className="text-sm text-zinc-400 mb-6 leading-relaxed">{c.intro}</p>

        {done ? (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-6 text-center">
            <h2 className="text-lg font-bold text-emerald-300 mb-2">
              {c.successTitle}
            </h2>
            <p className="text-sm text-zinc-300 mb-4">{c.successDesc}</p>
            <button
              type="button"
              onClick={() => setDone(false)}
              className="text-sm text-emerald-400 hover:text-emerald-300 underline underline-offset-2"
            >
              {c.sendAnother}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {/* Category */}
            <fieldset>
              <legend className="text-xs font-semibold text-zinc-300 mb-2">
                {c.categoryLabel}
              </legend>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(Object.keys(c.categories) as Category[]).map((k) => (
                  <label
                    key={k}
                    className={`cursor-pointer text-xs px-3 py-2 rounded-lg border text-center transition-colors ${
                      category === k
                        ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                        : "bg-zinc-900 border-white/10 text-zinc-400 hover:border-white/20"
                    }`}
                  >
                    <input
                      type="radio"
                      name="category"
                      value={k}
                      checked={category === k}
                      onChange={() => setCategory(k)}
                      className="sr-only"
                    />
                    {c.categories[k]}
                  </label>
                ))}
              </div>
            </fieldset>

            {/* Name (optional) */}
            <div>
              <label htmlFor="contact-name" className="block text-xs font-semibold text-zinc-300 mb-1">
                {c.nameLabel}
              </label>
              <input
                id="contact-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
                placeholder={c.namePlaceholder}
                className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500/50"
              />
            </div>

            {/* Email */}
            <div>
              <label htmlFor="contact-email" className="block text-xs font-semibold text-zinc-300 mb-1">
                {c.emailLabel} <span className="text-red-400">*</span>
              </label>
              <input
                id="contact-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                maxLength={320}
                placeholder={c.emailPlaceholder}
                autoComplete="email"
                className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500/50"
              />
              <p className="text-[11px] text-zinc-500 mt-1">{c.emailHint}</p>
            </div>

            {/* Message */}
            <div>
              <label htmlFor="contact-message" className="block text-xs font-semibold text-zinc-300 mb-1">
                {c.messageLabel} <span className="text-red-400">*</span>
              </label>
              <textarea
                id="contact-message"
                required
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                minLength={10}
                maxLength={5000}
                rows={6}
                placeholder={c.messagePlaceholder[category]}
                className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500/50 resize-y"
              />
              <p className="text-[11px] text-zinc-500 mt-1">
                {message.length} / 5000
              </p>
            </div>

            {/* Error */}
            {errorMsg && (
              <div
                role="alert"
                className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-sm text-red-300"
              >
                ⚠️ {errorMsg}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={
                sending ||
                !email.trim() ||
                message.trim().length < 10
              }
              className="w-full bg-emerald-500 hover:bg-emerald-400 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed text-black font-bold py-3 rounded-xl transition-all"
            >
              {sending ? c.submitting : c.submit}
            </button>

            <p className="text-[11px] text-zinc-500 text-center pt-2">
              {c.privacy}{" "}
              <Link href="/privacy" className="text-zinc-400 underline underline-offset-2 hover:text-white">
                {c.privacyLink}
              </Link>
              。
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
