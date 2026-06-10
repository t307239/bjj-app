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
import { FAMILY_DISCOUNT_YEN, SPORTS_INSURANCE_YEN, SPORTS_INSURANCE_KIDS_YEN } from "@/lib/robust/types";

const GYM_SLUG = "robust";

type Step = "auth" | "profile" | "plan" | "loading";

type Plan = {
  id: string;
  label: string;
  price: string;
  priceKey: string;
  setupFee: number;
  monthlyAmount: number; // 日割り・翌月分計算用（税別）
  description: string;
};

const PLANS: Plan[] = [
  {
    id: "fulltime_male",
    label: "フルタイム（男性）",
    price: "¥12,000/月",
    priceKey: "fulltime_male",
    setupFee: 10000,
    monthlyAmount: 12000,
    description: "通い放題・全クラス参加可",
  },
  {
    id: "fulltime_female",
    label: "フルタイム（女性・中高生）",
    price: "¥10,000/月",
    priceKey: "fulltime_female",
    setupFee: 5000,
    monthlyAmount: 10000,
    description: "通い放題・全クラス参加可",
  },
  {
    id: "twice_male",
    label: "月8回（男性）",
    price: "¥10,000/月",
    priceKey: "twice_male",
    setupFee: 10000,
    monthlyAmount: 10000,
    description: "月8回まで。超過は¥1,000/回",
  },
  {
    id: "twice_kids",
    label: "月8回（キッズ）",
    price: "¥7,000/月",
    priceKey: "twice_kids",
    setupFee: 0,
    monthlyAmount: 7000,
    description: "小学生対象・月8回まで",
  },
  {
    id: "drop_in",
    label: "ビジター（ドロップイン）",
    price: "¥2,000/回",
    priceKey: "drop_in",
    setupFee: 0,
    monthlyAmount: 2000,
    description: "単発参加",
  },
];

