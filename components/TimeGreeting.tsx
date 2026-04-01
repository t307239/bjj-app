"use client";

import { useState, useEffect } from "react";
import { useLocale } from "@/lib/i18n";

interface TimeGreetingProps {
  displayName: string;
}

type GreetingKey =
  | "dashboard.greetingMorning"
  | "dashboard.greetingAfternoon"
  | "dashboard.greetingEvening"
  | "dashboard.greetingNight";

function getGreetingKey(hour: number): { key: GreetingKey; emoji: string } {
  if (hour >= 5 && hour < 12) {
    return { key: "dashboard.greetingMorning", emoji: "🌅" };
  } else if (hour >= 12 && hour < 17) {
    return { key: "dashboard.greetingAfternoon", emoji: "☀️" };
  } else if (hour >= 17 && hour < 22) {
    return { key: "dashboard.greetingEvening", emoji: "🌆" };
  } else {
    return { key: "dashboard.greetingNight", emoji: "🌙" };
  }
}

export default function TimeGreeting({ displayName }: TimeGreetingProps) {
  const { t } = useLocale();
  const [greeting, setGreeting] = useState<{ key: GreetingKey; emoji: string } | null>(null);

  useEffect(() => {
    setGreeting(getGreetingKey(new Date().getHours()));
  }, []);

  // SSR / before hydration: use welcomeBack key
  if (!greeting) {
    return (
      <h2 className="text-xl font-bold tracking-tight">
        {t("dashboard.welcomeBack", { name: displayName })}
      </h2>
    );
  }

  return (
    <h2 className="text-xl font-bold tracking-tight">
      {greeting.emoji} {t(greeting.key)}, {displayName}
    </h2>
  );
}
