import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Specified Commercial Transactions Act | BJJ App",
  description:
    "Disclosure of merchant information required by the Specified Commercial Transactions Act (tokutei shotorihiki ho).",
  robots: { index: false, follow: false },
};

export default function TokushohoPage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-white py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-8">
          Specified Commercial Transactions Act
        </h1>
        <p className="text-gray-400 text-sm mb-8">
          (Disclosure pursuant to Article 11 of the Act on Specified Commercial
          Transactions)
        </p>

        <div className="space-y-6">
          <Row
            label="Seller (販売業者)"
            value="Toshiki Terasawa (寺澤としき) — Sole Proprietor"
          />
          <Row
            label="Person in Charge (販売責任者)"
            value="Toshiki Terasawa (寺澤としき)"
          />
          <Row
            label="Address (所在地)"
            value="Disclosed without delay upon request. Please contact 307239t777@gmail.com"
            note="個人事業主のため、請求があった場合に遅滞なく開示いたします。"
          />
          <Row
            label="Phone (電話番号)"
            value="Disclosed without delay upon request. Please contact 307239t777@gmail.com"
            note="個人事業主のため、請求があった場合に遅滞なく開示いたします。"
          />
          <Row
            label="Email (メールアドレス)"
            value="307239t777@gmail.com"
          />

          <hr className="border-white/10" />

          <Row
            label="Product / Service (商品・サービス)"
            values={[
              "BJJ App Pro — Monthly subscription for advanced training analytics",
              "BJJ App Gym Starter — Monthly subscription for academy management (up to 50 students)",
              "BJJ App Gym Pro — Monthly subscription for academy management (unlimited students)",
            ]}
          />
          <Row
            label="Price (販売価格)"
            values={[
              "Pro: USD $4.99/month (tax inclusive)",
              "Gym Starter: USD $49/month (tax inclusive)",
              "Gym Pro: USD $99/month (tax inclusive)",
            ]}
            note="Prices are in US Dollars. Foreign exchange rates may apply for JPY charges."
          />
          <Row
            label="Fees Other Than Price (商品代金以外の必要料金)"
            value="Internet connection fee and device costs are borne by the user. No additional fees are charged by BJJ App."
          />
          <Row
            label="Payment Method (お支払い方法)"
            value="Credit card via Stripe (Visa, Mastercard, American Express, JCB, Diners Club)"
          />
          <Row
            label="Payment Timing (お支払い時期)"
            value="First charge upon subscription signup. Subsequent charges on the same date each month (auto-renewal)."
          />
          <Row
            label="Service Delivery (サービス提供時期)"
            value="Immediately upon completion of payment. Pro features become accessible within your account."
          />

          <hr className="border-white/10" />

          <Row
            label="Cancellation / Refund Policy (解約・返金について)"
            values={[
              "Cancellation: You may cancel your subscription at any time from your account settings. Cancellation takes effect at the end of the current billing period.",
              "Refund: Refund requests are accepted within 7 days of the initial charge only. Contact 307239t777@gmail.com with your account email.",
              "No refund is available for subsequent monthly charges after the initial 7-day window.",
              "No partial-month refunds are provided upon cancellation.",
            ]}
          />
          <Row
            label="Auto-Renewal (自動更新について)"
            value="Subscriptions are automatically renewed each month. To avoid the next charge, cancel at least 24 hours before your next billing date."
          />
          <Row
            label="How to Subscribe (申込方法)"
            value="Create an account at https://bjj-app.net/login, then upgrade to Pro from the dashboard."
          />
          <Row
            label="Contract Effective Date (契約成立時期)"
            value="The contract is established when payment is confirmed by the payment processor (Stripe)."
          />
          <Row
            label="System Requirements (動作環境)"
            value="Modern web browser (Chrome, Safari, Firefox, Edge). Internet connection required."
          />
        </div>

        <div className="mt-12 text-center text-gray-500 text-xs space-y-1">
          <p>Last updated: March 2026</p>
          <div className="flex justify-center gap-4">
            <a href="/terms" className="hover:text-white transition-colors">
              Terms of Service
            </a>
            <a href="/privacy" className="hover:text-white transition-colors">
              Privacy Policy
            </a>
            <a href="/" className="hover:text-white transition-colors">
              Home
            </a>
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
      <dt className="text-sm font-semibold text-gray-300 mb-1">{label}</dt>
      {value && <dd className="text-sm text-gray-400 leading-relaxed">{value}</dd>}
      {values && (
        <dd className="text-sm text-gray-400 leading-relaxed">
          <ul className="list-disc list-inside space-y-1">
            {values.map((v, i) => (
              <li key={i}>{v}</li>
            ))}
          </ul>
        </dd>
      )}
      {note && (
        <dd className="text-xs text-gray-500 mt-1 italic">{note}</dd>
      )}
    </div>
  );
}
