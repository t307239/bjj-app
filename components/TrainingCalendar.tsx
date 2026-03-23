"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Log = {
  id: string;
  date: string;
  type: string;
  duration_min: number;
  notes?: string;
};

type Props = {
  userId: string;
};

const TYPE_COLORS: Record<string, string> = {
  gi:          "bg-blue-500",
  nogi:        "bg-orange-500",
  drilling:    "bg-purple-500",
  competition: "bg-red-500",
  open_mat:    "bg-green-500",
};

const TYPE_LABEL: Record<string, string> = {
  gi:          "Gi",
  nogi:        "NoGi",
  drilling:    "Drill",
  competition: "Comp",
  open_mat:    "Open",
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatDuration(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h${m}m` : `${h}h`;
}

export default function TrainingCalendar({ userId }: Props) {
  const today = new Date();
  const router = useRouter();
  const [year, setYear]   = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0-indexed
  const [logs, setLogs]   = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const firstDay = `${year}-${String(month + 1).padStart(2, "0")}-01`;
      const lastDay  = new Date(year, month + 1, 0);
      const lastStr  = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay.getDate()).padStart(2, "0")}`;

      const { data } = await supabase
        .from("training_logs")
        .select("id, date, type, duration_min, notes")
        .eq("user_id", userId)
        .gte("date", firstDay)
        .lte("date", lastStr)
        .order("date", { ascending: true });

      setLogs(data ?? []);
      setLoading(false);
    };
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, year, month]);

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
    setSelectedDate(null);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
    setSelectedDate(null);
  };

  // Group logs by date
  const logsByDate: Record<string, Log[]> = {};
  logs.forEach(log => {
    if (!logsByDate[log.date]) logsByDate[log.date] = [];
    logsByDate[log.date].push(log);
  });

  // Calendar grid */}
  const firstOfMonth = new Date(year, month, 1);
  const startWeekday = firstOfMonth.getDay(); // 0=Sun
  const daysInMonth  = new Date(year, month + 1, 0).getDate();

  const cells: (number | null)[] = [
    ...Array(startWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // Pad rows to fill 6 weeks
  while (cells.length % 7 !== 0) cells.push(null);

  // Use local date (not UTC) for toISOString
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const totalSessions = logs.length;
  const totalMinutes  = logs.reduce((s, l) => s + (l.duration_min || 0), 0);

  const selectedLogs = selectedDate ? (logsByDate[selectedDate] ?? []) : [];

  return (
    <div className="bg-zinc-900 rounded-xl border border-white/10 mb-4 overflow-hidden">
      {/* this comment was added to help with the calendar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <button
          onClick={prevMonth}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
        >
          ‹
        </button>
        <div className="text-center">
          <div className="font-bold text-white">{new Date(year, month).toLocaleDateString("en-US", { year: "numeric", month: "long" })}</div>
          {!loading && (
            <div className="text-xs text-gray-500 mt-0.5">
              {totalSessions} sessions · {formatDuration(totalMinutes)}
            </div>
          )}
        </div>
        <button
          onClick={nextMonth}
          disabled={year === today.getFullYear() && month === today.getMonth()}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          ›
        </button>
      </div>

      {/* Legend — above calendar grid for visual context */}
      <div className="px-4 pt-2 pb-1 flex flex-wrap gap-3">
        {Object.entries(TYPE_LABEL).map(([key, label]) => (
          <div key={key} className="flex items-center gap-1">
            <div className={`w-2 h-2 rounded-full ${TYPE_COLORS[key]}`} />
            <span className="text-[10px] text-gray-500">{label}</span>
          </div>
        ))}
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b border-white/5">
        {WEEKDAYS.map((d, i) => (
          <div
            key={d}
            className="text-center text-[11px] py-2 font-medium text-gray-400"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      {loading ? (
        <div className="py-10 text-center text-gray-600 text-sm">Loading...</div>
      ) : (
        <div className="grid grid-cols-7">
          {cells.map((day, idx) => {
            if (day === null) {
              return <div key={`empty-${idx}`} className="aspect-square p-1" />;
            }
            const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const dayLogs = logsByDate[dateStr] ?? [];
            const hasLogs = dayLogs.length > 0;
            const isToday = dateStr === todayStr;
            const isSelected = dateStr === selectedDate;
            const weekday = (startWeekday + day - 1) % 7;

            return (
              <button
                key={dateStr}
                onClick={() => {
                  if (hasLogs) {
                    setSelectedDate(isSelected ? null : dateStr);
                  } else if (dateStr <= todayStr) {
                    // Empty past day → open TrainingLogForm pre-filled with this date
                    router.push(`?addLog=${dateStr}`);
                  }
                }}
                title={!hasLogs && dateStr <= todayStr ? "Tap to log a session on this day" : undefined}
                className={`aspect-square p-1 flex flex-col items-center justify-start transition-colors rounded-lg m-0.5
                  ${isSelected ? "bg-white/10 ring-1 ring-[#e94560]" : hasLogs ? "hover:bg-white/5" : dateStr <= todayStr ? "hover:bg-white/[0.06] hover:border hover:border-white/10" : "hover:bg-white/[0.03]"}
                  ${!hasLogs && dateStr <= todayStr ? "cursor-pointer" : !hasLogs ? "cursor-default" : "cursor-pointer"}`}
              >
                {/* you can add comments here */}
                <div className={`text-[11px] font-medium w-5 h-5 flex items-center justify-center rounded-full
                  ${isToday ? "bg-[#e94560] text-white" : "text-gray-300"}`}
                >
                  {day}
                </div>
                {hasLogs && (
                  <div className="flex flex-col items-center gap-0.5 mt-0.5">
                    <div className="flex flex-wrap gap-0.5 justify-center">
                      {dayLogs.slice(0, 3).map((log, i) => (
                        <div
                          key={i}
                          className={`w-1.5 h-1.5 rounded-full ${TYPE_COLORS[log.type] ?? "bg-zinc-400"}`}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* you can add comments here */}
      {selectedDate && selectedLogs.length > 0 && (
        <div className="border-t border-white/10 px-4 py-3 space-y-2">
          <div className="text-xs text-gray-500 font-medium">
            {selectedDate} sessions
          </div>
          {selectedLogs.map(log => (
            <div key={log.id} className="flex items-start gap-3 bg-white/5 rounded-lg px-3 py-2">
              <div className={`w-2 h-2 rounded-full mt-1 flex-shrink-0 ${TYPE_COLORS[log.type] ?? "bg-zinc-400"}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-white">{TYPE_LABEL[log.type] ?? log.type}</span>
                  <span className="text-xs text-gray-500">{formatDuration(log.duration_min)}</span>
                </div>
                {log.notes && (
                  <p className="text-xs text-gray-400 mt-0.5 truncate">{log.notes}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
