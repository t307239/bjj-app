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
// 日本の郵便番号は 7 桁（ハイフンなし）。マジックナンバー回避のため定数化。
const POSTAL_CODE_DIGITS = 7;

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
    description: "月8回まで。超過は¥2,200/回",
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
  // ログイン済み・会員未登録(ゴースト)の再開フラグ。①基本情報を起点にしつつ②へ進む導線を出す。
  const [resumeGhost, setResumeGhost] = useState(false);
  // プロフィール情報
  const [nameKana, setNameKana] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [postalLoading, setPostalLoading] = useState(false);
  const [postalError, setPostalError] = useState("");
  const [sportsHistory, setSportsHistory] = useState("");
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [emergencyRelation, setEmergencyRelation] = useState("");
  // medicalNotes は健康情報を持病/アレルギー/怪我歴に分割（Section 14）した名残。
  // 現UIでは入力欄がなく常に空だが、後方互換のため送信キーは維持する（setterは不要）。
  const [medicalNotes] = useState("");
  const [chronicConditions, setChronicConditions] = useState("");
  const [allergies, setAllergies] = useState("");
  const [injuryHistory, setInjuryHistory] = useState("");
  const [bloodType, setBloodType] = useState<"" | "A" | "B" | "O" | "AB">("");
  const [isMinor, setIsMinor] = useState(false);
  const [guardianName, setGuardianName] = useState("");
  const [guardianContact, setGuardianContact] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [includeInsurance, setIncludeInsurance] = useState(false);
  // 家族割引: boolean → 同居家族氏名入力に変更（オーナーが確認）
  const [familyMemberName, setFamilyMemberName] = useState("");
  const [simultaneousFamily, setSimultaneousFamily] = useState(false);
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
    // 幽霊アカウント(カゴ落ち) → 登録は①基本情報を起点に見せる（ユーザー要望）。
    // Why: 会員未登録のまま②③へ直行すると流れが分かりにくい。①を起点にしつつ、ログイン済みなので
    //      「登録を続ける」導線で②詳細情報へ進める。②で必須情報(フリガナ/生年月日/連絡先/緊急連絡先)を
    //      入力させてから③へ進むので、③直行で必須未入力→400 になる経路も避けられる。
    setResumeGhost(true);
    setStep("auth");
  }

  // カゴ落ちチェック: ログイン済みで gym_members 未登録なら Checkout へ
  useEffect(() => {
    routeLoggedInUser();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 郵便番号 → 住所自動入力（zipcloud 無料 API・APIキー不要）
  // Why: 会員が住所を手入力する負担を減らし、都道府県抜けなどの表記ゆれを防ぐ。
  //      7桁揃った時点で自動検索し、都道府県〜町名を補完（番地は会員が続けて手入力）。
  async function lookupAddress(rawZip: string): Promise<void> {
    const zip = rawZip.replace(/[^0-9]/g, "");
    if (zip.length !== POSTAL_CODE_DIGITS) return;
    setPostalLoading(true);
    setPostalError("");
    try {
      const res = await fetch(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${zip}`);
      if (!res.ok) throw new Error(`zipcloud status ${res.status}`);
      const json: { results: { address1: string; address2: string; address3: string }[] | null } = await res.json();
      const hit = json.results?.[0];
      if (!hit) {
        setPostalError("該当する住所が見つかりませんでした。手入力してください");
        return;
      }
      // 都道府県+市区町村+町名を前方補完。番地・建物名は会員が続けて入力する。
      setAddress(`${hit.address1}${hit.address2}${hit.address3}`);
    } catch {
      // ネットワーク断・API 障害時は手入力にフォールバック（UI で明示）
      setPostalError("住所の取得に失敗しました。手入力してください");
    } finally {
      setPostalLoading(false);
    }
  }

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

  // 新規登録①: アカウントは作らず②詳細情報へ進むだけ。
  // Why: アカウント作成は最後(③決済時, handleCheckout)にまとめて行う。こうすると②③から①へ戻って
  //      メール/パスワードを修正でき、登録途中放置による幽霊アカウント(認証あり・会員なし)も生まれにくい。
  //      入力チェックは form の required / minLength(8) で担保済み。
  function handleBasicNext(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setStep("profile");
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
      // 新規フローはこの時点(決済直前)でアカウントを作成する。
      // Why: ①でアカウントを作らず最後にまとめることで、②③から①へ戻ってメール/パスワード変更が可能になり、
      //      途中放置の幽霊アカウントも生まれにくい。既にログイン済み(ログイン/再開)なら作成はスキップ。
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { name } },
        });
        if (signUpError) {
          setError(
            /already|registered|exists/i.test(signUpError.message)
              ? "このメールアドレスは既に登録済みです。「ログイン」からお進みください。"
              : signUpError.message
          );
          setSubmitting(false);
          return;
        }
      }
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
          chronicConditions: chronicConditions.trim() || undefined,
          allergies: allergies.trim() || undefined,
          injuryHistory: injuryHistory.trim() || undefined,
          bloodType: bloodType || undefined,
          isMinor,
          guardianName: isMinor ? guardianName : undefined,
          guardianContact: isMinor ? guardianContact : undefined,
          includeInsurance,
          agreedToTerms,
          familyDiscount: !!familyMemberName.trim(),
          familyMemberName: familyMemberName.trim() || undefined,
          simultaneousFamily,
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
            onSubmit={authMode === "signup" ? handleBasicNext : handleLogin}
            className="bg-zinc-900 border border-white/10 rounded-xl p-6 space-y-4"
          >
            {/* ゴースト(ログイン済み・会員未登録)向け: ①を起点に見せつつ②へ進む導線 */}
            {resumeGhost && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-center space-y-2">
                <p className="text-amber-200/90 text-xs">ログイン済みですが会員登録がまだ完了していません。</p>
                <button
                  type="button"
                  onClick={() => { setError(""); setStep("profile"); }}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-sm rounded-lg py-2 transition-colors"
                >
                  登録を続ける（詳細情報へ）→
                </button>
              </div>
            )}
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
              {submitting ? "処理中..." : authMode === "signup" ? "次へ（詳細情報）→" : "ログイン"}
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
            <p className="text-xs text-zinc-500 mb-2"><span className="text-red-400">*</span> は必須項目です。健康情報・血液型・運動経歴は任意です。</p>
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
              <label htmlFor="reg-birth" className="block text-xs text-zinc-400 mb-1">生年月日 <span className="text-red-400">*</span></label>
              <input
                id="reg-birth"
                type="date"
                value={birthDate}
                onChange={e => setBirthDate(e.target.value)}
                autoComplete="bday"
                required
                className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
              />
            </div>
            <div>
              <label htmlFor="reg-phone" className="block text-xs text-zinc-400 mb-1">電話番号 <span className="text-red-400">*</span></label>
              <input
                id="reg-phone"
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                autoComplete="tel"
                required
                placeholder="090-1234-5678"
                className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
              />
            </div>
            <div>
              <label htmlFor="reg-postal" className="block text-xs text-zinc-400 mb-1">郵便番号（住所自動入力）</label>
              <div className="flex items-center gap-2 whitespace-nowrap">
                <input
                  id="reg-postal"
                  type="text"
                  inputMode="numeric"
                  value={postalCode}
                  onChange={e => {
                    const v = e.target.value;
                    setPostalCode(v);
                    setPostalError("");
                    // 7 桁揃った瞬間に自動検索（ボタンを押さなくても補完される）
                    if (v.replace(/[^0-9]/g, "").length === POSTAL_CODE_DIGITS) void lookupAddress(v);
                  }}
                  autoComplete="postal-code"
                  placeholder="1500001"
                  maxLength={8}
                  className="flex-1 bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                />
                <button
                  type="button"
                  onClick={() => void lookupAddress(postalCode)}
                  disabled={postalLoading}
                  className="shrink-0 min-h-[44px] px-4 rounded-lg bg-white/10 text-white text-sm disabled:opacity-50"
                >
                  {postalLoading ? "検索中…" : "住所検索"}
                </button>
              </div>
              {postalError && <p className="text-xs text-red-400 mt-1">{postalError}</p>}
              <p className="text-[11px] text-zinc-500 mt-1">ハイフンなし7桁で都道府県〜町名を自動入力します</p>
            </div>
            <div>
              <label htmlFor="reg-address" className="block text-xs text-zinc-400 mb-1">住所 <span className="text-red-400">*</span></label>
              <input
                id="reg-address"
                type="text"
                value={address}
                onChange={e => setAddress(e.target.value)}
                autoComplete="street-address"
                required
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
              <p className="text-xs text-zinc-400 font-medium">緊急連絡先 <span className="text-red-400">*</span>（怪我など緊急時にご連絡します）</p>
              <div>
                <label htmlFor="reg-emg-name" className="block text-xs text-zinc-400 mb-1">氏名 <span className="text-red-400">*</span></label>
                <input
                  id="reg-emg-name"
                  type="text"
                  value={emergencyName}
                  onChange={e => setEmergencyName(e.target.value)}
                  required
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
                    required
                    placeholder="090-1234-5678"
                    className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                  />
                </div>
                <div className="w-28">
                  <label htmlFor="reg-emg-rel" className="block text-xs text-zinc-400 mb-1">続柄 <span className="text-red-400">*</span></label>
                  <input
                    id="reg-emg-rel"
                    type="text"
                    value={emergencyRelation}
                    onChange={e => setEmergencyRelation(e.target.value)}
                    required
                    placeholder="母"
                    className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                  />
                </div>
              </div>
            </div>
            {/* 血液型（任意・緊急時の安全管理目的） */}
            <div>
              <label htmlFor="reg-blood" className="block text-xs text-zinc-400 mb-1">血液型（任意）</label>
              <select
                id="reg-blood"
                value={bloodType}
                onChange={e => setBloodType(e.target.value as typeof bloodType)}
                className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
              >
                <option value="">未選択</option>
                <option value="A">A型</option>
                <option value="B">B型</option>
                <option value="O">O型</option>
                <option value="AB">AB型</option>
              </select>
            </div>
            {/* 健康情報（要配慮個人情報 — 任意・安全管理目的）: 持病/アレルギー/怪我歴に分割（依頼書 Section 14） */}
            <div className="space-y-3">
              <p className="text-xs text-zinc-400 font-medium">健康情報（任意）</p>
              <div>
                <label htmlFor="reg-chronic" className="block text-xs text-zinc-400 mb-1">持病</label>
                <input
                  id="reg-chronic"
                  type="text"
                  value={chronicConditions}
                  onChange={e => setChronicConditions(e.target.value)}
                  maxLength={200}
                  placeholder="例: 喘息、高血圧 など"
                  className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                />
              </div>
              <div>
                <label htmlFor="reg-allergy" className="block text-xs text-zinc-400 mb-1">アレルギー</label>
                <input
                  id="reg-allergy"
                  type="text"
                  value={allergies}
                  onChange={e => setAllergies(e.target.value)}
                  maxLength={200}
                  placeholder="例: 甲殻類、そば、ハウスダスト など"
                  className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                />
              </div>
              <div>
                <label htmlFor="reg-injury" className="block text-xs text-zinc-400 mb-1">怪我歴</label>
                <input
                  id="reg-injury"
                  type="text"
                  value={injuryHistory}
                  onChange={e => setInjuryHistory(e.target.value)}
                  maxLength={200}
                  placeholder="例: 右膝前十字靭帯の既往、左肩脱臼 など"
                  className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                />
              </div>
              {/* Why: 健康情報は個人情報保護法上の「要配慮個人情報」。取得目的の明示と、入力＝利用同意であることを表示する（任意性も明記）。 */}
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
            {/* 戻る: 基本情報(①)へ。入力値は state 保持のため戻っても消えない */}
            <button
              type="button"
              onClick={() => { setError(""); setStep("auth"); }}
              className="text-xs text-zinc-400 hover:text-white inline-flex items-center gap-1 min-h-[44px]"
            >
              ← 基本情報に戻る
            </button>
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
            <h2 className="text-sm font-bold text-white mb-1">プランを選択してください</h2>
            <p className="text-xs text-zinc-500 mb-2">※ 表示価格はすべて税別です。</p>
            {/* 戻る: 詳細情報を修正できるように②へ戻す（入力値は state 保持のため消えない） */}
            <button
              type="button"
              onClick={() => { setError(""); setStep("profile"); }}
              className="text-xs text-zinc-400 hover:text-white mb-4 inline-flex items-center gap-1 min-h-[44px]"
            >
              ← 詳細情報に戻る
            </button>
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
                <p className="text-xs text-zinc-500 mt-0.5">同一世帯の2人目以降が対象。家族・兄弟の氏名を入力してください（入会後にオーナーが確認します）</p>
              </div>
              <input
                id="reg-family-name"
                type="text"
                value={familyMemberName}
                onChange={e => setFamilyMemberName(e.target.value)}
                autoComplete="off"
                placeholder="例：柔術 花子（家族・兄弟の方の氏名）"
                className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
              />
              {/* 同時入会トグル: 相手も今回入会＝DB未登録のため、自己申告で初月から割引を適用 */}
              {familyMemberName.trim() && (
                <label className="flex items-start gap-2 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={simultaneousFamily}
                    onChange={e => setSimultaneousFamily(e.target.checked)}
                    className="w-4 h-4 rounded mt-0.5 shrink-0"
                    id="reg-simultaneous-family"
                  />
                  <span className="text-xs text-zinc-300">
                    👨‍👩‍👦 家族・兄弟と同時入会します（相手の方も今回が初めての入会）
                    <span className="block text-zinc-500 mt-0.5">
                      チェックすると初月から割引を適用します。すでに会員のご家族を指定する場合はチェック不要です（自動で照合します）。後日スタッフが確認します。
                    </span>
                  </span>
                </label>
              )}
              {familyMemberName.trim() && (
                <p className="text-xs text-emerald-400">
                  ✓ 割引が適用されます（{simultaneousFamily ? "同時入会・初月から" : "入会後にオーナーが確認"}）
                </p>
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
