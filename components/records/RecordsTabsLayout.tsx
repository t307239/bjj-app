"use client";

import { type ReactNode } from "react";
import PageTabs from "@/components/PageTabs";
import { useLocale } from "@/lib/i18n";

interface Props {
  /** Slot: Training log, competitions, goals, gym features */
  logSlot: ReactNode;
  /** Slot: Charts, stats, badges, analytics */
  statsSlot: ReactNode;
}

export default function RecordsTabsLayout({ logSlot, statsSlot }: Props) {
  const { t } = useLocale();

  const tabs = [
    { key: "log", label: t("records.tabLog") },
    { key: "stats", label: t("records.tabStats") },
  ];

  return (
    <PageTabs tabs={tabs} defaultTab="log" urlParam="tab">
      {(activeTab) => (
        <>
          {activeTab === "log" && logSlot}
          {activeTab === "stats" && statsSlot}
        </>
      )}
    </PageTabs>
  );
}
