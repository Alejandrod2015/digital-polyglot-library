'use client';

import { useState, useEffect } from 'react';
import { useUser, useClerk } from '@clerk/nextjs';
import { ArrowDown, BookmarkPlus, BookmarkCheck } from 'lucide-react';
import { clerkAppearance } from '../lib/clerkAppearance';
import { books } from '@/data/books';
import { hasOfflineBook, removeOfflineBook, saveOfflineBook } from '@/lib/offlineLibrary';

type Props = {
  bookId: string;
  title: string;
  coverUrl: string;
};

export default function AddToLibraryButton({ bookId, title, coverUrl }: Props) {
  const { user, isLoaded } = useUser();
  const { openSignIn } = useClerk();
  const [inLibrary, setInLibrary] = useState(false);
  const [savedOffline, setSavedOffline] = useState(false);
  const [checking, setChecking] = useState(true);
  const [celebrate, setCelebrate] = useState(false);

  useEffect(() => {
    if (!isLoaded) return;

    const key = `dp_library_books_${user?.id ?? 'guest'}`;
    const cached = localStorage.getItem(key);
    if (cached) {
      try {
        const ids = JSON.parse(cached) as string[];
        if (ids.includes(bookId)) setInLibrary(true);
      } catch {
        /* ignore parse error */
      }
    }

    if (!user) {
      setSavedOffline(false);
      setChecking(false);
      return;
    }

    // Consulta en segundo plano sin bloquear la UI
    (async () => {
      try {
        setSavedOffline(await hasOfflineBook(user.id, bookId));
        const res = await fetch('/api/library', { cache: 'no-store' });
        if (res.ok) {
          const books = (await res.json()) as { bookId: string }[];
          const ids = books.map((b) => b.bookId);
          localStorage.setItem(key, JSON.stringify(ids));
          setInLibrary(ids.includes(bookId));
        }
      } catch (err) {
        console.error('Error checking library:', err);
      } finally {
        setChecking(false);
      }
    })();
  }, [user, isLoaded, bookId]);

  const toggleLibrary = async () => {
    if (!user) {
      openSignIn({
        appearance: clerkAppearance,
        fallbackRedirectUrl: `/books/${bookId}`,
        forceRedirectUrl: `/books/${bookId}`,
      });
      return;
    }

    const key = `dp_library_books_${user.id}`;
    const adding = !inLibrary;
    if (adding) {
      setCelebrate(true);
      window.setTimeout(() => setCelebrate(false), 550);
    }
    setInLibrary((prev) => {
      const next = !prev;
      try {
        const cached = localStorage.getItem(key);
        const ids = cached ? (JSON.parse(cached) as string[]) : [];
        const updated = next ? [...new Set([...ids, bookId])] : ids.filter((id) => id !== bookId);
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
          body: JSON.stringify({ type: 'book', bookId }),
        });
        await removeOfflineBook(user.id, bookId);
        setSavedOffline(false);
      } else {
        await fetch('/api/library', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'book', bookId, title, coverUrl }),
        });
        const bookData = books[bookId];
        await saveOfflineBook(user.id, {
          bookId,
          title,
          coverUrl,
          bookData,
        });
        setSavedOffline(true);
      }
    } catch (err) {
      console.error('Error toggling library:', err);
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
      } ${celebrate ? 'scale-[1.03]' : 'scale-100'} duration-200`}
    >
      {inLibrary ? <BookmarkCheck className="h-5 w-5" /> : <BookmarkPlus className="h-5 w-5" />}
      {inLibrary ? 'In My Library' : 'Add to My Library'}
      {savedOffline ? <ArrowDown className="h-4 w-4 opacity-90" aria-label="Saved on this device" /> : null}
    </button>
  );
}
