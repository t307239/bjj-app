/**
 * /legal/tokushoho — z255d: 3 言語対応 (EN canonical / JA / PT — translated via Gemini)
 * 翻訳キー: messages/{en,ja,pt}.json の tokushoho.* 配下、scripts/translate_legal_pages.py で生成
 *
 * 注: bilingual labels (例: "Seller (販売業者)") は日本特定商取引法の慣例で
 * EN locale でも JA 併記を保持。
 */
import type { Metadata } from "next";
import Link from "next/link";
import { detectServerLocale, makeT } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "Specified Commercial Transactions Act",
  description:
    "Disclosure of merchant information required by the Specified Commercial Transactions Act (tokutei shotorihiki ho).",
  robots: { index: false, follow: false },
};

export default async function TokushohoPage() {
  const locale = await detectServerLocale();
  const t = makeT(locale);

  return (
    <main className="min-h-[100dvh] bg-zinc-950 text-white py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-8">{t("tokushoho.title")}</h1>
        <p className="text-zinc-400 text-sm mb-8">{t("tokushoho.subtitle")}</p>

        <div className="space-y-6">
          <Row label={t("tokushoho.labels.seller")} value={t("tokushoho.values.sellerVal")} />
          <Row label={t("tokushoho.labels.personInCharge")} value={t("tokushoho.values.personInChargeVal")} />
          <Row
            label={t("tokushoho.labels.address")}
            value={t("tokushoho.values.addressVal")}
            note={t("tokushoho.values.addressNote")}
          />
          <Row
            label={t("tokushoho.labels.phone")}
            value={t("tokushoho.values.phoneVal")}
            note={t("tokushoho.values.phoneNote")}
          />
          <Row label={t("tokushoho.labels.email")} value="307239t777@gmail.com" />

          <hr className="border-white/10" />

          <Row
            label={t("tokushoho.labels.product")}
            values={[
              t("tokushoho.values.product1"),
              t("tokushoho.values.product2"),
              t("tokushoho.values.product3"),
            ]}
          />
          <Row
            label={t("tokushoho.labels.price")}
            values={[
              t("tokushoho.values.price1"),
              t("tokushoho.values.price2"),
            ]}
            note={t("tokushoho.values.priceNote")}
          />
          <Row label={t("tokushoho.labels.feesOther")} value={t("tokushoho.values.feesOtherVal")} />
          <Row label={t("tokushoho.labels.paymentMethod")} value={t("tokushoho.values.paymentMethodVal")} />
          <Row label={t("tokushoho.labels.paymentTiming")} value={t("tokushoho.values.paymentTimingVal")} />
          <Row label={t("tokushoho.labels.serviceDelivery")} value={t("tokushoho.values.serviceDeliveryVal")} />

          <hr className="border-white/10" />

          <Row
            label={t("tokushoho.labels.cancellation")}
            values={[
              t("tokushoho.values.cancellation1"),
              t("tokushoho.values.cancellation2"),
              t("tokushoho.values.cancellation3"),
              t("tokushoho.values.cancellation4"),
            ]}
          />
          <Row label={t("tokushoho.labels.autoRenewal")} value={t("tokushoho.values.autoRenewalVal")} />
          <Row label={t("tokushoho.labels.howSubscribe")} value={t("tokushoho.values.howSubscribeVal")} />
          <Row label={t("tokushoho.labels.contractDate")} value={t("tokushoho.values.contractDateVal")} />
          <Row label={t("tokushoho.labels.systemReq")} value={t("tokushoho.values.systemReqVal")} />
        </div>

        <div className="mt-12 text-center text-zinc-400 text-xs space-y-1">
          <p>{t("tokushoho.lastUpdated")}</p>
          <div className="flex justify-center gap-4">
            <a href="/terms" className="hover:text-white transition-colors">{t("tokushoho.footerTerms")}</a>
            <a href="/privacy" className="hover:text-white transition-colors">{t("tokushoho.footerPrivacy")}</a>
            <Link href="/" className="hover:text-white transition-colors">{t("tokushoho.footerHome")}</Link>
          </div>
        </div>
      </div>
    </main>
  );
}

function Row({
  label,
  value,
  values,
  note,
}: {
  label: string;
  value?: string;
  values?: string[];
  note?: string;
}) {
  return (
    <div>
      <dt className="text-sm font-semibold text-zinc-300 mb-1">{label}</dt>
      {value && <dd className="text-sm text-zinc-400 leading-relaxed">{value}</dd>}
      {values && (
        <dd className="text-sm text-zinc-400 leading-relaxed">
          <ul className="list-disc list-inside space-y-1">
            {values.map((v, i) => (
              <li key={i}>{v}</li>
            ))}
          </ul>
        </dd>
      )}
      {note && <dd className="text-xs text-zinc-400 mt-1 italic">{note}</dd>}
    </div>
  );
}
