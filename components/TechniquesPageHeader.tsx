"use client";
import { useLocale } from "@/lib/i18n";

export default function TechniquesPageHeader({ isPro }: { isPro: boolean }) {
  const { t } = useLocale();
  return (
    <>
      <div className="mb-6">
        <h2 className="text-2xl font-bold">{t("techniquesPage.title")}</h2>
        <p className="text-gray-400 text-sm mt-1">{t("techniquesPage.subtitle")}</p>
      </div>
    </>
  );
}

export function SkillMapSectionHeader({ isPro }: { isPro: boolean }) {
  const { t } = useLocale();
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-base">🗺️</span>
      <h3 className="text-sm font-semibold text-zinc-100">{t("techniquesPage.skillMap")}</h3>
      {!isPro && (
        <span className="ml-auto text-xs text-gray-500">
          {t("techniquesPage.freeLimit")}
        </span>
      )}
    </div>
  );
}

export function TechniqueLogSectionHeader() {
  const { t } = useLocale();
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-base">📝</span>
      <h3 className="text-sm font-semibold text-zinc-100">{t("techniquesPage.techniqueLog")}</h3>
    </div>
  );
}

export function WikiLinksHeader() {
  const { t } = useLocale();
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-base">📚</span>
      <h3 className="text-sm font-semibold text-zinc-100">{t("techniquesPage.learnWiki")}</h3>
    </div>
  );
}

export function WikiLinksFootnote() {
  const { t } = useLocale();
  return (
    <p className="text-[10px] text-gray-600 mt-2">
      {t("techniquesPage.wikiDesc")}
    </p>
  );
}
