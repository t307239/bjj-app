"use client";

type Props = {
  isMobile: boolean;
  editMode: boolean;
  setEditMode: (v: boolean) => void;
  connectingFrom: string | null;
  isOrganizing: boolean;
  isOnline: boolean;
  isFullscreen: boolean;
  isPro: boolean;
  nodeCount: number;
  lastNodePosition: { x: number; y: number } | null;
  onMagicOrganize: () => void;
  onShowProModal: () => void;
  onAddPopup: (popup: { screenX: number; screenY: number; flowX: number; flowY: number }) => void;
  onMobileAdd: (pos: { flowX: number; flowY: number }) => void;
  t: (k: string) => string;
};

export default function SkillMapToolbar({
  isMobile,
  editMode,
  setEditMode,
  connectingFrom,
  isOrganizing,
  isOnline,
  isFullscreen,
  isPro,
  nodeCount,
  lastNodePosition,
  onMagicOrganize,
  onShowProModal,
  onAddPopup,
  onMobileAdd,
  t,
}: Props) {
  const handleMobileAdd = () => {
    if (!isPro && nodeCount >= 10) { onShowProModal(); return; }
    const x = lastNodePosition ? lastNodePosition.x + 200 : 100;
    const y = lastNodePosition ? lastNodePosition.y : 100;
    onMobileAdd({ flowX: x, flowY: y });
  };

  return (
    <div className="flex items-center gap-2 mb-2 px-1 flex-wrap">
      {isMobile && (
        <div className="flex items-center gap-1.5 bg-zinc-800 rounded-lg p-1">
          <button type="button"
            onClick={() => setEditMode(false)}
            aria-label={t("skillmap.viewMode")}
            aria-pressed={!editMode}
            className={`text-xs px-2.5 py-1 rounded-md transition-all ${!editMode ? "bg-zinc-600 text-white font-semibold" : "text-zinc-500 hover:text-zinc-300"}`}
          >
            {t("skillmap.viewMode")}
          </button>
          <button type="button"
            onClick={() => setEditMode(true)}
            aria-label={t("skillmap.editMode")}
            aria-pressed={editMode}
            className={`text-xs px-2.5 py-1 rounded-md transition-all ${editMode ? "bg-[#6366f1] text-white font-semibold" : "text-zinc-500 hover:text-zinc-300"}`}
          >
            ✏️ {t("skillmap.editMode")}
          </button>
        </div>
      )}
      {connectingFrom && (
        <span className="text-xs text-yellow-400 animate-pulse">
          {t("skillmap.connectMobileHint")}
        </span>
      )}
      <button type="button"
        onClick={onMagicOrganize}
        disabled={isOrganizing || nodeCount === 0 || !isOnline}
        className="ml-auto flex items-center gap-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg transition-all active:scale-95"
        aria-label={t("skillmap.magicOrganize")}
      >
        {isOrganizing ? "⏳" : "✨"} {t("skillmap.magicOrganize")}
      </button>
      <button type="button"
        onClick={() => {
          if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
          } else {
            document.exitFullscreen();
          }
        }}
        className="flex items-center gap-1 text-xs bg-zinc-800 hover:bg-zinc-700 text-white px-2.5 py-1.5 rounded-lg transition-all active:scale-95"
        aria-label={isFullscreen ? t("skillmap.exitFullScreen") : t("skillmap.fullScreen")}
        title={isFullscreen ? t("skillmap.exitFullScreen") : t("skillmap.fullScreen")}
      >
        {isFullscreen ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
          </svg>
        )}
      </button>
      {!isMobile && (
        <span className="text-xs text-zinc-400 ml-2 hidden sm:inline">{t("skillmap.pcHint")}</span>
      )}
      {isMobile && editMode && (
        <button type="button"
          disabled={!isOnline}
          onClick={handleMobileAdd}
          aria-label={t("skillmap.addNodeMobile")}
          className="text-xs bg-[#10B981] hover:bg-[#0d9668] disabled:opacity-50 text-white px-3 py-1.5 rounded-lg transition-all active:scale-95"
        >
          + {t("skillmap.addNodeMobile")}
        </button>
      )}
    </div>
  );
}
