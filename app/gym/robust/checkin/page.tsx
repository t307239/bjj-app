"use client";

/**
 * タブレット用チェックイン画面
 *
 * - 常時カメラ起動（jsQR でリアルタイム QR スキャン）
 * - USB 2D バーコードリーダー対応（hidden input でキーボード入力を受け取る）
 * - スキャン成功: 「ピッ」音 + 会員名表示 3 秒
 * - 二重スキャン: 黄色フィードバック
 * - 超過課金: 赤フィードバック（課金発生を表示）
 */

import { useState, useEffect, useRef, useCallback } from "react";

// Why: 空文字 GYM_ID で .eq("gym_id","") を呼ぶと全会員が「別ジム」判定になる。
//      未設定は明示的にエラーとして扱う。
const GYM_ID = process.env.NEXT_PUBLIC_ROBUST_GYM_ID ?? "";
const FEEDBACK_DURATION_MS = 3000;

// Why: processToken のたびに new AudioContext() を生成すると
//      ブラウザの同時 AudioContext 上限（~6）に達して音が止まる＋メモリリーク。
//      モジュールスコープで1個のみ生成して使い回す。
let _audioCtx: AudioContext | null = null;
function getAudioContext(): AudioContext {
  if (!_audioCtx || _audioCtx.state === "closed") {
    _audioCtx = new AudioContext();
  }
  return _audioCtx;
}

type FeedbackState = {
  type: "success" | "warning" | "error" | "overcharge";
  name: string;
  message: string;
} | null;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// 物理キー(e.code)を hex 文字へ変換する。
// Why: 受付PCが「かな/全角」入力のままだと e.key は "５"/"え" 等に化けるが、
//      e.code は IME と無関係に物理キー位置を返す。QRトークンは hex+ハイフンのみ
//      なので、物理キーから組み立てれば入力モードを切り替えなくても正しく読める。
//      JIS/US どちらの配列でも英数字とハイフンの物理位置は同じため安全。
function codeToTokenChar(code: string): string | null {
  if (/^Digit[0-9]$/.test(code)) return code.slice(5);
  if (/^Numpad[0-9]$/.test(code)) return code.slice(6);
  if (/^Key[A-F]$/.test(code)) return code.slice(3).toLowerCase();
  if (code === "Minus" || code === "NumpadSubtract") return "-";
  return null;
}

// 全角・ひらがな経由で化けた文字列を UUID トークンに正規化する（カメラ/フォールバック用）。
// 32桁の hex に復元できた場合のみ UUID 形式へ再構成し、それ以外は元の文字列を返す
// （誤ったトークンを送らないため）。
const KANA_VOWEL_TO_ASCII: Record<string, string> = {
  "あ": "a", "い": "i", "う": "u", "え": "e", "お": "o",
  "ア": "a", "イ": "i", "ウ": "u", "エ": "e", "オ": "o",
};
function normalizeScannedToken(raw: string): string {
  const trimmed = raw.trim();
  if (UUID_RE.test(trimmed.toLowerCase())) return trimmed.toLowerCase();
  // 全角英数 → 半角
  let s = trimmed.replace(/[Ａ-Ｚａ-ｚ０-９]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0));
  s = s.replace(/[ぁ-んァ-ン]/g, ch => KANA_VOWEL_TO_ASCII[ch] ?? "").toLowerCase();
  const hex = s.replace(/[^0-9a-f]/g, "");
  if (hex.length === 32) {
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  return trimmed;
}

