"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import JourneyStoriesManager from "@/components/studio/JourneyStoriesManager";
import type { JourneyCoverageGap, StudioJourneyStory } from "@/lib/studioJourneyStories";

type JourneyStoriesResponse = {
  stories: StudioJourneyStory[];
  gaps: JourneyCoverageGap[];
};

export default function JourneyStoriesPageClient() {
  const router = useRouter();
  const [data, setData] = useState<JourneyStoriesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setError(null);
      try {
        const res = await fetch("/api/studio/journey-stories", { cache: "no-store" });
        if (res.status === 401) {
          router.push("/sign-in?redirect_url=/studio/journey-stories");
          return;
        }
        if (!res.ok) throw new Error(`Error ${res.status}`);
        const json = (await res.json()) as JourneyStoriesResponse;
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "No se pudieron cargar las historias del Journey.");
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
          No se pudieron cargar las historias del Journey
        </p>
        <p style={{ margin: "8px 0 16px", fontSize: 13, color: "var(--muted)" }}>{error}</p>
        <button
          onClick={() => setRetryCount((c) => c + 1)}
          className="studio-btn-primary"
          style={{ height: 36, borderRadius: 8, border: "none", backgroundColor: "var(--primary)", color: "#fff", padding: "0 20px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
        >
          Reintentar
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="studio-skeleton" style={{ height: 60 }} />
        <div className="studio-skeleton" style={{ height: 90 }} />
        <div className="studio-skeleton" style={{ height: 48 }} />
        <div className="studio-skeleton" style={{ height: 300 }} />
      </div>
    );
  }

  return (
    <JourneyStoriesManager
      initialStories={data.stories}
      initialGaps={data.gaps}
    />
  );
}
