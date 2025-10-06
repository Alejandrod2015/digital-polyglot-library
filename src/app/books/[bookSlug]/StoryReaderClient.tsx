"use client";

import { Book, Story } from "@/types/books";
import { useEffect } from "react";
import Player from "@/components/Player";

export default function StoryReaderClient({ book, story }: { book: Book; story: Story }) {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [story.slug]);

  return (
    <div className="text-gray-100">
      {/* 🔹 Solo texto de la historia */}
      <div
        className="space-y-4 text-lg leading-relaxed text-gray-200"
        dangerouslySetInnerHTML={{ __html: story.text }}
      />

      {/* 🔹 Player fijo */}
      <div className="fixed bottom-0 left-0 w-full z-50">
        <Player
          src={story.audio || `/audio/${book.slug}/${story.slug}.mp3`}
          bookSlug={book.slug}
          storySlug={story.slug}
        />
      </div>
    </div>
  );
}
