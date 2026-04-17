"use client";

import React, { useState, useEffect, useCallback } from "react";
import { formatDateShort } from "@/lib/formatDate";

type AdminUser = {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  belt: string;
  stripe: number;
  is_pro: boolean;
  has_gym: boolean;
  sessions_30d: number;
  sessions_total: number;
};

type ApiResponse = {
  users: AdminUser[];
  total: number;
  page: number;
  limit: number;
};

const BELT_COLORS: Record<string, string> = {
  white: "bg-gray-600 text-white",
  blue: "bg-blue-700 text-white",
  purple: "bg-purple-700 text-white",
  brown: "bg-amber-900 text-amber-100",
  black: "bg-zinc-800 text-white border border-zinc-600",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return formatDateShort(iso, "en");
}

function fmtDaysAgo(iso: string | null): string {
  if (!iso) return "never";
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (diff === 0) return "today";
  if (diff === 1) return "yesterday";
  return `${diff}d ago`;
}

export default function AdminPanel({ adminEmail }: { adminEmail: string }) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  // Q-110: CSV export
  const handleExportCsv = useCallback(async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams({ q: query, page: "0", limit: "200", format: "csv" });
      const res = await fetch(`/api/admin/users?${params}`);
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `bjj-app-users-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      // Network error — silently ignore
    } finally {
      setExporting(false);
    }
  }, [query]);

  const fetchUsers = useCallback(async (q: string, pg: number) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ q, page: String(pg), limit: "50" });
      const res = await fetch(`/api/admin/users?${params}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError((err as { error?: string }).error ?? "Failed to load users");
        return;
      }
      const json = (await res.json()) as ApiResponse;
      setData(json);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(0);
      fetchUsers(query, 0);
    }, 400);
    return () => clearTimeout(timer);
  }, [query, fetchUsers]);

  useEffect(() => {
    fetchUsers(query, page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const proCount = data?.users.filter((u) => u.is_pro).length ?? 0;
  const gymOwnerCount = data?.users.filter((u) => u.has_gym).length ?? 0;
  const activeCount = data?.users.filter((u) => u.sessions_30d > 0).length ?? 0;

  return (
    <div className="min-h-[100dvh] bg-zinc-950 text-white">
      {/* Header */}
      <div className="border-b border-white/10 px-4 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-white">🛡️ Admin Panel</h1>
            <p className="text-xs text-zinc-400">{adminEmail}</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={exporting || !data}
              className="text-xs text-zinc-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors border border-white/10 px-3 py-1.5 rounded-lg"
            >
              {exporting ? "Exporting…" : "Export CSV"}
            </button>
            <a href="/dashboard" className="text-xs text-zinc-400 hover:text-white transition-colors">
              ← Back to app
            </a>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Summary stats */}
        {data && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <div className="bg-zinc-900 border border-white/10 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-white">{data.total}</div>
              <div className="text-xs text-zinc-400 mt-0.5">Total Users</div>
            </div>
            <div className="bg-zinc-900 border border-white/10 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-yellow-400">{proCount}</div>
              <div className="text-xs text-zinc-400 mt-0.5">Pro (this page)</div>
            </div>
            <div className="bg-zinc-900 border border-white/10 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-blue-400">{gymOwnerCount}</div>
              <div className="text-xs text-zinc-400 mt-0.5">Gym Members</div>
            </div>
            <div className="bg-zinc-900 border border-white/10 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-green-400">{activeCount}</div>
              <div className="text-xs text-zinc-400 mt-0.5">Active (30d)</div>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="mb-4">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by email…"
            className="w-full bg-zinc-900 border border-white/10 text-white placeholder-gray-600 px-4 py-2.5 rounded-xl text-sm focus:outline-none focus:border-white/30"
          />
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-900/30 border border-red-500/30 text-red-300 rounded-xl px-4 py-3 text-sm mb-4">
            {error}
          </div>
        )}

        {/* User table */}
        {loading && !data ? (
          <div className="text-center py-16 text-zinc-400 text-sm">Loading…</div>
        ) : (
          <>
            <div className="space-y-1.5">
              {(data?.users ?? []).map((user) => (
                <div key={user.id}>
                  <button
                    type="button"
                    onClick={() => setExpanded(expanded === user.id ? null : user.id)}
                    className="w-full text-left bg-zinc-900 border border-white/10 hover:border-white/20 rounded-xl px-4 py-3 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {/* Belt badge */}
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize flex-shrink-0 ${BELT_COLORS[user.belt] ?? BELT_COLORS.white}`}>
                        {user.belt}
                      </span>
                      {/* Email */}
                      <span className="flex-1 text-sm text-white truncate min-w-0">{user.email}</span>
                      {/* Badges */}
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {user.is_pro && (
                          <span className="text-xs bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 px-1.5 py-0.5 rounded-full font-semibold">
                            PRO
                          </span>
                        )}
                        {user.has_gym && (
                          <span className="text-xs bg-blue-500/20 text-blue-400 border border-blue-500/30 px-1.5 py-0.5 rounded-full">
                            GYM
                          </span>
                        )}
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${user.sessions_30d > 0 ? "bg-green-500/20 text-green-400" : "bg-zinc-800 text-zinc-500"}`}>
                          {user.sessions_30d}s/30d
                        </span>
                      </div>
                    </div>
                  </button>

                  {/* Expanded detail row */}
                  {expanded === user.id && (
                    <div className="bg-zinc-900/60 border border-white/5 border-t-0 rounded-b-xl px-4 py-4 -mt-1 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                      <div>
                        <div className="text-zinc-400 mb-0.5">User ID</div>
                        <div className="font-mono text-zinc-300 break-all">{user.id}</div>
                      </div>
                      <div>
                        <div className="text-zinc-400 mb-0.5">Signed up</div>
                        <div className="text-zinc-300">{fmtDate(user.created_at)}</div>
                      </div>
                      <div>
                        <div className="text-zinc-400 mb-0.5">Last login</div>
                        <div className="text-zinc-300">{fmtDaysAgo(user.last_sign_in_at)}</div>
                      </div>
                      <div>
                        <div className="text-zinc-400 mb-0.5">Total sessions</div>
                        <div className="text-zinc-300 font-bold">{user.sessions_total}</div>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {data?.users.length === 0 && !loading && (
                <div className="text-center py-16 text-zinc-400 text-sm">
                  {query ? `No users matching "${query}"` : "No users found"}
                </div>
              )}
            </div>

            {/* Pagination */}
            {data && data.total > (data.limit ?? 50) && (
              <div className="flex items-center justify-center gap-3 mt-6">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0 || loading}
                  className="text-xs text-zinc-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors px-3 py-1.5 border border-white/10 rounded-lg"
                >
                  ← Previous
                </button>
                <span className="text-xs text-zinc-400">
                  Page {page + 1} · {data.total} total
                </span>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={(page + 1) * (data.limit ?? 50) >= data.total || loading}
                  className="text-xs text-zinc-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors px-3 py-1.5 border border-white/10 rounded-lg"
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}

        {loading && data && (
          <div className="text-center text-xs text-zinc-500 mt-2">Refreshing…</div>
        )}
      </div>
    </div>
  );
}
