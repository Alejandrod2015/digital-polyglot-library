'use client';

import { useRef } from 'react';
import { mexicanShortStories } from '@/data/books/short-stories-mexican';

export default function ReaderPage() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const handlePlay = () => {
    audioRef.current?.play();
  };

  const story = mexicanShortStories.stories[0];

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">{story.title}</h1>

      <p>{story.text}</p>
      <p className="italic">{story.dialogue}</p>

      <audio
        ref={audioRef}
        controls
        className="w-full mt-4"
        src={`${mexicanShortStories.audioFolder}/${story.audio}`}
      />

      <button
        onClick={handlePlay}
        className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded mt-4"
      >
        ▶️ Reproducir Audio
      </button>
    </div>
  );
}
