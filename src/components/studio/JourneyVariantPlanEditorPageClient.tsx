"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { JourneyVariantPlan } from "@/app/journey/journeyCurriculum";
import JourneyVariantPlanEditor from "@/components/studio/JourneyVariantPlanEditor";

type Props = {
  language: string;
  variantId: string;
  highlightedLevel?: string | null;
  highlightedTopic?: string | null;
  highlightedSlot?: string | null;
  highlightedFocus?: string | null;
};

type JourneyVariantResponse = {
  plan: JourneyVariantPlan;
};

export default function JourneyVariantPlanEditorPageClient({
  language,
  variantId,
  highlightedLevel,
  highlightedTopic,
  highlightedSlot,
  highlightedFocus,
}: Props) {
  const router = useRouter();
  const [plan, setPlan] = useState<JourneyVariantPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setError(null);
      try {
        const res = await fetch(
          `/api/studio/journey-builder/${encodeURIComponent(language)}/${encodeURIComponent(variantId)}`,
          { cache: "no-store" }
        );
        if (res.status === 401) {
          router.push(
            `/sign-in?redirect_url=${encodeURIComponent(`/studio/journey-builder/${language}/${variantId}`)}`
          );
          return;
        }
        if (res.status === 404) {
          router.push("/studio/journey-builder");
          return;
        }
        if (!res.ok) throw new Error(`Error ${res.status}`);
        const json = (await res.json()) as JourneyVariantResponse;
        if (!cancelled) setPlan(json.plan);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load Journey plan.");
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [language, router, variantId, retryCount]);

  if (error) {
    return (
      <div style={{ padding: 24, borderRadius: 10, backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)", textAlign: "center" }}>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "#ef4444" }}>
          Failed to load Journey Plan
        </p>
        <p style={{ margin: "8px 0 16px", fontSize: 13, color: "var(--muted)" }}>{error}</p>
        <button
          onClick={() => setRetryCount((c) => c + 1)}
          className="studio-btn-primary"
          style={{ height: 36, borderRadius: 8, border: "none", backgroundColor: "var(--primary)", color: "#fff", padding: "0 20px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
        >
          Try again
        </button>
      </div>
    );
  }

  if (!plan) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="studio-skeleton" style={{ height: 80 }} />
        <div className="studio-skeleton" style={{ height: 200 }} />
        <div className="studio-skeleton" style={{ height: 200 }} />
      </div>
    );
  }

  return (
    <JourneyVariantPlanEditor
      plan={plan}
      highlightedLevel={highlightedLevel ?? null}
      highlightedTopic={highlightedTopic ?? null}
      highlightedSlot={highlightedSlot ?? null}
      highlightedFocus={highlightedFocus ?? null}
    />
  );
}
