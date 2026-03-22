"use client";
import { useLocale } from "@/lib/i18n";

export default function GymDashboardPageHeader() {
  const { t } = useLocale();
  return (
    <div className="mb-6">
      <h2 className="text-2xl font-bold">🏫 {t("gym.dashboardTitle")}</h2>
      <p className="text-gray-400 text-sm mt-1">{t("gym.dashboardSubtitle")}</p>
    </div>
  );
}
