"use client";

import StoryVerticalCard from "@/components/StoryVerticalCard";
import { formatTopic } from "@domain/displayFormat";

type ExploreStoryCardItem = {
  id: string;
  href: string;
  title: string;
  subtitle: string;
  coverUrl: string;
  language: string;
  variant?: string;
  region?: string;
  level: string;
  topic?: string;
  audioSrc?: string;
};

type Props = {
  items: ExploreStoryCardItem[];
};

export default function ExploreStoryCardsClient({ items }: Props) {
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
          variant={story.variant}
          region={story.region}
          metaSecondary={formatTopic(story.topic)}
        />
      ))}
    </div>
  );
}
