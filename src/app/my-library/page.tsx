'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { books as booksData } from '@/data/books'; // 👈 renombrado para no chocar con el estado

type LibraryBook = { id: string; bookId: string; title: string; coverUrl: string };
type LibraryStory = { id: string; storyId: string; bookId: string; title: string; coverUrl: string };

export default function MyLibraryPage() {
  const { user, isLoaded } = useUser();
  const [books, setBooks] = useState<LibraryBook[]>([]);
  const [stories, setStories] = useState<LibraryStory[]>([]);
  const [tab, setTab] = useState<'books' | 'stories'>('books');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoaded) return;
    if (!user) {
      setBooks([]);
      setStories([]);
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        const [booksRes, storiesRes] = await Promise.all([
          fetch('/api/library?type=book'),
          fetch('/api/library?type=story'),
        ]);
        if (booksRes.ok) setBooks(await booksRes.json());
        if (storiesRes.ok) setStories(await storiesRes.json());
      } catch (err) {
        console.error('Error fetching library:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user, isLoaded]);

  const removeItem = async (type: 'book' | 'story', id: string) => {
    if (type === 'book') {
      setBooks((prev) => prev.filter((b) => b.bookId !== id));
      await fetch('/api/library', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'book', bookId: id }),
      });
    } else {
      setStories((prev) => prev.filter((s) => s.storyId !== id));
      await fetch('/api/library', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'story', storyId: id }),
      });
    }
  };

  if (loading) return <div className="p-8 text-gray-400">Loading your library...</div>;

  const activeList: (LibraryBook | LibraryStory)[] = tab === 'books' ? books : stories;
  const isBooks = tab === 'books';

  return (
    <div className="p-8 max-w-4xl mx-auto text-white">
      <h1 className="text-3xl font-bold mb-6">My Library</h1>

      <div className="flex gap-4 mb-6">
        <button
          onClick={() => setTab('books')}
          className={`px-4 py-2 rounded-lg ${
            tab === 'books' ? 'bg-emerald-600 text-white' : 'bg-gray-700 text-gray-200'
          }`}
        >
          Books
        </button>
        <button
          onClick={() => setTab('stories')}
          className={`px-4 py-2 rounded-lg ${
            tab === 'stories' ? 'bg-emerald-600 text-white' : 'bg-gray-700 text-gray-200'
          }`}
        >
          Stories
        </button>
      </div>

      {activeList.length === 0 ? (
        <p className="text-gray-400">
          {isBooks ? 'You haven’t saved any books yet.' : 'You haven’t saved any stories yet.'}
        </p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3">
          {activeList.map((item) => {
            const id = isBooks
              ? (item as LibraryBook).bookId
              : (item as LibraryStory).storyId;

            // 🔍 si es historia, construye el link usando slugs locales
            let href: string | null = null;
            if (!isBooks) {
              const storyItem = item as LibraryStory;
              const bookEntry = Object.values(booksData).find((b) => b.id === storyItem.bookId);
              const storyEntry = bookEntry?.stories.find((s) => s.id === storyItem.storyId);
              if (bookEntry && storyEntry) {
                href = `/books/${bookEntry.slug}/${storyEntry.slug}`;
              }
            }

            const Card = (
              <div
                key={id}
                className="bg-gray-800 p-4 rounded-lg shadow hover:shadow-lg transition"
              >
                <img
                  src={item.coverUrl || '/covers/default.jpg'}
                  alt={item.title}
                  onError={(e) => (e.currentTarget.src = '/covers/default.jpg')}
                  className="rounded-md mb-3 w-full h-48 object-cover"
                />
                <p className="font-semibold mb-2">{item.title}</p>
                <button
  onClick={() => removeItem(isBooks ? 'book' : 'story', id)}
  className="flex items-center gap-2 text-gray-400 hover:text-red-500 transition-colors text-sm font-medium"
>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-4 w-4"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={1.8}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7h6m2 0H7m3-3h4a1 1 0 011 1v1H8V5a1 1 0 011-1z" />
  </svg>
  Remove
</button>

              </div>
            );

            return href ? (
              <a key={id} href={href} className="block hover:opacity-90 transition">
                {Card}
              </a>
            ) : (
              Card
            );
          })}
        </div>
      )}
    </div>
  );
}
