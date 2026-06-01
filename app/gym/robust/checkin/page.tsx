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

const GYM_ID = process.env.NEXT_PUBLIC_ROBUST_GYM_ID ?? "";
const FEEDBACK_DURATION_MS = 3000;

type FeedbackState = {
  type: "success" | "warning" | "error" | "overcharge";
  name: string;
  message: string;
} | null;

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

    // 確認音
    const audio = new AudioContext();
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.connect(gain);
    gain.connect(audio.destination);
    osc.frequency.value = 880;
    gain.gain.value = 0.3;
    osc.start();
    osc.stop(audio.currentTime + 0.12);

    try {
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
        await processToken(code.data);
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
  const barcodeBuffer = useRef("");
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Enter") {
        const token = barcodeBuffer.current.trim();
        barcodeBuffer.current = "";
        if (token) processToken(token);
      } else if (e.key.length === 1) {
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
      <div className="relative mb-8 rounded-2xl overflow-hidden border-2 border-white/20"
           style={{ width: 280, height: 280 }}>
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
