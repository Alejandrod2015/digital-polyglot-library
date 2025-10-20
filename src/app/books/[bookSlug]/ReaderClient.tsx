'use client';

import { useState, useEffect } from 'react';
import type { Book, Story } from '@/types/books';
import Player from '@/components/Player';
import StoryContent from '@/components/StoryContent';
import VocabPanel from '@/components/VocabPanel';
import { getStoriesReadCount, getStoriesLimit, addStoryToHistory } from '@/utils/readingLimits';


type UserPlan = 'free' | 'basic' | 'premium' | 'polyglot' | 'owner';

export default function ReaderClient({ book, userPlan = 'free' }: { book: Book; userPlan?: UserPlan }) {
  console.log('🟢 User plan:', userPlan);
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
  const [selectedStoryId, setSelectedStoryId] = useState<string>(book.stories[0]?.id || '');
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [/* contextTranslation */, setContextTranslation] = useState<string | null>(null);
  const [/* wordTranslations */, setWordTranslations] = useState<string[]>([]);
  const [/* culturalNote */, setCulturalNote] = useState<string | null>(null);
  const [/* noteStatus */, setNoteStatus] = useState<NoteStatus>('idle');
  const [/* saved */, setSaved] = useState(false);
  const [/* errorMessage */, setErrorMessage] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);


  // Control de modo móvil
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const story = book.stories.find((s) => s.id === selectedStoryId);

  // --- Registro de lectura ---
  useEffect(() => {
    if (!story || !userPlan) return;

    if (userPlan === 'free' || userPlan === 'basic') {
      const readCount = getStoriesReadCount(userPlan);
      const limit = userPlan === 'free' ? 10 : 1;
      const overLimit = readCount >= limit;

      if (overLimit) {
        alert(
          userPlan === 'free'
            ? "You've reached the limit of 10 free stories."
            : "You've read your daily story as a Basic user."
        );
      } else {
        addStoryToHistory(story.id);
      }
    }
  }, [story?.id, userPlan]);

  // --- Estado de límites ---
const [limitReached, setLimitReached] = useState(false);
const [storiesLeft, setStoriesLeft] = useState<number | null>(null);

useEffect(() => {
  if (typeof window === 'undefined') return;

  if (userPlan === 'free' || userPlan === 'basic') {
    const count = getStoriesReadCount(userPlan);
    const limit = getStoriesLimit(userPlan);
    setStoriesLeft(Math.max(0, limit - count));
    setLimitReached(count >= limit);
  } else {
    setLimitReached(false);
    setStoriesLeft(null);
  }
}, [userPlan, story?.id]);

  if (!story) {
    return <div className="p-8 text-center">Selected story not found.</div>;
  }

  if (limitReached) {
    return (
      <div className="p-8 text-center text-red-400 space-y-4">
        <h2 className="text-2xl font-bold">
          {userPlan === 'free'
            ? "You've reached the limit of 10 free stories."
            : "You've read your daily story as a Basic user."}
        </h2>
        <p className="text-foreground">
          Upgrade your plan to continue enjoying full stories and audio.
        </p>
      </div>
    );
  }

  const handleStorySelect = (id: string) => setSelectedStoryId(id);

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
      body: JSON.stringify({ word, snippet, bookId: book.slug, storyId: selectedStoryId }),
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

  const handleParagraphSelection = async (e: React.MouseEvent<HTMLParagraphElement>) => {
    const sel = window.getSelection();
    const raw = sel?.toString().trim();
    if (!raw) return;

    const words = raw.split(/\s+/);
    if (words.length > 5) {
      setErrorMessage('Please select a maximum of 5 words.');
      return;
    }

    setErrorMessage(null);
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
    return selectedWord ? highlightWord(text, selectedWord) : text;
  };

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-6 text-foreground">
      <h1 className="text-3xl font-bold text-center">{book.title}</h1>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Select a story:</h2>

        {(userPlan === 'free' || userPlan === 'basic') && storiesLeft !== null && (
          <p className="text-sm text-gray-400">
            {userPlan === 'free'
              ? `You have ${storiesLeft} of 10 free stories left.`
              : storiesLeft === 0
                ? "You've already read your daily story."
                : `You have ${storiesLeft} story available today.`}
          </p>
        )}

        {book.stories.map((s: Story) => (
          <button
            key={s.id}
            onClick={() => handleStorySelect(s.id)}
            className={`w-full text-left px-4 py-2 rounded ${
              s.id === selectedStoryId ? 'bg-blue-700 text-foreground' : 'bg-gray-800 hover:bg-gray-700'
            }`}
          >
            {s.title}
          </button>
        ))}
      </div>

      <h2 className="text-2xl font-bold mt-6">{story.title}</h2>

      <StoryContent
        text={story.text}
        sentencesPerParagraph={3}
        onParagraphSelect={!isMobile ? handleParagraphSelection : undefined}
        renderWord={(t) => renderSelectableText(t)}
      />

      <VocabPanel story={story} />

      <div className="fixed bottom-0 left-0 right-0 z-50 md:ml-64">
        <Player src={`${book.audioFolder}/${story.audio}`} bookSlug={book.slug} storySlug={story.slug} />
      </div>
    </div>
  );
}