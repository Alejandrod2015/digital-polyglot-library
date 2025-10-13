'use client';

import { useState, useEffect } from 'react';
import { useUser, useClerk } from '@clerk/nextjs';
import { BookmarkPlus, BookmarkCheck } from 'lucide-react';

type Props = {
  bookId: string;
  title: string;
  coverUrl: string;
};

export default function AddToLibraryButton({ bookId, title, coverUrl }: Props) {
  const { user, isLoaded } = useUser();
  const { openSignIn } = useClerk();
  const [inLibrary, setInLibrary] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!isLoaded) return;
    if (!user) {
      setInLibrary(false);
      setChecking(false);
      return;
    }

    // Consulta en segundo plano sin bloquear la UI
    (async () => {
      try {
        const res = await fetch('/api/library');
        if (res.ok) {
          const books = (await res.json()) as { bookId: string }[];
          if (books.some((b) => b.bookId === bookId)) setInLibrary(true);
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
      openSignIn({ afterSignInUrl: `/books/${bookId}`, afterSignUpUrl: `/books/${bookId}` });
      return;
    }

    setInLibrary((prev) => !prev); // respuesta inmediata

    try {
      if (inLibrary) {
        await fetch('/api/library', {
  method: 'DELETE',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ type: 'book', bookId }),
});

      } else {
        await fetch('/api/library', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ type: 'book', bookId, title, coverUrl }),
});

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
      }`}
    >
      {inLibrary ? <BookmarkCheck className="h-5 w-5" /> : <BookmarkPlus className="h-5 w-5" />}
      {inLibrary ? 'In My Library' : 'Add to My Library'}
    </button>
  );
}