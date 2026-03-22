"use client";
import { useState } from "react";

type FormState = "idle" | "loading" | "success" | "error";

export default function GymWaitlistForm() {
  const [email, setEmail] = useState("");
  const [gymName, setGymName] = useState("");
  const [state, setState] = useState<FormState>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setState("loading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/gym-waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), gymName: gymName.trim() }),
      });
      if (res.ok) {
        setState("success");
      } else {
        const data = await res.json().catch(() => ({}));
        setErrorMsg(data.error ?? "Something went wrong. Please try again.");
        setState("error");
      }
    } catch {
      setErrorMsg("Network error. Please check your connection.");
      setState("error");
    }
  }

  if (state === "success") {
    return (
      <div className="bg-zinc-900 border border-blue-500/40 rounded-2xl p-8 text-center">
        <div className="text-4xl mb-4">🎉</div>
        <h3 className="text-xl font-bold text-white mb-2">You're on the list!</h3>
        <p className="text-gray-400 text-sm">
          We'll reach out when gym features are ready. In the meantime, encourage
          your students to download BJJ App — the more who join, the sooner we reach out.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm text-gray-400 mb-1.5" htmlFor="gym-email">
          Your email *
        </label>
        <input
          id="gym-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="coach@yourgym.com"
          className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-[#7c3aed] text-sm"
        />
      </div>
      <div>
        <label className="block text-sm text-gray-400 mb-1.5" htmlFor="gym-name">
          Gym / Academy name
        </label>
        <input
          id="gym-name"
          type="text"
          value={gymName}
          onChange={(e) => setGymName(e.target.value)}
          placeholder="Triangle BJJ Academy"
          className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-[#7c3aed] text-sm"
        />
      </div>
      {state === "error" && (
        <p className="text-red-400 text-xs">{errorMsg}</p>
      )}
      <button
        type="submit"
        disabled={state === "loading" || !email.trim()}
        className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-full transition-all text-sm flex items-center justify-center gap-2"
      >
        {state === "loading" ? (
          <>
            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Joining...
          </>
        ) : (
          "Join the Waitlist →"
        )}
      </button>
      <p className="text-gray-600 text-xs text-center">No spam. We'll email you when gym features launch.</p>
    </form>
  );
}
