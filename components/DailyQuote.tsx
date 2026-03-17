"use client";

// BJJ名言コンポーネント（日替わり）
const QUOTES = [
  { text: "There is no losing in jiu-jitsu. You either win or you learn.", author: "Carlos Gracie" },
  { text: "A black belt is a white belt who never quit.", author: "BJJ saying" },
  { text: "Train hard, tap often, and never stop learning.", author: "Rickson Gracie" },
  { text: "Jiu-jitsu is the art of controlling your own fear.", author: "Saulo Ribeiro" },
  { text: "Roll with everyone. You learn from everyone.", author: "BJJ saying" },
  { text: "Position before submission.", author: "Royce Gracie" },
  { text: "The mat doesn't care who you are. It only cares what you do.", author: "BJJ saying" },
  { text: "Be water, my friend.", author: "Bruce Lee" },
  { text: "Smooth is fast. Fast is smooth.", author: "Military saying" },
  { text: "The best time to start BJJ was yesterday. The second best time is today.", author: "BJJ saying" },
  { text: "Survive first, then escape. Escape, then control. Control, then submit.", author: "Renzo Gracie" },
  { text: "技は力を制す。", author: "柔術の精神" },
  { text: "毎日の積み重ねが、いつかの自分を作る。", author: "BJJ saying" },
  { text: "帯の色より、今日の稽古を大切に。", author: "BJJ saying" },
];

export default function DailyQuote() {
  const now = new Date();
  const dayOfYear = Math.floor(
    (now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000
  );
  const quote = QUOTES[dayOfYear % QUOTES.length];

  return (
    <div className="bg-[#16213e]/60 rounded-xl px-4 py-3 border border-gray-700/50 mb-4">
      <div className="flex items-start gap-2">
        <span className="text-sm text-gray-600 mt-0.5 flex-shrink-0">❝</span>
        <div>
          <p className="text-gray-300 text-xs leading-relaxed italic">{quote.text}</p>
          <p className="text-gray-600 text-[10px] mt-1">— {quote.author}</p>
        </div>
      </div>
    </div>
  );
}
