"use client";

/**
 * ROBUST 会員自己登録ページ
 *
 * フロー:
 * 1. メール入力 → Supabase Auth signUp（メール認証）
 * 2. ログイン済みなら gym_members 存在確認
 *    → 未登録（カゴ落ち）の場合は Stripe Checkout へ自動リダイレクト
 * 3. プラン選択 → POST /api/gym/register → Stripe Checkout URL へ遷移
 */

import { useState, useEffect } from "react";
import { createRobustClient } from "@/lib/robust/supabase";

const GYM_SLUG = "robust";

type Step = "auth" | "plan" | "loading";

type Plan = {
  id: string;
  label: string;
  price: string;
  priceKey: string;
  setupFee: number;
  description: string;
};

const PLANS: Plan[] = [
  {
    id: "fulltime_male",
    label: "フルタイム（男性）",
    price: "¥12,000/月",
    priceKey: "fulltime_male",
    setupFee: 10000,
    description: "通い放題・全クラス参加可",
  },
  {
    id: "fulltime_female",
    label: "フルタイム（女性・中高生）",
    price: "¥10,000/月",
    priceKey: "fulltime_female",
    setupFee: 5000,
    description: "通い放題・全クラス参加可",
  },
  {
    id: "twice_male",
    label: "週2回（男性）",
    price: "¥10,000/月",
    priceKey: "twice_male",
    setupFee: 10000,
    description: "月8回まで。超過は¥1,000/回",
  },
  {
    id: "twice_kids",
    label: "週2回（キッズ）",
    price: "¥7,000/月",
    priceKey: "twice_kids",
    setupFee: 0,
    description: "小学生対象・月8回まで",
  },
  {
    id: "drop_in",
    label: "ビジター（ドロップイン）",
    price: "¥2,000/回",
    priceKey: "drop_in",
    setupFee: 0,
    description: "単発参加",
  },
];

export default function RegisterPage() {
  const supabase = createRobustClient();
  const [step, setStep] = useState<Step>("loading");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // カゴ落ちチェック: ログイン済みで gym_members 未登録なら Checkout へ
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setStep("auth"); return; }

      const { data: member } = await supabase
        .from("gym_members")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (member) {
        window.location.href = `/gym/${GYM_SLUG}/member/qr`;
        return;
      }
      // 幽霊アカウント → プラン選択へ
      setStep("plan");
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name } },
      });
      if (signUpError) throw signUpError;
      setStep("plan");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCheckout() {
    if (!selectedPlan) return;
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/gym/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gymSlug: GYM_SLUG,
          planKey: selectedPlan.priceKey,
          setupFee: selectedPlan.setupFee,
        }),
      });
      const json = await res.json();
      if (res.status === 503) {
        // Stripe 未設定時は連絡先を案内
        setError(json.error ?? "現在オンライン決済の準備中です。");
        return;
      }
      if (!res.ok) throw new Error(json.error ?? "登録処理に失敗しました");
      window.location.href = json.url;
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (step === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <div className="w-6 h-6 border-2 border-white/10 border-t-white/60 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-white mb-1">ROBUST 柔術</h1>
          <p className="text-zinc-400 text-sm">会員登録</p>
        </div>

        {step === "auth" && (
          <form onSubmit={handleSignUp} className="bg-zinc-900 border border-white/10 rounded-xl p-6 space-y-4">
            <div>
              <label htmlFor="reg-name" className="block text-xs text-zinc-400 mb-1">お名前</label>
              <input
                id="reg-name"
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                autoComplete="name"
                className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                placeholder="高玉 年克"
              />
            </div>
            <div>
              <label htmlFor="reg-email" className="block text-xs text-zinc-400 mb-1">メールアドレス</label>
              <input
                id="reg-email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label htmlFor="reg-password" className="block text-xs text-zinc-400 mb-1">パスワード（8文字以上）</label>
              <input
                id="reg-password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
              />
            </div>
            {error && <p className="text-red-400 text-xs">{error}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-medium rounded-lg py-2.5 text-sm transition-colors"
            >
              {submitting ? "処理中..." : "アカウントを作成"}
            </button>
          </form>
        )}

        {step === "plan" && (
          <div className="bg-zinc-900 border border-white/10 rounded-xl p-6">
            <h2 className="text-sm font-bold text-white mb-4">プランを選択してください</h2>
            <div className="space-y-2 mb-6">
              {PLANS.map(plan => (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => setSelectedPlan(plan)}
                  className={`w-full text-left rounded-lg border p-3 transition-colors ${
                    selectedPlan?.id === plan.id
                      ? "border-emerald-500 bg-emerald-500/10"
                      : "border-white/10 hover:border-white/20"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-white">{plan.label}</span>
                    <span className="text-sm font-bold text-emerald-400">{plan.price}</span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-0.5">{plan.description}</p>
                  {plan.setupFee > 0 && (
                    <p className="text-xs text-zinc-600 mt-0.5">
                      入会金 ¥{plan.setupFee.toLocaleString()}（初回のみ）
                    </p>
                  )}
                </button>
              ))}
            </div>
            {error && <p className="text-red-400 text-xs mb-3">{error}</p>}
            <button
              type="button"
              onClick={handleCheckout}
              disabled={!selectedPlan || submitting}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-medium rounded-lg py-2.5 text-sm transition-colors"
            >
              {submitting ? "Stripe へ移動中..." : "決済へ進む →"}
            </button>
            <p className="text-xs text-zinc-600 mt-3 text-center">
              Stripe の安全な決済ページへ移動します
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
