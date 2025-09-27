'use client';

import { useRef, useState } from 'react';
import { mexicanShortStories } from '@/data/books/short-stories-mexican';

export default function ReaderPage() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [selectedStoryId, setSelectedStoryId] = useState('1');

  const story = mexicanShortStories.stories.find((s) => s.id === selectedStoryId);

  const handlePlay = () => {
    audioRef.current?.play();
  };

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-6 text-white">
      <h1 className="text-3xl font-bold text-center mb-6">
        {mexicanShortStories.title}
      </h1>

      {/* Menú de historias */}
      <div className="space-y-2">
        {mexicanShortStories.stories.map((s) => (
          <button
            key={s.id}
            onClick={() => setSelectedStoryId(s.id)}
            className={`w-full text-left px-4 py-2 rounded ${
              s.id === selectedStoryId ? 'bg-blue-700 text-white' : 'bg-gray-800 hover:bg-gray-700'
            }`}
          >
            {s.title}
          </button>
        ))}
      </div>

      {/* Contenido de la historia */}
      {story && (
        <div className="pt-6 border-t border-gray-700 space-y-4">
          <h2 className="text-2xl font-semibold">{story.title}</h2>
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
            className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded mt-2"
          >
            Reproducir Audio
          </button>
        </div>
      )}
    </div>
  );
}
