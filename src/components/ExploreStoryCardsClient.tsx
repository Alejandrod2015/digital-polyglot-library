"use client";

import { useEffect, useState } from "react";
import StoryVerticalCard from "@/components/StoryVerticalCard";
import { formatTopic } from "@/lib/displayFormat";

type ExploreStoryCardItem = {
  id: string;
  href: string;
  title: string;
  subtitle: string;
  coverUrl: string;
  language: string;
  region?: string;
  level: string;
  topic?: string;
  audioSrc?: string;
};

type Props = {
  items: ExploreStoryCardItem[];
};

function formatAudioDuration(totalSeconds?: number): string {
  if (!totalSeconds || !Number.isFinite(totalSeconds) || totalSeconds <= 0) return "--:--";
  const rounded = Math.floor(totalSeconds);
  const minutes = Math.floor(rounded / 60);
  const seconds = rounded % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export default function ExploreStoryCardsClient({ items }: Props) {
  const [durations, setDurations] = useState<Record<string, number>>({});

  useEffect(() => {
    if (items.length === 0) return;

    const unresolved = items.filter((item) => {
      return (
        !!item.audioSrc &&
        !(typeof durations[item.id] === "number" && durations[item.id] > 0)
      );
    });
    if (unresolved.length === 0) return;

    let cancelled = false;

    const loadDuration = (item: ExploreStoryCardItem) =>
      new Promise<{ id: string; durationSec?: number }>((resolve) => {
        if (!item.audioSrc) {
          resolve({ id: item.id });
          return;
        }

        const audio = new Audio();
        audio.preload = "metadata";

        const done = (durationSec?: number) => {
          audio.removeAttribute("src");
          audio.load();
          resolve({ id: item.id, durationSec });
        };

        const timeout = window.setTimeout(() => done(undefined), 6000);

        audio.onloadedmetadata = () => {
          window.clearTimeout(timeout);
          const duration =
            Number.isFinite(audio.duration) && audio.duration > 0
              ? Math.round(audio.duration)
              : undefined;
          done(duration);
        };

        audio.onerror = () => {
          window.clearTimeout(timeout);
          done(undefined);
        };

        audio.src = item.audioSrc;
      });

    Promise.all(unresolved.map(loadDuration)).then((resolved) => {
      if (cancelled || resolved.length === 0) return;
      setDurations((prev) => {
        let changed = false;
        const next = { ...prev };
        for (const result of resolved) {
          if (result.durationSec && result.durationSec > 0 && next[result.id] !== result.durationSec) {
            next[result.id] = result.durationSec;
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [items, durations]);

  return (
    <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((story) => (
        <StoryVerticalCard
          key={story.id}
          href={story.href}
          title={story.title}
          subtitle={story.subtitle}
          coverUrl={story.coverUrl}
          level={story.level}
          language={story.language}
          region={story.region}
          metaSecondary={`${formatAudioDuration(durations[story.id])} · ${formatTopic(story.topic)}`}
        />
      ))}
    </div>
  );
}
