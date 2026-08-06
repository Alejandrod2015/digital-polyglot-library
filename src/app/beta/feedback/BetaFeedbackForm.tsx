"use client";

// The form behind every feedback link in the beta emails.
//
// Two shapes, one component. A plain report is a single textarea, because the
// email promised that one sentence is a complete answer and a five-field form
// would make that a lie. A survey adds a nought-to-ten scale, because the
// review branch at the end of the program needs a number to split on.

import { useState } from "react";

type Props = { token: string; initialKind: string };

const KINDS = [
  { value: "bug", label: "Something broke" },
  { value: "confusing", label: "Something confused me" },
  { value: "idea", label: "I have an idea" },
  { value: "praise", label: "Something worked well" },
];

const SURVEY_KINDS = new Set(["mid_survey", "final_survey"]);

const SURVEY_PROMPTS: Record<string, { title: string; lead: string; placeholder: string }> = {
  mid_survey: {
    title: "Three questions, ninety seconds",
    lead: "You are halfway through the beta. What you say here sets what gets built in the second half.",
    placeholder:
      "What would you fix before anyone else sees it?\n\nWhat would you be sad to lose?",
  },
  final_survey: {
    title: "Last ask, and the biggest one",
    // Store-neutral on purpose: this form is opened by Android testers too,
    // and naming the App Store to someone testing on a Pixel reads as a
    // program that does not know who it is talking to.
    lead: "The app ships shortly. This is the last thing that can still change it.",
    placeholder:
      "What finally made it click, if it did?\n\nWhat nearly made you delete it?\n\nWhat is still missing?",
  },
};

export default function BetaFeedbackForm({ token, initialKind }: Props) {
  const isSurvey = SURVEY_KINDS.has(initialKind);
  const [kind, setKind] = useState(isSurvey ? initialKind : initialKind || "bug");
  const [message, setMessage] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const survey = SURVEY_KINDS.has(kind);
  const prompt = SURVEY_PROMPTS[kind];

  if (!token) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center">
        <h1 className="text-2xl font-extrabold">This link is incomplete</h1>
        <p className="mt-3 text-sm font-bold text-white/60">
          Open it straight from the email rather than retyping it, or just reply to the email instead.
        </p>
      </div>
    );
  }

  if (state === "sent") {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center">
        <h1 className="text-2xl font-extrabold">Got it. Thank you.</h1>
        <p className="mt-3 text-sm font-bold text-white/60">
          It goes straight to the person building the app. If it turns into a fix, you will get an email
          naming it when that build ships.
        </p>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (message.trim().length < 3) {
      setError("Write at least a few words.");
      return;
    }
    setState("sending");
    setError(null);
    try {
      const res = await fetch("/api/beta/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, kind, message, rating }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setState("sent");
    } catch (err) {
      setState("error");
      setError(String(err instanceof Error ? err.message : err));
    }
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 sm:p-8">
      <h1 className="text-2xl font-extrabold leading-tight sm:text-3xl" style={{ letterSpacing: "-0.03em" }}>
        {survey ? prompt?.title ?? "Your answers" : "What happened?"}
      </h1>
      <p className="mt-3 text-sm font-bold leading-relaxed text-white/60">
        {survey
          ? prompt?.lead ?? "Tell me what you think."
          : "One sentence is a complete answer. No form to fill in, no screenshots needed."}
      </p>

      {survey && (
        <div className="mt-6">
          <div className="text-xs font-extrabold uppercase tracking-widest text-white/45">
            How likely are you to recommend it?
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {Array.from({ length: 11 }, (_, n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                aria-pressed={rating === n}
                className={`h-10 w-10 rounded-lg text-sm font-extrabold transition ${
                  rating === n
                    ? "bg-[#fcd34d] text-[#2a1a02]"
                    : "bg-white/[0.06] text-white/70 hover:bg-white/[0.12]"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          <div className="mt-2 flex justify-between text-[11px] font-bold text-white/40">
            <span>Not at all</span>
            <span>Absolutely</span>
          </div>
        </div>
      )}

      {!survey && (
        <div className="mt-6 flex flex-wrap gap-2">
          {KINDS.map((k) => (
            <button
              key={k.value}
              type="button"
              onClick={() => setKind(k.value)}
              aria-pressed={kind === k.value}
              className={`rounded-full px-4 py-2 text-xs font-extrabold transition ${
                kind === k.value
                  ? "bg-[#fcd34d] text-[#2a1a02]"
                  : "bg-white/[0.06] text-white/70 hover:bg-white/[0.12]"
              }`}
            >
              {k.label}
            </button>
          ))}
        </div>
      )}

      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={survey ? 8 : 5}
        placeholder={survey ? prompt?.placeholder : "The audio started about a second late every time I opened a story."}
        className="mt-5 w-full rounded-xl border border-white/10 bg-[#051834] p-4 text-sm font-semibold leading-relaxed text-white outline-none placeholder:text-white/30 focus:border-[#fcd34d]/60"
      />

      {error && <p className="mt-3 text-sm font-bold text-[#f87171]">{error}</p>}

      <button
        type="submit"
        disabled={state === "sending"}
        className="mt-5 w-full rounded-2xl bg-[#fcd34d] px-6 py-4 text-base font-black text-[#2a1a02] transition hover:brightness-105 disabled:opacity-60"
      >
        {state === "sending" ? "Sending..." : survey ? "Send my answers" : "Send it"}
      </button>
    </form>
  );
}
