"use client";

import { useState } from "react";
import BeltProgressCard from "@/components/BeltProgressCard";
import BeltHistoryEditor from "@/components/profile/BeltHistoryEditor";

type BeltHistoryEntry = {
  belt: string;
  promoted_at: string;
  notes?: string | null;
};

type Props = {
  belt: string;
  stripes: number;
  monthsAtBelt: number;
  bjjStartDate: string | null;
  beltHistory: BeltHistoryEntry[];
  userId: string;
};

export default function BeltProgressSection({
  belt,
  stripes,
  monthsAtBelt,
  bjjStartDate,
  beltHistory,
  userId,
}: Props) {
  const [historyExpanded, setHistoryExpanded] = useState(false);

  return (
    <>
      <BeltProgressCard
        belt={belt}
        stripes={stripes}
        monthsAtBelt={monthsAtBelt}
        bjjStartDate={bjjStartDate}
        beltHistory={beltHistory}
        className="mb-3"
        onEditClick={() => setHistoryExpanded((prev) => !prev)}
      />
      <BeltHistoryEditor userId={userId} externalExpanded={historyExpanded} />
    </>
  );
}
