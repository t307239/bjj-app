"use client";

import { Suspense, useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/lib/i18n";
import { logClientError } from "@/lib/logger";
import Link from "next/link";

import { isInAppBrowser } from "@/lib/isInAppBrowser";

// ─── Error banner (from OAuth callback) ───────────────────────────────────────
function ErrorBanner() {
  const { t } = useLocale();
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  if (!error) return null;
  const errorMessages: Record<string, string> = {
    auth: t("login.errorAuth"),
    callback: t("login.errorCallback"),
    access_denied: t("login.errorDenied"),
    session_expired: t("login.sessionExpired"),
  };
  return (
    <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 mb-4 text-red-400 text-sm text-center">
      {errorMessages[error] ?? t("login.errorGeneric")}
    </div>
  );
}

// ─── IAB warning screen ────────────────────────────────────────────────────────
function IABWarning() {
  const { t } = useLocale();
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const copyUrl = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      timerRef.current = setTimeout(() => setCopied(false), 2000);
    }).catch((err) => console.error("clipboard copy failed:", err));
  };

  return (
    <main className="min-h-[100dvh] flex flex-col items-center justify-center px-4 bg-zinc-950">
      <div className="w-full max-w-sm text-center">
        <div className="text-5xl mb-4">🌐</div>
        <h1 className="text-xl font-bold text-white mb-2">
          {t("login.iabWarning")}
        </h1>
        <p className="text-gray-400 text-sm leading-relaxed mb-6">
          {t("login.iabDesc")}
        </p>
        <button
          onClick={copyUrl}
          className="w-full bg-[#10B981] hover:bg-[#0d9668] text-white font-semibold py-3 px-4 rounded-xl transition-colors text-sm"
        >
          {copied ? t("login.iabCopied") : t("login.iabCopy")}
        </button>
        <p className="text-gray-500 text-xs mt-4">
          {t("login.iabPaste")}
        </p>
      </div>
    </main>
  );
}

