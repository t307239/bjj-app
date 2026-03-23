"use client";

import { useLocale } from "@/lib/i18n";

interface Quote {
  textKey: string;
  authorKey: string;
}

const QUOTES: Quote[] = [
  { textKey: "quote.1.text", authorKey: "quote.1.author" },
  { textKey: "quote.2.text", authorKey: "quote.2.author" },
  { textKey: "quote.3.text", authorKey: "quote.3.author" },
  { textKey: "quote.4.text", authorKey: "quote.4.author" },
  { textKey: "quote.5.text", authorKey: "quote.5.author" },
  { textKey: "quote.6.text", authorKey: "quote.6.author" },
  { textKey: "quote.7.text", authorKey: "quote.7.author" },
  { textKey: "quote.8.text", authorKey: "quote.8.author" },
  { textKey: "quote.9.text", authorKey: "quote.9.author" },
  { textKey: "quote.10.text", authorKey: "quote.10.author" },
  { textKey: "quote.11.text", authorKey: "quote.11.author" },
  { textKey: "quote.12.text", authorKey: "quote.12.author" },
  { textKey: "quote.13.text", authorKey: "quote.13.author" },
  { textKey: "quote.14.text", authorKey: "quote.14.author" },
];

export default function DailyQuote() {
  const { t } = useLocale();
  const now = new Date();
  const dayOfYear = Math.floor(
    (now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000
  );
  const quoteIndex = dayOfYear % QUOTES.length;
  const quote = QUOTES[quoteIndex];

  return (
    <div className="bg-zinc-900/60 rounded-xl px-4 py-3 border border-white/5 mb-4">
      <p className="text-gray-300 text-xs leading-relaxed italic pl-4 border-l-2 border-white/20">
        {t(quote.textKey)}
      </p>
      <p className="text-gray-600 text-[10px] mt-1.5 pl-4">— {t(quote.authorKey)}</p>
    </div>
  );
}
