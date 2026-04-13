"use client";

import { useState, useRef } from "react";

/**
 * DraftNumberInput — number型のvalueを受け取るinputの安全なラッパー。
 *
 * 問題: `<input type="number" value={num} onChange={e => setNum(parseInt(e.target.value) || 60)} />`
 *   → ユーザーがフィールドをクリアすると即座にfallback値に戻り、カスタム値を入力できない。
 *
 * 解決: ローカルのstring draft stateで入力中の値を保持し、blur/Enterで親に反映。
 *   → 入力中は自由に編集可能。不正値はblur時に元の値に戻る。
 *
 * 使い方:
 *   <DraftNumberInput value={form.duration_min} onChange={(v) => setForm({...form, duration_min: v})} min={1} max={480} />
 */
type Props = {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
  placeholder?: string;
  inputMode?: "numeric" | "decimal";
};

export default function DraftNumberInput({
  value,
  onChange,
  min = 0,
  max = Infinity,
  step = 1,
  className = "",
  placeholder,
  inputMode = "numeric",
}: Props) {
  const [draft, setDraft] = useState(String(value));
  const prevValue = useRef(value);

  // 親のvalueが変わったらdraftも同期（プリセット選択時など）
  if (prevValue.current !== value) {
    prevValue.current = value;
    setDraft(String(value));
  }

  const commit = () => {
    const n = parseFloat(draft);
    if (!isNaN(n) && n >= min && n <= max) {
      // step が整数なら整数化
      onChange(step >= 1 ? Math.round(n) : n);
    } else {
      // 不正値 → 元に戻す
      setDraft(String(value));
    }
  };

  return (
    <input
      type="number"
      inputMode={inputMode}
      value={draft}
      min={min}
      max={max}
      step={step}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Enter") commit(); }}
      className={className}
      placeholder={placeholder}
    />
  );
}
