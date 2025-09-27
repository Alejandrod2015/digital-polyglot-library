'use client';

import { useRef, useState } from 'react';
import { useParams, notFound } from 'next/navigation';

import { mexicanShortStories } from '@/data/books/short-stories-mexican';
// Aquí importarás más libros:
import { spanishShortStories } from '@/data/books/short-stories-spain'; // si tienes otro libro

// Mapa con todos los libros disponibles
const booksMap: Record<string, typeof mexicanShortStories> = {
  'short-stories-mexican': mexicanShortStories,
  'short-stories-spain': spanishShortStories, // añade más libros aquí
};

export default function ReaderPage() {
  const params = useParams();
  const { bookId } = params;

  const book = booksMap[bookId as string];
  if (!book) return notFound();

  const [selectedStoryId, setSelectedStoryId] = useState('1');
  const story = book.stories.find((s) => s.id === selectedStoryId);
  const audioRef = useRef<HTMLAudioElement>(null);

  const handlePlay = () => {
    audioRef.current?.play();
  };

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-6 text-white">
      <h1 className="text-3xl font-bold text-center">{book.title}</h1>

      {/* Menú de historias */}
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Selecciona una historia:</h2>
        {book.stories.map((s) => (
          <button
            key={s.id}
            onClick={() => setSelectedStoryId(s.id)}
            className={`w-full text-left px-4 py-2 rounded ${
              s.id === selectedStoryId
                ? 'bg-blue-700 text-white'
                : 'bg-gray-800 hover:bg-gray-700'
            }`}
          >
            {s.title}
          </button>
        ))}
      </div>

      {/* Contenido de la historia */}
      {story && (
        <>
          <h2 className="text-2xl font-bold mt-6">{story.title}</h2>
          <p className="mt-2">{story.text}</p>
          <p className="italic mt-2">{story.dialogue}</p>

          <audio
            ref={audioRef}
            controls
            className="w-full mt-4"
            src={`${book.audioFolder}/${story.audio}`}
          />

          <button
            onClick={handlePlay}
            className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded mt-4"
          >
            ▶️ Reproducir Audio
          </button>
        </>
      )}
    </div>
  );
}
