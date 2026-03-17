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
};

// 試合ノートのデコード（TrainingLogと同じロジック）
const COMP_PREFIX = "__comp__";

function decodeResult(notes: string): string | null {
  if (!notes || !notes.startsWith(COMP_PREFIX)) return null;
  const nl = notes.indexOf("\n");
  const jsonStr = nl === -1 ? notes.slice(COMP_PREFIX.length) : notes.slice(COMP_PREFIX.length, nl);
  try {
    const comp = JSON.parse(jsonStr) as { result: string };
    return comp.result;
  } catch {
    return null;
  }
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
        const rec: CompRecord = { win: 0, loss: 0, draw: 0, total: 0 };
        data.forEach((l: { notes: string }) => {
          const result = decodeResult(l.notes);
          if (result === "win") { rec.win++; rec.total++; }
          else if (result === "loss") { rec.loss++; rec.total++; }
          else if (result === "draw") { rec.draw++; rec.total++; }
          else { rec.total++; }
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

  return (
    <div className="bg-[#16213e] rounded-xl p-4 border border-gray-700 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-gray-300">🏆 試合戦績</h4>
        <span className="text-[10px] text-gray-500">計{record.total}試合</span>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-green-400">{record.win}</div>
          <div className="text-[10px] text-gray-500 mt-0.5">勝利</div>
        </div>
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-red-400">{record.loss}</div>
          <div className="text-[10px] text-gray-500 mt-0.5">敗北</div>
        </div>
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-yellow-400">{record.draw}</div>
          <div className="text-[10px] text-gray-500 mt-0.5">引き分け</div>
        </div>
      </div>

      {decoded > 0 && (
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-[10px] text-gray-500">勝率</span>
            <span className="text-[10px] font-semibold text-green-400">{winPct}%</span>
          </div>
          <div className="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-400 rounded-full transition-all duration-500"
              style={{ width: winPct + "%" }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
