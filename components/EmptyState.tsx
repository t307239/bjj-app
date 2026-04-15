"use client";

type Props = {
  emoji: string;
  title: string;
  description?: string;
  /** Additional info lines below description */
  hints?: string[];
  /** CTA button */
  action?: {
    label: string;
    onClick: () => void;
  };
  /** Link-style CTA (alternative to button) */
  linkAction?: {
    label: string;
    href: string;
  };
  /** Compact mode — less padding */
  compact?: boolean;
};

/**
 * Shared empty-state component.
 * Replaces ad-hoc "no data" blocks across the app with a consistent,
 * accessible pattern.
 */
export default function EmptyState({
  emoji,
  title,
  description,
  hints,
  action,
  linkAction,
  compact = false,
}: Props) {
  return (
    <div
      role="status"
      className={`text-center ${compact ? "py-8" : "py-12"} px-4`}
    >
      <div className={`${compact ? "text-3xl mb-2" : "text-5xl mb-4"}`}>
        {emoji}
      </div>
      <p className="text-white font-bold text-base mb-1">{title}</p>
      {description && (
        <p className="text-zinc-400 text-sm mb-2 max-w-[280px] mx-auto leading-relaxed">
          {description}
        </p>
      )}
      {hints && hints.length > 0 && (
        <div className="flex justify-center gap-4 text-xs text-zinc-500 mb-4 flex-wrap">
          {hints.map((h) => (
            <span key={h}>{h}</span>
          ))}
        </div>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-xl transition-colors active:scale-95"
        >
          {action.label}
        </button>
      )}
      {linkAction && (
        <a
          href={linkAction.href}
          className="mt-2 inline-block px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-xl transition-colors active:scale-95"
        >
          {linkAction.label}
        </a>
      )}
    </div>
  );
}
