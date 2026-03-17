"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

type Props = {
  userId: string;
};

type CompRecord = {
  win: number;
  loss: number;
  draw: number;
  total: number;
  winBySub: number;
  lossBySub: number;
};

type CompEntry = { result: string; finish: string };

const COMP_PREFIX = "__comp__";

function decodeEntry(notes: string): CompEntry | null {
  if (!notes || !notes.startsWith(COMP_PREFIX)) return null;
  const nl = notes.indexOf("\n");
  const jsonStr = nl === -1 ? notes.slice(COMP_PREFIX.length) : notes.slice(COMP_PREFIX.length, nl);
  try {
    const comp = JSON.parse(jsonStr) as { result: string; finish?: string };
    return { result: comp.result, finish: comp.finish ?? "" };
  } catch {
    return null;
  }
}

function DonutSegment({
  value,
  total,
  offset,
  color,
  r,
}: {
  value: number;
  total: number;
  offset: number;
  color: string;
  r: number;
}) {
  if (value === 0 || total === 0) return null;
  const cx = 40;
  const cy = 40;
  const circumference = 2 * Math.PI * r;
  const pct = value / total;
  const dash = pct * circumference;
  const gap = circumference - dash;
  const rotate = (offset / total) * 360 - 90;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={r}
      fill="none"
      stroke={color}
      strokeWidth={14}
      strokeDasharray={`${dash} ${gap}`}
      transform={`rotate(${rotate} ${cx} ${cy})`}
      strokeLinecap="butt"
    />
  );
}

export default function CompetitionStats({ userId }: Props) {
  const [record, setRecord] = useState<CompRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("training_logs")
        .select("notes")
        .eq("user_id", userId)
        .eq("type", "competition");

      if (data) {
        const rec: CompRecord = { win: 0, loss: 0, draw: 0, total: 0, winBySub: 0, lossBySub: 0 };
        data.forEach((l: { notes: string }) => {
          const entry = decodeEntry(l.notes);
          if (!entry) { rec.total++; return; }
          const hasSub = entry.finish.trim() !== "";
          if (entry.result === "win") {
            rec.win++; rec.total++;
            if (hasSub) rec.winBySub++;
          } else if (entry.result === "loss") {
            rec.loss++; rec.total++;
            if (hasSub) rec.lossBySub++;
          } else if (entry.result === "draw") {
            rec.draw++; rec.total++;
          } else {
            rec.total++;
          }
        });
        setRecord(rec);
      }
      setLoading(false);
    };
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  if (loading || !record || record.total === 0) return null;

  const decoded = record.win + record.loss + record.draw;
  const winPct = decoded > 0 ? Math.round((record.win / decoded) * 100) : 0;
  const winByDecision = record.win - record.winBySub;
  const lossToSub = record.lossBySub;
  const showBreakdown = record.win > 0 && (record.winBySub > 0 || winByDecision > 0);
  const donutR = 28;

  return (
    <div className="bg-[#16213e] rounded-xl p-4 border border-gray-700 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-gray-300">🏆 試合戦績</h4>
        <span className="text-[10px] text-gray-500">計{record.total}試合</span>
      </div>

      <div className="flex items-center gap-4 mb-3">
        {decoded > 0 && (
          <div className="relative flex-shrink-0">
            <svg width="80" height="80" viewBox="0 0 80 80">
              <circle cx="40" cy="40" r={donutR} fill="none" stroke="#374151" strokeWidth={14} />
              <DonutSegment value={record.win} total={decoded} offset={0} color="#4ade80" r={donutR} />
              <DonutSegment value={record.loss} total={decoded} offset={record.win} color="#f87171" r={donutR} />
              <DonutSegment value={record.draw} total={decoded} offset={record.win + record.loss} color="#fbbf24" r={donutR} />
              <text x="40" y="36" textAnchor="middle" style={{ fill: "white", fontSize: "14px", fontWeight: "bold" }}>
                {winPct}%
              </text>
              <text x="40" y="50" textAnchor="middle" style={{ fill: "#9ca3af", fontSize: "9px" }}>
                勝率
              </text>
            </svg>
          </div>
        )}
        <div className="flex-1 grid grid-cols-3 gap-1.5">
          <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-2 text-center">
            <div className="text-xl font-bold text-green-400">{record.win}</div>
            <div className="text-[10px] text-gray-500">勝利</div>
          </div>
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-2 text-center">
            <div className="text-xl font-bold text-red-400">{record.loss}</div>
            <div className="text-[10px] text-gray-500">敗北</div>
          </div>
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-2 text-center">
            <div className="text-xl font-bold text-yellow-400">{record.draw}</div>
            <div className="text-[10px] text-gray-500">引き分け</div>
          </div>
        </div>
      </div>

      {showBreakdown && (
        <div className="flex gap-2 mb-3">
          {record.winBySub > 0 && (
            <span className="text-[10px] bg-green-500/10 border border-green-500/20 text-green-400 px-2 py-1 rounded-full">
              一本 {record.winBySub}
            </span>
          )}
          {winByDecision > 0 && (
            <span className="text-[10px] bg-blue-500/10 border border-blue-500/20 text-blue-400 px-2 py-1 rounded-full">
              判定 {winByDecision}
            </span>
          )}
          {lossToSub > 0 && (
            <span className="text-[10px] bg-red-500/10 border border-red-500/20 text-red-400 px-2 py-1 rounded-full">
              一本負 {lossToSub}
            </span>
          )}
        </div>
      )}

      {decoded > 0 && (
        <div className="w-full h-1 bg-gray-700 rounded-full overflow-hidden flex">
          <div className="h-full bg-green-400 transition-all duration-500" style={{ width: `${winPct}%` }} />
          {record.draw > 0 && (
            <div
              className="h-full bg-yellow-400 transition-all duration-500"
              style={{ width: `${decoded > 0 ? Math.round((record.draw / decoded) * 100) : 0}%` }}
            />
          )}
        </div>
      )}
    </div>
  );
}
