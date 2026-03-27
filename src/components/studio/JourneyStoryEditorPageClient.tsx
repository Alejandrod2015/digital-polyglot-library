"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import JourneyStoryEditor from "@/components/studio/JourneyStoryEditor";
import type { StudioJourneyStory } from "@/lib/studioJourneyStories";

type Props = {
  storyId: string;
};

type JourneyStoryResponse = {
  story: StudioJourneyStory;
};

export default function JourneyStoryEditorPageClient({ storyId }: Props) {
  const router = useRouter();
  const [story, setStory] = useState<StudioJourneyStory | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setError(null);
      try {
        const res = await fetch(`/api/studio/journey-stories/${encodeURIComponent(storyId)}`, {
          cache: "no-store",
        });
        if (res.status === 401) {
          router.push(`/sign-in?redirect_url=${encodeURIComponent(`/studio/journey-stories/${storyId}`)}`);
          return;
        }
        if (res.status === 404) {
          router.push("/studio/journey-stories");
          return;
        }
        if (!res.ok) throw new Error(`Error ${res.status}`);
        const json = (await res.json()) as JourneyStoryResponse;
        if (!cancelled) setStory(json.story);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "No se pudo cargar esta historia.");
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [router, storyId, retryCount]);

  if (error) {
    return (
      <div style={{ padding: 24, borderRadius: 10, backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)", textAlign: "center" }}>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "#ef4444" }}>
          No se pudo cargar esta historia
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

  if (!story) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="studio-skeleton" style={{ height: 64 }} />
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 16 }}>
          <div className="studio-skeleton" style={{ height: 460 }} />
          <div className="studio-skeleton" style={{ height: 360 }} />
        </div>
      </div>
    );
  }

  return <JourneyStoryEditor story={story} />;
}
