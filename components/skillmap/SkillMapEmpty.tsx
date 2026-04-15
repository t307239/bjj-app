"use client";

import { useRef, useState } from "react";
import ProModal from "./ProModal";

type Props = {
  isMobile: boolean;
  isPro: boolean;
  nodeCount: number;
  showProModal: boolean;
  onShowProModal: () => void;
  onCloseProModal: () => void;
  onAddNode: (name: string, x: number, y: number) => void;
  stripePaymentLink: string | null;
  stripeAnnualLink: string | null;
  t: (k: string) => string;
};

export default function SkillMapEmpty({
  isMobile,
  isPro,
  nodeCount,
  showProModal,
  onShowProModal,
  onCloseProModal,
  onAddNode,
  stripePaymentLink,
  stripeAnnualLink,
  t,
}: Props) {
  const emptyRef = useRef<HTMLInputElement>(null);
  const [emptyAddName, setEmptyAddName] = useState("");

  return (
    <div className="flex flex-col items-center justify-center h-56 text-center">
      <div className="text-5xl mb-4">🗺️</div>
      <p className="text-gray-300 font-medium mb-1">{t("skillmap.emptyTitle")}</p>
      <p className="text-gray-500 text-sm mb-5">{isMobile ? t("skillmap.emptyBody") : t("skillmap.emptyBodyPC")}</p>
      {!emptyAddName ? (
        <button
          onClick={() => {
            if (!isPro && nodeCount >= 10) { onShowProModal(); return; }
            setEmptyAddName(" ");
            setTimeout(() => emptyRef.current?.focus(), 50);
          }}
          className="bg-[#10B981] hover:bg-[#0d9668] text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors active:scale-95"
        >
          + {t("skillmap.addFirstTechnique")}
        </button>
      ) : (
        <div className="flex flex-col items-center gap-2 w-full max-w-xs">
          <input
            ref={emptyRef}
            type="text"
            placeholder={t("skillmap.namePlaceholder")}
            value={emptyAddName.trim() ? emptyAddName : ""}
            onChange={(e) => setEmptyAddName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && emptyAddName.trim()) { onAddNode(emptyAddName.trim(), 200, 200); setEmptyAddName(""); }
              if (e.key === "Escape") setEmptyAddName("");
            }}
            className="w-full bg-zinc-800 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-white/30"
            maxLength={80}
          />
          <div className="flex gap-2 w-full">
            <button onClick={() => setEmptyAddName("")} className="flex-1 bg-zinc-700 hover:bg-zinc-600 text-gray-300 text-sm py-2 rounded-xl transition-colors">{t("common.cancel")}</button>
            <button
              onClick={() => { if (emptyAddName.trim()) { onAddNode(emptyAddName.trim(), 200, 200); setEmptyAddName(""); } }}
              disabled={!emptyAddName.trim()}
              className="flex-1 bg-[#10B981] hover:bg-[#0d9668] disabled:opacity-40 text-white text-sm font-semibold py-2 rounded-xl transition-colors"
            >{t("skillmap.addBtn")}</button>
          </div>
        </div>
      )}
      {showProModal && <ProModal onClose={onCloseProModal} stripePaymentLink={stripePaymentLink} stripeAnnualLink={stripeAnnualLink} t={t} />}
    </div>
  );
}