// ─── Main login form ───────────────────────────────────────────────────────────
function LoginForm() {
  const { t } = useLocale();
  const supabase = createClient();
  const searchParamsInner = useSearchParams();
  const nextPath = searchParamsInner.get("next") ?? "";
  // Wiki referral attribution: ?ref=wiki&page=closed-guard
  const refParam = searchParamsInner.get("ref") ?? "";
  const pageParam = searchParamsInner.get("page") ?? "";
  const [email, setEmail] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  // Rate limit guard: prevent brute-force OTP requests (60s cooldown)
  const lastOtpSentRef = useRef<number>(0);
  const OTP_COOLDOWN_MS = 60_000;

  // COPPA: user must confirm age 13+
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  // Training Disclaimer: user must accept physical risk
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);

  // Both must be checked before any login action is enabled
  const canProceed = ageConfirmed && disclaimerAccepted;

  // Highlight checkboxes when user tries to proceed without checking them
  const [nudge, setNudge] = useState(false);
  const checkboxRef = useRef<HTMLDivElement>(null);
  const nudgeTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    return () => {
      if (nudgeTimerRef.current) clearTimeout(nudgeTimerRef.current);
    };
  }, []);

  function nudgeCheckboxes() {
    setNudge(true);
    checkboxRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    nudgeTimerRef.current = setTimeout(() => setNudge(false), 1500);
  }

  const callbackUrl = () => {
    const base = `${window.location.origin}/auth/callback`;
    const params = new URLSearchParams();
    if (nextPath) params.set("next", nextPath);
    if (refParam) params.set("ref", refParam);
    if (pageParam) params.set("page", pageParam);
    const qs = params.toString();
    return qs ? `${base}?${qs}` : base;
  };

  const signInWithGoogle = async () => {
    if (!canProceed) { nudgeCheckboxes(); return; }
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callbackUrl() },
    });
  };

  const signInWithGitHub = async () => {
    if (!canProceed) { nudgeCheckboxes(); return; }
    await supabase.auth.signInWithOAuth({
      provider: "github",
      options: { redirectTo: callbackUrl() },
    });
  };

  const sendEmailLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canProceed) { nudgeCheckboxes(); return; }
    setEmailError(null);
    if (!email || !email.includes("@")) {
      setEmailError(t("login.errorInvalidEmail"));
      return;
    }
    // App-level rate limit: prevent rapid OTP brute-force
    const now = Date.now();
    if (now - lastOtpSentRef.current < OTP_COOLDOWN_MS) {
      setEmailError(t("login.errorRateLimit"));
      return;
    }
    setEmailLoading(true);
    lastOtpSentRef.current = now;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: callbackUrl() },
    });
    if (error) {
      logClientError("login.otp_error", error, { status: error.status });
      setEmailError(t("login.errorSendFailed"));
    } else {
      setEmailSent(true);
    }
    setEmailLoading(false);
  };

  return (
    <main className="min-h-[100dvh] flex flex-col items-center justify-center px-4 bg-zinc-950">
      <div className="w-full max-w-sm">

        {/* Header */}
        <div className="text-center mb-6">
          <div className="text-5xl mb-3">🥋</div>
          <h1 className="text-2xl font-bold text-white">{t("login.getStarted")}</h1>
          <p className="text-gray-400 mt-2 text-sm">
            {t("login.subtitle")}
          </p>
        </div>

        {/* Social proof */}
        <div className="flex justify-center gap-6 mb-6">
          <div className="text-center">
            <p className="text-lg font-bold text-white">{t("login.free")}</p>
            <p className="text-xs text-gray-500">{t("login.freeDesc")}</p>
          </div>
          <div className="w-px bg-white/10" />
          <div className="text-center">
            <p className="text-lg font-bold text-white">🔥 {t("login.streaks")}</p>
            <p className="text-xs text-gray-500">{t("login.streaksDesc")}</p>
          </div>
          <div className="w-px bg-white/10" />
          <div className="text-center">
            <p className="text-lg font-bold text-white">{t("login.noPassword")}</p>
            <p className="text-xs text-gray-500">{t("login.noPasswordDesc")}</p>
          </div>
        </div>

        <Suspense fallback={null}>
          <ErrorBanner />
        </Suspense>

        {/* ── COPPA + Training Disclaimer checkboxes ──────────────────────── */}
        {/* Required BEFORE any login action. COPPA: 13+ age gate (US federal law).
            Disclaimer: injury liability (protects against personal-injury claims). */}
        <div
          ref={checkboxRef}
          className={`bg-zinc-900/80 rounded-xl px-4 py-3 mb-3 space-y-2.5 border transition-colors duration-300 ${
            nudge ? "border-[#10B981] ring-1 ring-[#10B981]/40" : "border-white/10"
          }`}
        >
          {/* Age confirmation (COPPA + parental consent) */}
          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={ageConfirmed}
              onChange={(e) => setAgeConfirmed(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-white/20 bg-zinc-800 accent-[#10B981] flex-shrink-0 cursor-pointer"
              aria-label={t("login.ariaAgeConfirm")}
            />
            <span className="text-xs text-gray-400 group-hover:text-gray-300 leading-relaxed">
              {t("login.ageConfirmPre")} <span className="text-white font-medium">{t("login.ageConfirm")}</span>
              <span className="text-gray-400"> {t("login.ageConfirmNote")}</span>
              <br />
              <span className="text-gray-500">{t("login.parentalConsent")}</span>
            </span>
          </label>

          {/* Training Disclaimer */}
          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={disclaimerAccepted}
              onChange={(e) => setDisclaimerAccepted(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-white/20 bg-zinc-800 accent-[#10B981] flex-shrink-0 cursor-pointer"
              aria-label={t("login.ariaDisclaimerConfirm")}
            />
            <span className="text-xs text-gray-400 group-hover:text-gray-300 leading-relaxed">
              {t("login.disclaimerPre")} <span className="text-white font-medium">{t("login.disclaimerRisk")}</span>{" "}
              {t("login.disclaimerPost")}
            </span>
          </label>
        </div>

        {/* ── Login buttons ─────────────────────────────────────────────────── */}
        <div className={`bg-zinc-900 rounded-2xl p-6 border border-white/10 space-y-3 transition-opacity ${!canProceed ? "opacity-50" : ""}`}>

          {/* Google — most common, top position */}
          <button
            onClick={signInWithGoogle}
            disabled={!canProceed}
            aria-label={t("login.ariaSignInGoogle")}
            className="w-full flex items-center justify-center gap-3 bg-white text-gray-900 font-semibold py-3 px-4 rounded-xl hover:bg-gray-100 transition-colors disabled:cursor-not-allowed"
          >
            <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            <span>{t("login.google")}</span>
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 py-1">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-gray-400 text-xs">{t("login.orEmail")}</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          {/* Email sent confirmation */}
          {emailSent ? (
            <div className="bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-5 text-center">
              <div className="text-3xl mb-2">📬</div>
              <p className="text-green-400 text-sm font-semibold">{t("login.emailSent")}</p>
              <p className="text-gray-400 text-xs mt-2 leading-relaxed">
                {t("login.emailSentTo")}<br />
                <span className="text-white">{email}</span>.<br />
                {t("login.emailSentTap")}
              </p>
              <p className="text-gray-400 text-xs mt-3">
                {t("login.emailSentSpam")}
              </p>
              <button
                onClick={() => { setEmailSent(false); setEmail(""); }}
                className="text-gray-500 text-xs mt-4 hover:text-gray-300 transition-colors underline"
              >
                {t("login.emailSentRetry")}
              </button>
            </div>
          ) : (
            <form onSubmit={sendEmailLink} className="space-y-2">
              {emailError && (
                <p className="text-red-400 text-xs px-1">{emailError}</p>
              )}
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("login.emailPlaceholder")}
                autoComplete="email"
                aria-label={t("login.ariaEmailAddress")}
                className="w-full bg-zinc-800 text-white rounded-xl px-4 py-3 text-sm border border-white/10 focus:outline-none focus:border-white/30 placeholder-gray-500"
              />
              <button
                type="submit"
                disabled={emailLoading || !canProceed}
                aria-label={t("login.ariaSendMagicLink")}
                className="w-full bg-[#10B981] hover:bg-[#0d9668] text-white font-semibold py-3 px-4 rounded-xl transition-colors disabled:opacity-50 text-sm"
              >
                {emailLoading ? t("login.sending") : t("login.sendLink")}
              </button>
              <p className="text-xs text-gray-400 text-center pt-0.5">
                {t("login.noPasswordNote")}
              </p>
            </form>
          )}

          {/* GitHub — developer option, bottom small */}
          <div className="pt-1 border-t border-white/5">
            <button
              onClick={signInWithGitHub}
              disabled={!canProceed}
              aria-label={t("login.ariaSignInGitHub")}
              className="w-full flex items-center justify-center gap-2 text-gray-500 hover:text-gray-300 py-2 px-4 rounded-xl hover:bg-white/10 transition-colors text-xs disabled:cursor-not-allowed"
            >
              <svg className="w-4 h-4 fill-current flex-shrink-0" viewBox="0 0 24 24">
                <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
              </svg>
              {t("login.github")}
            </button>
          </div>
        </div>

        {/* Hint when checkboxes not yet checked */}
        {!canProceed && (
          <p className="text-center text-gray-500 text-xs mt-2">
            {t("login.checkboxesRequired")}
          </p>
        )}

        {/* Guest mode link */}
        <div className="text-center mt-5">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-gray-500 hover:text-gray-300 text-sm transition-colors"
          >
            <span>👀</span>
            <span>{t("login.guestMode")}</span>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Link>
          <p className="text-gray-500 text-xs mt-1">{t("login.guestDesc")}</p>
        </div>

        <p className="text-center text-gray-500 text-xs mt-4">
          {t("login.termsAgree")}{" "}
          <Link href="/terms" className="hover:text-gray-400 underline">{t("login.termsLink")}</Link>
          {" & "}
          <Link href="/privacy" className="hover:text-gray-400 underline">{t("login.privacyLink")}</Link>
        </p>
      </div>
    </main>
  );
}

// ─── Root export: IAB check first ─────────────────────────────────────────────
export default function LoginClient() {
  const [isIAB, setIsIAB] = useState(false);

  // Detect IAB on client side only (SSR safe)
  useEffect(() => {
    setIsIAB(isInAppBrowser());
  }, []);

  if (isIAB) return <IABWarning />;
  return <LoginForm />;
}