export default function CheckinPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [scanning, setScanning] = useState(false);
  const lastScannedRef = useRef<string>("");
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const processToken = useCallback(async (token: string) => {
    // 同一トークンの連続スキャン防止（UI レベル）
    if (token === lastScannedRef.current) return;
    lastScannedRef.current = token;

    // 確認音（共有 AudioContext を使い回す）
    try {
      const audio = getAudioContext();
      if (audio.state === "suspended") await audio.resume();
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.connect(gain);
      gain.connect(audio.destination);
      osc.frequency.value = 880;
      gain.gain.value = 0.3;
      osc.start();
      osc.stop(audio.currentTime + 0.12);
    } catch {
      /* silent: ok — 音声再生失敗はチェックイン処理に影響しない */
    }

    try {
      if (!GYM_ID) {
        setFeedback({ type: "error", name: "", message: "ジム設定が未完了です。管理者にお問い合わせください。" });
        return;
      }
      const res = await fetch("/api/gym/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qrToken: token, gymId: GYM_ID }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setFeedback({ type: "error", name: "", message: data.error ?? "エラーが発生しました" });
      } else if (data.duplicate) {
        setFeedback({ type: "warning", name: data.member_name, message: data.message });
      } else if (data.overcharged) {
        setFeedback({ type: "overcharge", name: data.member_name, message: data.message });
      } else {
        setFeedback({ type: "success", name: data.member_name, message: data.message });
      }
    } catch {
      setFeedback({ type: "error", name: "", message: "通信エラーが発生しました" });
      // Why: 通信エラー時も lastScannedRef をリセットしないと
      //      同一 QR の再スキャンが永久にブロックされる
      lastScannedRef.current = "";
    }

    // フィードバック後にリセット
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    feedbackTimerRef.current = setTimeout(() => {
      setFeedback(null);
      lastScannedRef.current = "";
    }, FEEDBACK_DURATION_MS);
  }, []);

  // カメラ起動 + jsQR によるスキャン
  useEffect(() => {
    let animationId: number;
    let stream: MediaStream;

    async function startCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: 640, height: 480 },
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setScanning(true);
          tick();
        }
      } catch {
        // カメラ未対応 or 権限拒否 → USB リーダー専用モードに切り替え
        setScanning(false);
      }
    }

    async function tick() {
      if (!videoRef.current || !canvasRef.current) { animationId = requestAnimationFrame(tick); return; }
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video.readyState !== video.HAVE_ENOUGH_DATA) { animationId = requestAnimationFrame(tick); return; }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) { animationId = requestAnimationFrame(tick); return; }
      ctx.drawImage(video, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      // jsQR は動的 import（初回のみロード）
      const { default: jsQR } = await import("jsqr");
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      if (code?.data) {
        await processToken(normalizeScannedToken(code.data));
      }

      animationId = requestAnimationFrame(tick);
    }

    startCamera();

    return () => {
      cancelAnimationFrame(animationId);
      stream?.getTracks().forEach(t => t.stop());
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    };
  }, [processToken]);

  // USB バーコードリーダー対応（Enter で確定）
  // Why: e.code(物理キー)優先で組み立てることで、受付PCが日本語入力モードのままでも
  //      自動的に正しい hex トークンになる（入力モード切替が不要）。
  const barcodeBuffer = useRef("");
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.code === "Enter" || e.code === "NumpadEnter" || e.key === "Enter") {
        const token = normalizeScannedToken(barcodeBuffer.current);
        barcodeBuffer.current = "";
        if (!token) return;
        if (UUID_RE.test(token)) {
          processToken(token);
        } else {
          // 物理キーでも復元できない（特殊配列/スキャナ設定）→ 利用者に分かる案内
          setFeedback({
            type: "error",
            name: "",
            message: "読み取りに失敗しました。入力モードを半角英数（英数キー）にしてもう一度スキャンしてください。",
          });
        }
        return;
      }
      const ch = codeToTokenChar(e.code);
      if (ch !== null) {
        barcodeBuffer.current += ch;
      } else if (!e.isComposing && e.key.length === 1) {
        // 物理キーで判定できない端末向けフォールバック（後段の normalize で補正）
        barcodeBuffer.current += e.key;
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [processToken]);

  const bgColor = feedback === null ? "bg-zinc-950"
    : feedback.type === "success"    ? "bg-emerald-900"
    : feedback.type === "warning"    ? "bg-amber-900"
    : feedback.type === "overcharge" ? "bg-red-900"
    : "bg-red-950";

  return (
    <div className={`min-h-screen ${bgColor} flex flex-col items-center justify-center transition-colors duration-300 p-6`}>
      <h1 className="text-white text-xl font-bold mb-2">ROBUST 柔術</h1>
      <p className="text-zinc-400 text-sm mb-8">チェックイン</p>

      {/* カメラプレビュー */}
      {/* Why: max-w-full で 320px 端末でもオーバーフロー防止 */}
      <div className="relative mb-8 rounded-2xl overflow-hidden border-2 border-white/20 w-[280px] h-[280px] max-w-full" style={{ aspectRatio: "1" }}>
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          aria-label="QRコードスキャン用カメラ"
          playsInline
          muted
        />
        <canvas ref={canvasRef} className="hidden" />
        {/* スキャン枠 */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-48 h-48 border-2 border-emerald-400 rounded-lg opacity-70" />
        </div>
      </div>

      {/* フィードバック表示 */}
      {feedback ? (
        <div className="text-center animate-pulse">
          {feedback.type === "success" && <div className="text-5xl mb-3">✅</div>}
          {feedback.type === "warning" && <div className="text-5xl mb-3">⚠️</div>}
          {feedback.type === "overcharge" && <div className="text-5xl mb-3">💳</div>}
          {feedback.type === "error" && <div className="text-5xl mb-3">❌</div>}
          {feedback.name && (
            <p className="text-white text-2xl font-bold mb-2">{feedback.name}</p>
          )}
          <p className="text-white/80 text-sm">{feedback.message}</p>
        </div>
      ) : (
        <div className="text-center">
          <p className="text-zinc-500 text-sm">
            {scanning ? "QRコードをカメラにかざしてください" : "バーコードリーダーでスキャンしてください"}
          </p>
        </div>
      )}

      {/* hidden: USB リーダーのフォーカス確保 */}
      <input
        ref={barcodeInputRef}
        type="text"
        aria-label="バーコードリーダー入力"
        className="sr-only"
        readOnly
      />
    </div>
  );
}
