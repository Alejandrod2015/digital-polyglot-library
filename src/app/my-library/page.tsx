'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';

type LibraryBook = { id: string; bookId: string; title: string; coverUrl: string };

export default function MyLibraryPage() {
  const { user, isLoaded } = useUser();
  const [books, setBooks] = useState<LibraryBook[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoaded) return;
    if (!user) {
      setBooks([]);
      setLoading(false);
      return;
    }

    const fetchBooks = async () => {
      const res = await fetch('/api/library');
      if (res.ok) setBooks(await res.json());
      setLoading(false);
    };
    fetchBooks();
  }, [user, isLoaded]);

  const removeBook = async (bookId: string) => {
    setBooks((prev) => prev.filter((b) => b.bookId !== bookId));
    await fetch('/api/library', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookId }),
    });
  };

  if (loading) return <div className="p-8 text-gray-400">Loading your library...</div>;

  return (
    <div className="p-8 max-w-4xl mx-auto text-white">
      <h1 className="text-3xl font-bold mb-6">📚 My Library</h1>

      {books.length === 0 ? (
        <p className="text-gray-400">You haven’t saved any books yet.</p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3">
          {books.map((b) => (
            <div
              key={b.bookId}
              className="bg-gray-800 p-4 rounded-lg shadow hover:shadow-lg transition"
            >
              <img
                src={b.coverUrl}
                alt={b.title}
                className="rounded-md mb-3 w-full h-48 object-cover"
              />
              <p className="font-semibold mb-2">{b.title}</p>
              <button
                onClick={() => removeBook(b.bookId)}
                className="bg-red-600 hover:bg-red-700 text-white py-1 px-3 rounded text-sm"
              >
                🗑 Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
