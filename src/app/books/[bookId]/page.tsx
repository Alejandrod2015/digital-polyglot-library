'use client';

import { useRef, useState, useEffect } from 'react';
import { useParams, notFound } from 'next/navigation';
import { Play, Pause, RotateCcw, RotateCw } from 'lucide-react';

import { mexicanShortStories } from '@/data/books/short-stories-mexican';
import { spanishShortStories } from '@/data/books/short-stories-spain';
import { argentinianShortStories } from '@/data/books/short-stories-argentina';
import { ssGermany } from '@/data/books/ss-de-germany';

const booksMap: Record<string, typeof mexicanShortStories> = {
  'short-stories-mexican': mexicanShortStories,
  'short-stories-spain': spanishShortStories,
  'short-stories-argentina': argentinianShortStories,
  'ss-de-germany': ssGermany,
};

const stripPunct = (s: string) => s.replace(/[.,!?;:()"'«»¿¡]/g, '');

const highlightWord = (text: string, word: string) => {
  if (!word) return text;
  const regex = new RegExp(`(${word})`, 'i');
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

type NoteStatus = 'idle' | 'loading' | 'ready' | 'none' | 'error';

export default function ReaderPage() {
  const { bookId } = useParams();

  // ✅ Hooks arriba
  const [selectedStoryId, setSelectedStoryId] = useState('1');
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [contextTranslation, setContextTranslation] = useState<string | null>(null);
  const [wordTranslations, setWordTranslations] = useState<string[]>([]);
  const [culturalNote, setCulturalNote] = useState<string | null>(null);
  const [noteStatus, setNoteStatus] = useState<NoteStatus>('idle');
  const [saved, setSaved] = useState(false);

  const [isMobile, setIsMobile] = useState(false);

  // Detectar si es móvil
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // ✅ useEffect audio
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateProgress = () => setProgress(audio.currentTime);
    const setDur = () => setDuration(audio.duration);

    audio.addEventListener('timeupdate', updateProgress);
    audio.addEventListener('loadedmetadata', setDur);

    return () => {
      audio.removeEventListener('timeupdate', updateProgress);
      audio.removeEventListener('loadedmetadata', setDur);
    };
  }, []);

  // Validación del libro después de hooks
  const book = booksMap[bookId as string];
  if (!book) {
    notFound();
    return null;
  }

  const story = book.stories.find((s) => s.id === selectedStoryId)!;

  // --- funciones de audio ---
  const togglePlay = () => {
    const a = audioRef.current;
    if (!a) return;
    if (isPlaying) {
      a.pause();
      setIsPlaying(false);
    } else {
      a.play();
      setIsPlaying(true);
    }
  };

  const changeSpeed = (v: number) => {
    if (audioRef.current) {
      audioRef.current.playbackRate = v;
      setSpeed(v);
    }
  };

  const skip = (sec: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime + sec);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (audioRef.current) {
      audioRef.current.currentTime = Number(e.target.value);
      setProgress(Number(e.target.value));
    }
  };

  const formatTime = (sec: number) => {
    if (!sec || isNaN(sec)) return '0:00';
    const minutes = Math.floor(sec / 60);
    const seconds = Math.floor(sec % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
  };

  // --- funciones de vocab ---
  const buildSnippet = (paragraphText: string, word: string) => {
    const words = paragraphText.split(/\s+/);
    const idx = words.findIndex((w) => stripPunct(w).toLowerCase().includes(word));
    if (idx === -1) return word;
    const start = Math.max(0, idx - 3);
    const end = Math.min(words.length, idx + 5);
    return words.slice(start, end).join(' ');
  };

  const processWord = async (raw: string, paragraphText: string) => {
    const word = stripPunct(raw).toLowerCase();
    if (!word) return;

    setSelectedWord(word);
    setSaved(false);
    setContextTranslation(null);
    setWordTranslations([]);
    setCulturalNote(null);
    setNoteStatus('loading');

    const snippet = buildSnippet(paragraphText, word);

    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word, snippet }),
      });

      if (res.ok) {
        const data = await res.json();
        setContextTranslation(data.contextTranslation || '(no context translation)');
        setWordTranslations(data.wordTranslations || []);
      } else {
        setContextTranslation('(translation service unavailable)');
        setWordTranslations([]);
      }
    } catch {
      setContextTranslation('(translation service unavailable)');
      setWordTranslations([]);
    }

    fetch('/api/cultural-note', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ word }),
    })
      .then(async (noteRes) => {
        if (!noteRes.ok) throw new Error('cultural-note error');
        const noteData = await noteRes.json();
        const rawNote = (noteData?.culturalNote || '').trim();

        if (rawNote) {
          setCulturalNote(rawNote);
          setNoteStatus('ready');
        } else {
          setCulturalNote(null);
          setNoteStatus('none');
        }
      })
      .catch(() => {
        setCulturalNote(null);
        setNoteStatus('error');
      });
  };

  const handleParagraphSelection = async (e: React.PointerEvent<HTMLParagraphElement>) => {
    const sel = window.getSelection();
    const raw = sel?.toString().trim();
    if (!raw) return;
    await processWord(raw, e.currentTarget.textContent || raw);
  };

  const handleWordTap = (word: string, paragraphText: string) => {
    processWord(word, paragraphText);
  };

  const renderSelectableText = (text: string) => {
    if (isMobile) {
      return text.split(/\s+/).map((word, i, arr) => {
        const clean = stripPunct(word).toLowerCase();
        const isSelected = selectedWord === clean;
        return (
          <span
            key={i}
            onClick={() => handleWordTap(word, arr.join(' '))}
            className={`cursor-pointer px-1 rounded ${
              isSelected ? 'bg-yellow-400 text-black' : 'hover:bg-yellow-300 hover:text-black'
            }`}
          >
            {word}{' '}
          </span>
        );
      });
    }
    // Desktop: texto normal con highlight
    return selectedWord ? highlightWord(text, selectedWord) : text;
  };

  const saveToFavorites = () => {
    if (!selectedWord) return;
    const favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
    favorites.push({ word: selectedWord });
    localStorage.setItem('favorites', JSON.stringify(favorites));
    setSaved(true);
  };

  // --- JSX ---
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
            className={`w-full text-left px-4 py-2 rounded ${
              s.id === selectedStoryId ? 'bg-blue-700 text-white' : 'bg-gray-800 hover:bg-gray-700'
            }`}
          >
            {s.title}
          </button>
        ))}
      </div>

      {/* Contenido */}
      <>
        <h2 className="text-2xl font-bold mt-6">{story.title}</h2>

        <p
          className="mt-2 select-text"
          onPointerUp={!isMobile ? handleParagraphSelection : undefined}
        >
          {renderSelectableText(story.text)}
        </p>
        <p
          className="italic mt-2 select-text"
          onPointerUp={!isMobile ? handleParagraphSelection : undefined}
        >
          {renderSelectableText(story.dialogue)}
        </p>

        {/* Panel vocab */}
        {(selectedWord || contextTranslation || noteStatus !== 'idle') && (
          <div className="mt-6 p-4 bg-[#1b263b] rounded-xl shadow-md space-y-2">
            {selectedWord && (
              <p className="font-bold">
                Selected word: <span className="text-yellow-400">{selectedWord}</span>
              </p>
            )}

            {wordTranslations.length > 0 && (
              <p className="text-blue-400">Word translations → {wordTranslations.join(', ')}</p>
            )}

            {contextTranslation && (
              <p className={contextTranslation.startsWith('Please') ? 'text-yellow-400' : 'text-green-400'}>
                {contextTranslation.startsWith('Please') ? contextTranslation : <>Context → {contextTranslation}</>}
              </p>
            )}

            <div className="mt-3">
              {noteStatus === 'loading' && <div className="h-5 w-3/4 rounded bg-white/10 animate-pulse" />}

              {noteStatus === 'ready' && culturalNote && (
                <p className="text-purple-300">Cultural note → {culturalNote}</p>
              )}

              {noteStatus === 'none' && (
                <span className="inline-flex items-center gap-2 text-xs text-gray-400 bg-white/5 px-2 py-1 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                  No cultural note
                </span>
              )}

              {noteStatus === 'error' && (
                <span className="inline-flex items-center gap-2 text-xs text-red-300 bg-red-500/10 px-2 py-1 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-300" />
                  Cultural note unavailable
                </span>
              )}
            </div>

            {selectedWord && !contextTranslation?.startsWith('Please') && (
              <button
                onClick={saveToFavorites}
                className={`px-4 py-2 rounded mt-2 transition-colors ${
                  saved ? 'bg-green-600 text-white' : 'bg-[#e8b632] text-black hover:bg-yellow-500'
                }`}
              >
                {saved ? 'Saved!' : 'Add to Favorites'}
              </button>
            )}
          </div>
        )}

        {/* Audio Player */}
        <div className="mt-6 bg-black/80 p-4 rounded-xl shadow-2xl backdrop-blur">
          <audio ref={audioRef} src={`${book.audioFolder}/${story.audio}`} />

          <div className="flex items-center gap-2 text-sm text-gray-300">
            <span>{formatTime(progress)}</span>
            <input
              type="range"
              min={0}
              max={duration || 0}
              value={progress}
              onChange={handleSeek}
              className="w-full accent-blue-500"
            />
            <span>{formatTime(duration)}</span>
          </div>

          <div className="flex justify-center items-center gap-6 mt-4">
            <button onClick={() => skip(-15)} className="relative p-2 rounded hover:bg-gray-800">
              <RotateCcw className="w-10 h-10" />
              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold">15</span>
            </button>

            <button
              onClick={togglePlay}
              className="p-4 rounded-full bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
            </button>

            <button onClick={() => skip(15)} className="relative p-2 rounded hover:bg-gray-800">
              <RotateCw className="w-10 h-10" />
              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold">15</span>
            </button>
          </div>

          <div className="flex justify-center mt-3">
            <select
              value={speed}
              onChange={(e) => changeSpeed(Number(e.target.value))}
              className="bg-gray-800 px-2 py-1 rounded"
            >
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
