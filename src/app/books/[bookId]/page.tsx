'use client';

import { useRef, useState } from 'react';
import { useParams, notFound } from 'next/navigation';

import { mexicanShortStories } from '@/data/books/short-stories-mexican';
import { spanishShortStories } from '@/data/books/short-stories-spain';
import { argentinianShortStories } from '@/data/books/short-stories-argentina';

const booksMap: Record<string, typeof mexicanShortStories> = {
  'short-stories-mexican': mexicanShortStories,
  'short-stories-spain': spanishShortStories,
  'short-stories-argentina': argentinianShortStories,
};

// Limpia puntuación para detectar la palabra
const stripPunct = (s: string) => s.replace(/[.,!?;:()"'«»¿¡]/g, '');

// Resalta una palabra en un texto (en español)
const highlightWord = (text: string, word: string) => {
  if (!word) return text;
  const regex = new RegExp(`(${word})`, 'i'); // case insensitive
  const parts = text.split(regex);
  return parts.map((part, i) =>
    regex.test(part) ? (
      <span key={i} className="bg-yellow-400 text-black px-1 rounded">
        {part}
      </span>
    ) : (
      part
    )
  );
};

export default function ReaderPage() {
  const { bookId } = useParams();
  const book = booksMap[bookId as string];
  if (!book) { notFound(); return null; }

  const [selectedStoryId, setSelectedStoryId] = useState('1');
  const story = book.stories.find((s) => s.id === selectedStoryId)!;

  // Audio
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  // Vocab
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [contextTranslation, setContextTranslation] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const togglePlay = () => {
    const a = audioRef.current; if (!a) return;
    if (isPlaying) { a.pause(); setIsPlaying(false); } else { a.play(); setIsPlaying(true); }
  };
  const changeSpeed = (v: number) => { if (audioRef.current) { audioRef.current.playbackRate = v; setSpeed(v); } };
  const skip = (sec: number) => { if (audioRef.current) { audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime + sec); } };

  // Snippet de 6–8 palabras alrededor
  const buildSnippet = (paragraphText: string, word: string) => {
    const words = paragraphText.split(/\s+/);
    const idx = words.findIndex((w) => stripPunct(w).toLowerCase().includes(word));
    if (idx === -1) return word;
    const start = Math.max(0, idx - 3);
    const end = Math.min(words.length, idx + 5);
    return words.slice(start, end).join(' ');
  };

  // SOLO dispara en los <p> de la historia
  const handleParagraphSelection = async (e: React.MouseEvent<HTMLParagraphElement>) => {
    const sel = window.getSelection();
    const raw = sel?.toString().trim();
    if (!raw) return;

    const wordsSelected = raw.split(/\s+/).length;
    if (wordsSelected > 5) {
      setSelectedWord(null);
      setSaved(false);
      setContextTranslation("⚠️ Please select only a word or a short phrase (max 5 words).");
      return;
    }

    const word = stripPunct(raw).toLowerCase();
    if (!word) return;

    setSelectedWord(word);
    setSaved(false);
    setContextTranslation(null);

    // Texto del párrafo = solo contenido de la historia
    const paragraphText = e.currentTarget.textContent || word;
    const snippet = buildSnippet(paragraphText, word);

    try {
      // Solo pedimos traducción del snippet
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texts: [snippet] }),
      });

      if (!res.ok) throw new Error('deepl error');
      const data = await res.json();
      const outs: string[] = (data?.translations || [])
        .map((t: any) => t?.text)
        .filter(Boolean);

      setContextTranslation(outs[0] || '(no context translation)');
    } catch (err) {
      console.error(err);
      setContextTranslation('(translation service unavailable)');
    }
  };

  const saveToFavorites = () => {
    if (!selectedWord) return;
    const favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
    favorites.push({ word: selectedWord });
    localStorage.setItem('favorites', JSON.stringify(favorites));
    setSaved(true);
  };

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-6 text-white">
      <h1 className="text-3xl font-bold text-center">{book.title}</h1>

      {/* Menú historias */}
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Select a story:</h2>
        {book.stories.map((s) => (
          <button
            key={s.id}
            onClick={() => setSelectedStoryId(s.id)}
            className={`w-full text-left px-4 py-2 rounded ${s.id === selectedStoryId ? 'bg-blue-700 text-white' : 'bg-gray-800 hover:bg-gray-700'}`}
          >
            {s.title}
          </button>
        ))}
      </div>

      {/* Contenido */}
      <>
        <h2 className="text-2xl font-bold mt-6">{story.title}</h2>

        <p className="mt-2 select-text" onMouseUp={handleParagraphSelection}>
          {selectedWord ? highlightWord(story.text, selectedWord) : story.text}
        </p>
        <p className="italic mt-2 select-text" onMouseUp={handleParagraphSelection}>
          {selectedWord ? highlightWord(story.dialogue, selectedWord) : story.dialogue}
        </p>

        {/* Panel vocab */}
        {(selectedWord || contextTranslation) && (
          <div className="mt-6 p-4 bg-gray-900 rounded-xl space-y-2">
            {selectedWord && (
              <p className="font-bold">
                Selected word: <span className="text-yellow-400">{selectedWord}</span>
              </p>
            )}

            {contextTranslation && (
              <p className={contextTranslation.startsWith("⚠️") ? "text-yellow-400" : "text-green-400"}>
                {contextTranslation.startsWith("⚠️") ? contextTranslation : <>Context → {contextTranslation}</>}
              </p>
            )}

            {selectedWord && !contextTranslation?.startsWith("⚠️") && (
              <button
                onClick={saveToFavorites}
                className={`px-4 py-2 rounded mt-2 transition-colors ${saved ? 'bg-green-600 text-white' : 'bg-yellow-600 text-black hover:bg-yellow-500'}`}
              >
                ⭐ {saved ? 'Saved!' : 'Add to Favorites'}
              </button>
            )}
          </div>
        )}

        {/* Audio */}
        <div className="mt-6 space-y-4">
          <audio ref={audioRef} src={`${book.audioFolder}/${story.audio}`} />
          <div className="flex items-center gap-4">
            <button onClick={() => skip(-10)} className="bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded">⏪ -10s</button>
            <button onClick={togglePlay} className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded">
              {isPlaying ? '⏸ Pause' : '▶️ Play'}
            </button>
            <button onClick={() => skip(10)} className="bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded">+10s ⏩</button>
            <select value={speed} onChange={(e) => changeSpeed(Number(e.target.value))} className="bg-gray-800 px-2 py-1 rounded">
              <option value={0.5}>0.5x</option>
              <option value={0.75}>0.75x</option>
              <option value={1}>1x</option>
              <option value={1.25}>1.25x</option>
              <option value={1.5}>1.5x</option>
            </select>
          </div>
        </div>
      </>
    </div>
  );
}
