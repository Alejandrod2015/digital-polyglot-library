'use client';

import { useState, useEffect } from 'react';
import { useUser, useClerk } from '@clerk/nextjs';
import { BookmarkPlus, BookmarkCheck } from 'lucide-react';

type Props = {
  storyId: string;
  bookId: string;
  title: string;
  coverUrl: string;
};

export default function AddStoryToLibraryButton({ storyId, bookId, title, coverUrl }: Props) {
  const { user, isLoaded } = useUser();
  const { openSignIn } = useClerk();
  const [inLibrary, setInLibrary] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!isLoaded) return;

    const key = `dp_library_stories_${user?.id ?? 'guest'}`;
    const cached = localStorage.getItem(key);
    if (cached) {
      try {
        const ids = JSON.parse(cached) as string[];
        if (ids.includes(storyId)) setInLibrary(true);
      } catch {
        /* ignore parse error */
      }
    }

    if (!user) {
      setChecking(false);
      return;
    }

    (async () => {
      try {
        const res = await fetch('/api/library?type=story', { cache: 'no-store' });
        if (res.ok) {
          const stories = (await res.json()) as { storyId: string }[];
          const ids = stories.map((s) => s.storyId);
          localStorage.setItem(key, JSON.stringify(ids));
          setInLibrary(ids.includes(storyId));
        }
      } catch (err) {
        console.error('Error checking story in library:', err);
      } finally {
        setChecking(false);
      }
    })();
  }, [user, isLoaded, storyId]);

  const toggleLibrary = async () => {
    if (!user) {
      openSignIn({
        afterSignInUrl: `/books/${bookId}/${storyId}`,
        afterSignUpUrl: `/books/${bookId}/${storyId}`,
      });
      return;
    }

    const key = `dp_library_stories_${user.id}`;
    setInLibrary((prev) => {
      const next = !prev;
      try {
        const cached = localStorage.getItem(key);
        const ids = cached ? (JSON.parse(cached) as string[]) : [];
        const updated = next ? [...new Set([...ids, storyId])] : ids.filter((id) => id !== storyId);
        localStorage.setItem(key, JSON.stringify(updated));
      } catch {
        /* ignore cache errors */
      }
      return next;
    });

    try {
      if (inLibrary) {
        await fetch('/api/library', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'story', storyId }),
        });
      } else {
        await fetch('/api/library', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'story', storyId, bookId, title, coverUrl }),
        });
      }
    } catch (err) {
      console.error('Error toggling story library:', err);
    }
  };

  return (
    <button
      onClick={toggleLibrary}
      disabled={!isLoaded || checking}
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-colors ${
        inLibrary
          ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
          : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
      }`}
    >
      {inLibrary ? <BookmarkCheck className="h-5 w-5" /> : <BookmarkPlus className="h-5 w-5" />}
      {inLibrary ? 'In My Library' : 'Add to My Library'}
    </button>
  );
}
