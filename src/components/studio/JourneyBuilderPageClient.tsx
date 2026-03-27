"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { JourneyVariantPlan } from "@/app/journey/journeyCurriculum";
import JourneyBuilderManager from "@/components/studio/JourneyBuilderManager";

type JourneyBuilderResponse = {
  plans: JourneyVariantPlan[];
};

export default function JourneyBuilderPageClient() {
  const router = useRouter();
  const [plans, setPlans] = useState<JourneyVariantPlan[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setError(null);
      try {
        const res = await fetch("/api/studio/journey-builder", { cache: "no-store" });
        if (res.status === 401) {
          router.push("/sign-in?redirect_url=/studio/journey-builder");
          return;
        }
        if (!res.ok) throw new Error(`Error ${res.status}`);
        const json = (await res.json()) as JourneyBuilderResponse;
        if (!cancelled) setPlans(json.plans);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load Journey builder.");
        }
      }
    }

    void load();
    return () => { cancelled = true; };
  }, [router, retryCount]);

  if (error) {
    return (
      <div style={{ padding: 24, borderRadius: 10, backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)", textAlign: "center" }}>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "#ef4444" }}>
          Failed to load Journey Builder
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

  if (!plans) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="studio-skeleton" style={{ height: 80 }} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div className="studio-skeleton" style={{ height: 260 }} />
          <div className="studio-skeleton" style={{ height: 260 }} />
        </div>
      </div>
    );
  }

  return <JourneyBuilderManager plans={plans} />;
}