export default function RegisterPage() {
  const supabase = createRobustClient();
  const [step, setStep] = useState<Step>("loading");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  // auth ステップの表示モード: 新規登録 or 既存会員ログイン
  const [authMode, setAuthMode] = useState<"signup" | "login">("signup");
  const [resetSent, setResetSent] = useState(false);
  // プロフィール情報
  const [nameKana, setNameKana] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [sportsHistory, setSportsHistory] = useState("");
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [emergencyRelation, setEmergencyRelation] = useState("");
  const [medicalNotes, setMedicalNotes] = useState("");
  const [isMinor, setIsMinor] = useState(false);
  const [guardianName, setGuardianName] = useState("");
  const [guardianContact, setGuardianContact] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [includeInsurance, setIncludeInsurance] = useState(false);
  // 家族割引: boolean → 同居家族氏名入力に変更（オーナーが確認）
  const [familyMemberName, setFamilyMemberName] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // ログイン済みユーザーを適切な画面へ振り分ける。
  // 既存会員 → QR画面 / 未登録(幽霊アカウント) → プラン選択。未ログインなら auth ステップ。
  // Why: useEffect 初回チェックとログイン成功後の両方で同じ分岐を使うため関数化。
  async function routeLoggedInUser(): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setStep("auth"); return; }

    // Why: user_id のみだと将来 multi-tenant 化時に他ジムレコードを誤検出する
    const GYM_ID_CONST = process.env.NEXT_PUBLIC_ROBUST_GYM_ID ?? "";
    const { data: member } = await supabase
      .from("gym_members")
      .select("id")
      .eq("user_id", user.id)
      .eq("gym_id", GYM_ID_CONST)
      .maybeSingle();

    if (member) {
      window.location.href = `/gym/${GYM_SLUG}/member/qr`;
      return;
    }
    // 幽霊アカウント → プラン選択へ
    setStep("plan");
  }

  // カゴ落ちチェック: ログイン済みで gym_members 未登録なら Checkout へ
  useEffect(() => {
    routeLoggedInUser();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 既存会員ログイン
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      setStep("loading");
      await routeLoggedInUser();
    } catch {
      // Why: Supabase の生エラー文言(英語)をそのまま出さず、利用者向けの日本語に統一
      setError("メールアドレスまたはパスワードが正しくありません");
    } finally {
      setSubmitting(false);
    }
  }

  // パスワードリセットメール送信
  async function handleResetPassword() {
    setError("");
    if (!email) { setError("メールアドレスを入力してください"); return; }
    setSubmitting(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/gym/${GYM_SLUG}/reset-password`,
      });
      if (resetError) throw resetError;
      setResetSent(true);
    } catch {
      setError("リセットメールの送信に失敗しました");
    } finally {
      setSubmitting(false);
    }
  }

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
      setStep("profile"); // 認証後はプロフィール入力へ
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  function handleProfileNext(e: React.FormEvent) {
    e.preventDefault();
    setStep("plan");
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
          // setupFee は送信しない（サーバー側で planKey から確定）
          nameKana: nameKana.trim() || undefined,
          birthDate: birthDate || undefined,
          phone: phone || undefined,
          address: address || undefined,
          sportsHistory: sportsHistory || undefined,
          emergencyName: emergencyName.trim() || undefined,
          emergencyPhone: emergencyPhone.trim() || undefined,
          emergencyRelation: emergencyRelation.trim() || undefined,
          medicalNotes: medicalNotes.trim() || undefined,
          isMinor,
          guardianName: isMinor ? guardianName : undefined,
          guardianContact: isMinor ? guardianContact : undefined,
          includeInsurance,
          agreedToTerms,
          familyDiscount: !!familyMemberName.trim(),
          familyMemberName: familyMemberName.trim() || undefined,
          // monthlyAmount は送信しない（サーバー側で planKey から確定）
        }),
      });
      const json = await res.json();
      if (res.status === 503) {
        // Stripe 未設定時は連絡先を案内
        setError(json.error ?? "現在オンライン決済の準備中です。");
        return;
      }
      if (res.status === 409 && json.alreadyMember) {
        // 既存会員の二重入会防止: 入会金の二重請求を避け、状況に応じて案内/誘導
        if (json.error?.includes("退会")) {
          setError(json.error);
        } else {
          window.location.href = `/gym/${GYM_SLUG}/member/qr`;
        }
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

        {/* ステップインジケーター */}
        <div className="flex items-center justify-center gap-2 mb-6 text-xs text-zinc-500">
          <span className={step === "auth" ? "text-emerald-400 font-medium" : "text-zinc-600"}>① 基本情報</span>
          <span className="text-zinc-700">›</span>
          <span className={step === "profile" ? "text-emerald-400 font-medium" : "text-zinc-600"}>② 詳細情報</span>
          <span className="text-zinc-700">›</span>
          <span className={step === "plan" ? "text-emerald-400 font-medium" : "text-zinc-600"}>③ プラン選択</span>
        </div>

        {step === "auth" && (
          <form
            onSubmit={authMode === "signup" ? handleSignUp : handleLogin}
            className="bg-zinc-900 border border-white/10 rounded-xl p-6 space-y-4"
          >
            {/* 新規登録 / ログイン 切替 */}
            <div className="flex bg-zinc-800 rounded-lg p-1 mb-2">
              <button
                type="button"
                onClick={() => { setAuthMode("signup"); setError(""); setResetSent(false); }}
                className={`flex-1 text-sm rounded-md py-2 transition-colors ${authMode === "signup" ? "bg-emerald-600 text-white" : "text-zinc-400 hover:text-white"}`}
              >
                新規登録
              </button>
              <button
                type="button"
                onClick={() => { setAuthMode("login"); setError(""); setResetSent(false); }}
                className={`flex-1 text-sm rounded-md py-2 transition-colors ${authMode === "login" ? "bg-emerald-600 text-white" : "text-zinc-400 hover:text-white"}`}
              >
                ログイン
              </button>
            </div>

            {authMode === "login" && (
              <p className="text-zinc-500 text-xs">すでに会員の方はメールアドレスとパスワードでログインしてください。</p>
            )}

            {/* お名前は新規登録時のみ */}
            {authMode === "signup" && (
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
                  placeholder="柔術 太郎"
                />
              </div>
            )}
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
              <label htmlFor="reg-password" className="block text-xs text-zinc-400 mb-1">
                {authMode === "signup" ? "パスワード（8文字以上）" : "パスワード"}
              </label>
              <input
                id="reg-password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={authMode === "signup" ? 8 : undefined}
                autoComplete={authMode === "signup" ? "new-password" : "current-password"}
                className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
              />
            </div>
            {error && <p className="text-red-400 text-xs">{error}</p>}
            {resetSent && <p className="text-emerald-400 text-xs">パスワード再設定メールを送信しました。メールをご確認ください。</p>}
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-medium rounded-lg py-2.5 text-sm transition-colors"
            >
              {submitting ? "処理中..." : authMode === "signup" ? "アカウントを作成" : "ログイン"}
            </button>

            {/* パスワード忘れ（ログイン時のみ） */}
            {authMode === "login" && (
              <button
                type="button"
                onClick={handleResetPassword}
                disabled={submitting}
                className="w-full text-zinc-400 hover:text-white text-xs disabled:opacity-40"
              >
                パスワードをお忘れですか？
              </button>
            )}
          </form>
        )}

        {step === "profile" && (
          <form onSubmit={handleProfileNext} className="bg-zinc-900 border border-white/10 rounded-xl p-6 space-y-4">
            <p className="text-xs text-zinc-500 mb-2">入会に必要な情報をご記入ください（任意項目は後で追加可能）</p>
            <div>
              <label htmlFor="reg-kana" className="block text-xs text-zinc-400 mb-1">フリガナ <span className="text-red-400">*</span></label>
              <input
                id="reg-kana"
                type="text"
                value={nameKana}
                onChange={e => setNameKana(e.target.value)}
                required
                placeholder="ジュウジュツ タロウ"
                className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
              />
            </div>
            <div>
              <label htmlFor="reg-birth" className="block text-xs text-zinc-400 mb-1">生年月日</label>
              <input
                id="reg-birth"
                type="date"
                value={birthDate}
                onChange={e => setBirthDate(e.target.value)}
                autoComplete="bday"
                className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
              />
            </div>
            <div>
              <label htmlFor="reg-phone" className="block text-xs text-zinc-400 mb-1">電話番号</label>
              <input
                id="reg-phone"
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                autoComplete="tel"
                placeholder="090-1234-5678"
                className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
              />
            </div>
            <div>
              <label htmlFor="reg-address" className="block text-xs text-zinc-400 mb-1">住所</label>
              <input
                id="reg-address"
                type="text"
                value={address}
                onChange={e => setAddress(e.target.value)}
                autoComplete="street-address"
                placeholder="東京都板橋区..."
                className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
              />
            </div>
            <div>
              <label htmlFor="reg-sports" className="block text-xs text-zinc-400 mb-1">運動経歴・格闘技歴</label>
              <textarea
                id="reg-sports"
                value={sportsHistory}
                onChange={e => setSportsHistory(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="例: 柔道3年、ボクシング未経験など"
                className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm resize-none"
              />
            </div>
            {/* 緊急連絡先（怪我など緊急時の連絡先） */}
            <div className="space-y-3 border-t border-white/10 pt-4">
              <p className="text-xs text-zinc-400 font-medium">緊急連絡先（怪我など緊急時にご連絡します）</p>
              <div>
                <label htmlFor="reg-emg-name" className="block text-xs text-zinc-400 mb-1">氏名</label>
                <input
                  id="reg-emg-name"
                  type="text"
                  value={emergencyName}
                  onChange={e => setEmergencyName(e.target.value)}
                  placeholder="柔術 花子"
                  className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label htmlFor="reg-emg-phone" className="block text-xs text-zinc-400 mb-1">電話</label>
                  <input
                    id="reg-emg-phone"
                    type="tel"
                    value={emergencyPhone}
                    onChange={e => setEmergencyPhone(e.target.value)}
                    autoComplete="off"
                    placeholder="090-1234-5678"
                    className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                  />
                </div>
                <div className="w-28">
                  <label htmlFor="reg-emg-rel" className="block text-xs text-zinc-400 mb-1">続柄</label>
                  <input
                    id="reg-emg-rel"
                    type="text"
                    value={emergencyRelation}
                    onChange={e => setEmergencyRelation(e.target.value)}
                    placeholder="母"
                    className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                  />
                </div>
              </div>
            </div>
            {/* 既往症・アレルギー（要配慮個人情報 — 任意・安全管理目的） */}
            <div>
              <label htmlFor="reg-medical" className="block text-xs text-zinc-400 mb-1">既往症・アレルギー（任意）</label>
              <textarea
                id="reg-medical"
                value={medicalNotes}
                onChange={e => setMedicalNotes(e.target.value)}
                rows={2}
                maxLength={500}
                placeholder="例: 喘息、右膝前十字靭帯の既往、甲殻類アレルギーなど"
                className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm resize-none"
              />
              {/* Why: 既往症・アレルギーは個人情報保護法上の「要配慮個人情報」。
                      取得目的の明示と、入力＝利用同意であることを表示する（任意性も明記）。 */}
              <p className="text-zinc-500 text-[11px] mt-1 leading-relaxed">
                ※ 健康・安全管理（練習中の事故・体調急変時の適切な対応）のためにのみ使用します。入力は任意です。ご入力いただいた場合、この目的での利用に同意したものとして取り扱います。スタッフ以外には開示しません。
              </p>
            </div>
            {/* 未成年フラグ */}
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isMinor}
                onChange={e => setIsMinor(e.target.checked)}
                className="w-4 h-4 rounded"
                id="reg-minor"
              />
              <span className="text-sm text-zinc-300">18歳未満（保護者同意が必要）</span>
            </label>
            {isMinor && (
              <div className="space-y-3 pl-7">
                <div>
                  <label htmlFor="reg-guardian-name" className="block text-xs text-zinc-400 mb-1">保護者氏名 <span className="text-red-400">*</span></label>
                  <input
                    id="reg-guardian-name"
                    type="text"
                    value={guardianName}
                    onChange={e => setGuardianName(e.target.value)}
                    required
                    autoComplete="name"
                    placeholder="柔術 花子"
                    className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="reg-guardian-contact" className="block text-xs text-zinc-400 mb-1">保護者連絡先（電話またはメール）<span className="text-red-400">*</span></label>
                  <input
                    id="reg-guardian-contact"
                    type="text"
                    value={guardianContact}
                    onChange={e => setGuardianContact(e.target.value)}
                    required
                    placeholder="090-xxxx-xxxx"
                    className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                  />
                </div>
              </div>
            )}
            {/* 利用規約同意 */}
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={agreedToTerms}
                onChange={e => setAgreedToTerms(e.target.checked)}
                className="w-4 h-4 rounded mt-0.5 shrink-0"
                id="reg-terms"
              />
              <span className="text-xs text-zinc-400">
                入会規約・スポーツ保険（一般 ¥2,150 / キッズ ¥950）への同意、および
                <a href="https://robust-bjj.jp" target="_blank" rel="noopener" className="text-emerald-400 underline ml-1">ROBUST 柔術の規則</a>
                に従うことに同意します。
              </span>
            </label>
            <button
              type="submit"
              disabled={agreedToTerms === false || !nameKana.trim() || (isMinor && (!guardianName || !guardianContact))}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-medium rounded-lg py-2.5 text-sm transition-colors"
            >
              次へ（プラン選択）→
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
            {/* スポーツ保険（選択制） */}
            <label className="flex items-start gap-3 bg-zinc-800/60 rounded-xl p-3 cursor-pointer border border-white/10">
              <input
                type="checkbox"
                checked={includeInsurance}
                onChange={e => setIncludeInsurance(e.target.checked)}
                className="w-4 h-4 rounded mt-0.5 shrink-0"
                id="reg-insurance"
              />
              <div>
                <p className="text-sm text-white font-medium">
                  スポーツ保険に加入する
                  <span className="ml-2 text-emerald-400 font-bold">
                    ¥{(isMinor ? SPORTS_INSURANCE_KIDS_YEN : SPORTS_INSURANCE_YEN).toLocaleString()}
                  </span>
                  <span className="text-zinc-500 text-xs ml-1">（年度分・任意）</span>
                </p>
                <p className="text-xs text-zinc-500 mt-0.5">
                  練習中のケガに備えるスポーツ保険です。加入推奨。4月〜翌3月末の年度管理。
                </p>
              </div>
            </label>

            {/* 家族・兄弟割引 */}
            <div className="bg-zinc-800/60 rounded-xl p-3 border border-white/10 space-y-2">
              <div>
                <p className="text-sm text-white font-medium">
                  家族・兄弟割引
                  <span className="ml-2 text-emerald-400 font-bold">-¥2,000/月</span>
                </p>
                <p className="text-xs text-zinc-500 mt-0.5">同一世帯の2人目以降が対象。すでに会員の家族・兄弟の氏名を入力してください（オーナーが確認します）</p>
              </div>
              <input
                id="reg-family-name"
                type="text"
                value={familyMemberName}
                onChange={e => setFamilyMemberName(e.target.value)}
                autoComplete="off"
                placeholder="例：柔術 花子（すでに会員の方の氏名）"
                className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
              />
              {familyMemberName.trim() && (
                <p className="text-xs text-emerald-400">✓ 割引が適用されます（入会後にオーナーが確認）</p>
              )}
            </div>

            {/* 決済明細プレビュー */}
            {selectedPlan && selectedPlan.monthlyAmount > 0 && selectedPlan.priceKey !== "drop_in" && (() => {
              const today = new Date();
              const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
              const remainingDays = daysInMonth - today.getDate() + 1;
              const prorated = Math.round(selectedPlan.monthlyAmount * remainingDays / daysInMonth);
              const discountedMonthly = selectedPlan.monthlyAmount - (familyMemberName.trim() ? FAMILY_DISCOUNT_YEN : 0);
              const insuranceFee = isMinor ? SPORTS_INSURANCE_KIDS_YEN : SPORTS_INSURANCE_YEN;
              const total = selectedPlan.setupFee + prorated + discountedMonthly + (includeInsurance ? insuranceFee : 0);
              return (
                <div className="bg-zinc-800/40 rounded-xl p-3 text-xs text-zinc-400 space-y-1">
                  <p className="text-zinc-500 text-xs mb-2 font-medium">今日の決済内訳</p>
                  {selectedPlan.setupFee > 0 && (
                    <div className="flex justify-between">
                      <span>入会金（初回のみ）</span>
                      <span className="text-white">¥{selectedPlan.setupFee.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>日割り（{remainingDays}日分）</span>
                    <span className="text-white">¥{prorated.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>翌月分（前払い）</span>
                    <span className="text-white">¥{discountedMonthly.toLocaleString()}</span>
                  </div>
                  {familyMemberName.trim() && (
                    <div className="flex justify-between text-emerald-400">
                      <span>家族割引（{familyMemberName.trim()}さんと同世帯）</span><span>-¥2,000</span>
                    </div>
                  )}
                  {includeInsurance && (
                    <div className="flex justify-between">
                      <span>スポーツ保険</span>
                      <span className="text-white">¥{insuranceFee.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-white/10 pt-1 mt-1 text-white font-medium">
                    <span>合計</span><span>¥{total.toLocaleString()}</span>
                  </div>
                  <p className="text-zinc-600 text-xs mt-1">翌々月末から ¥{discountedMonthly.toLocaleString()}/月</p>
                </div>
              );
            })()}

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
