"use client";

/**
 * useProfile — Data layer hook for ProfileForm.
 * Loads profile + stats from Supabase on mount.
 */

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchTrainingSummary } from "@/lib/api/training";
import { countTechniques } from "@/lib/api/techniques";

// ─── Types ────────────────────────────────────────────────────────────────────

export type Profile = {
  belt: string;
  stripe: number;
  gym: string;
  bio: string;
  start_date: string;
};

export type Stats = {
  totalCount: number;
  totalMinutes: number;
  techniqueCount: number;
};

type UseProfileProps = {
  userId: string;
};

export function useProfile({ userId }: UseProfileProps) {
  const supabase = useRef(createClient()).current;

  const [profile, setProfile] = useState<Profile>({
    belt: "white",
    stripe: 0,
    gym: "",
    bio: "",
    start_date: "",
  });
  const [stats, setStats] = useState<Stats | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      setInitialLoading(true);
      const [profileRes, summaryRes, techRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("belt, stripe, gym, bio, start_date")
          .eq("id", userId)
          .single(),
        fetchTrainingSummary(supabase, userId),
        countTechniques(supabase, userId),
      ]);
      if (profileRes.data) {
        setProfile({
          belt: profileRes.data.belt || "white",
          stripe: profileRes.data.stripe || 0,
          gym: profileRes.data.gym || "",
          bio: profileRes.data.bio || "",
          start_date: profileRes.data.start_date || "",
        });
      } else {
        setIsEditing(true);
      }
      if (!summaryRes.error) {
        setStats({
          totalCount: summaryRes.data.totalSessions,
          totalMinutes: summaryRes.data.totalMinutes,
          techniqueCount: techRes.count,
        });
      }
      setInitialLoading(false);
    };
    loadProfile();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  return {
    supabase,
    profile, setProfile,
    stats,
    initialLoading,
    isEditing, setIsEditing,
  };
}
