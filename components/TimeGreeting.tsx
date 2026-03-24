"use client";

import { useState, useEffect } from "react";

interface TimeGreetingProps {
  displayName: string;
}

function getGreeting(hour: number): { text: string; emoji: string } {
  if (hour >= 5 && hour < 12) {
    return { text: "Good morning", emoji: "🌅" };
  } else if (hour >= 12 && hour < 17) {
    return { text: "Time to train", emoji: "☀️" };
  } else if (hour >= 17 && hour < 22) {
    return { text: "Evening session?", emoji: "🌆" };
  } else {
    return { text: "Rest well", emoji: "🌙" };
  }
}

export default function TimeGreeting({ displayName }: TimeGreetingProps) {
  const [greeting, setGreeting] = useState<{ text: string; emoji: string } | null>(null);

  useEffect(() => {
    setGreeting(getGreeting(new Date().getHours()));
  }, []);

  // SSR / before hydration: show static greeting
  if (!greeting) {
    return (
      <h2 className="text-xl font-bold tracking-tight">
        Welcome back, {displayName}
      </h2>
    );
  }

  return (
    <h2 className="text-xl font-bold tracking-tight">
      {greeting.emoji} {greeting.text}, {displayName}
    </h2>
  );
}
