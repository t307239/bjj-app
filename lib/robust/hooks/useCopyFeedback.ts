"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** コピー成功後に「✓」表示を出しておく時間(ms) */
const COPIED_FEEDBACK_MS = 2000;

/**
 * クリップボードへコピーし、コピーしたボタンに一時的な完了表示を出すためのフック。
 * - copiedKey: 直近にコピーに成功したボタンの識別子(表示切替用)。一定時間後に null へ戻る
 * - copyText: テキストをコピーする
 *
 * Why: Drive共有のメール一括コピーとカード登録リンクのコピーで同じ処理が必要。
 *      クリップボードAPIが無効/権限拒否(非HTTPS・一部環境)でも黙って失敗しないよう、
 *      失敗時は手動コピー用の prompt をフォールバック表示する。
 */
export function useCopyFeedback() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // アンマウント後に setState しないようタイマーを破棄する
  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const copyText = useCallback((key: string, text: string) => {
    const onCopied = () => {
      setCopiedKey(key);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(
        () => setCopiedKey((current) => (current === key ? null : current)),
        COPIED_FEEDBACK_MS,
      );
    };
    const fallback = () =>
      window.prompt("コピーできませんでした。下記を手動でコピーしてください", text);

    if (!navigator.clipboard?.writeText) {
      fallback();
      return;
    }
    navigator.clipboard.writeText(text).then(onCopied).catch(fallback);
  }, []);

  return { copiedKey, copyText };
}
