"use client";

/**
 * GuestDashboardClient — Client Component wrapper for GuestDashboard
 *
 * `ssr: false` は Server Component 内の dynamic() では使用不可のため、
 * このファイル（Client Component）で dynamic import を定義する。
 * GuestDashboard は localStorage を使用するため CSR 専用レンダリングが必要。
 */

import dynamic from "next/dynamic";

const GuestDashboard = dynamic(() => import("@/components/GuestDashboard"), {
  ssr: false,
  loading: () => (
    <div className="min-h-[100dvh] bg-zinc-950">
      <div className="h-14 bg-gradient-to-r from-violet-600/70 to-indigo-600/60" />
      <div className="max-w-4xl mx-auto px-4 py-6 animate-pulse">
        <div className="h-7 w-44 bg-zinc-800 rounded-lg mb-2" />
        <div className="h-4 w-60 bg-zinc-800 rounded mb-6" />
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="h-24 bg-zinc-900 rounded-xl border border-white/10" />
          <div className="h-24 bg-zinc-900 rounded-xl border border-white/10" />
        </div>
        <div className="h-48 bg-zinc-900 rounded-xl border border-white/10" />
      </div>
    </div>
  ),
});

export default function GuestDashboardClient() {
  return <GuestDashboard />;
}
