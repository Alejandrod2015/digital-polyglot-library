'use client';

import { useRef, useState } from 'react';
import { mexicanShortStories } from '@/data/books/short-stories-mexican';

export default function ReaderPage() {
  const audioRef = useRef<HTMLAudioElement>(null);

  // Estado para historia activa
  const [currentIndex, setCurrentIndex] = useState(0);
  const story = mexicanShortStories.stories[currentIndex];

  const handlePlay = () => {
    audioRef.current?.play();
  };

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-8">
      <h1 className="text-3xl font-bold">{mexicanShortStories.title}</h1>

      {/* Menú de historias */}
      <div className="bg-gray-800 p-4 rounded-md">
        <h2 className="text-lg font-semibold mb-2">Selecciona una historia:</h2>
        <ul className="space-y-2">
          {mexicanShortStories.stories.map((s, i) => (
            <li key={s.id}>
              <button
                onClick={() => setCurrentIndex(i)}
                className={`text-left w-full px-3 py-2 rounded hover:bg-blue-700 ${
                  i === currentIndex ? 'bg-blue-600 text-white font-semibold' : 'bg-gray-700 text-gray-200'
                }`}
              >
                {s.title}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Contenido de la historia */}
      <div>
        <h2 className="text-2xl font-bold mb-2">{story.title}</h2>
        <p className="mb-4">{story.text}</p>
        <p className="italic mb-4">{story.dialogue}</p>

        <audio
          ref={audioRef}
          controls
          className="w-full"
          src={`${mexicanShortStories.audioFolder}/${story.audio}`}
        />

        <button
          onClick={handlePlay}
          className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded mt-4"
        >
          ▶️ Reproducir Audio
        </button>
      </div>
    </div>
  );
}
