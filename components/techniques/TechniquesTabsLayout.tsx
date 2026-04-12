"use client";

import { type ReactNode } from "react";
import PageTabs from "@/components/PageTabs";
import { useLocale } from "@/lib/i18n";

interface Props {
  /** Slot: Technique journal (CRUD list) */
  journalSlot: ReactNode;
  /** Slot: Skill map (visual graph) */
  skillMapSlot: ReactNode;
  /** Slot: Wiki links & learning resources */
  wikiSlot: ReactNode;
}

export default function TechniquesTabsLayout({
  journalSlot,
  skillMapSlot,
  wikiSlot,
}: Props) {
  const { t } = useLocale();

  const tabs = [
    { key: "journal", label: t("techniques.tabJournal") },
    { key: "skillmap", label: t("techniques.tabSkillMap") },
    { key: "wiki", label: t("techniques.tabWiki") },
  ];

  return (
    <PageTabs tabs={tabs} defaultTab="journal">
      {(activeTab) => (
        <>
          {activeTab === "journal" && journalSlot}
          {activeTab === "skillmap" && skillMapSlot}
          {activeTab === "wiki" && wikiSlot}
        </>
      )}
    </PageTabs>
  );
}
