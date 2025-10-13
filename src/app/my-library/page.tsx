'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { books } from '@/data/books';
import Skeleton from '@/components/Skeleton';

type LibraryBook = { id: string; bookId: string; title: string; coverUrl: string };
type LibraryStory = { id: string; storyId: string; bookId: string; title: string; coverUrl: string };

export default function MyLibraryPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [booksList, setBooksList] = useState<LibraryBook[]>([]);
  const [stories, setStories] = useState<LibraryStory[]>([]);
  const [tab, setTab] = useState<'books' | 'stories'>('books');
  const [loading, setLoading] = useState(true);

  // 🔄 Cargar libros e historias del usuario
  useEffect(() => {
    if (!isLoaded) return;

    const fetchData = async () => {
      if (!user) {
        setBooksList([]);
        setStories([]);
        setLoading(false);
        return;
      }

      try {
        const [booksRes, storiesRes] = await Promise.all([
          fetch('/api/library?type=book', { cache: 'no-store' }),
          fetch('/api/library?type=story', { cache: 'no-store' }),
        ]);

        const fetchedBooks = booksRes.ok ? await booksRes.json() : [];
        const fetchedStories = storiesRes.ok ? await storiesRes.json() : [];

        setBooksList(fetchedBooks);
        setStories(fetchedStories);
      } catch (err) {
        console.error('Error fetching library:', err);
      } finally {
        // Retraso mínimo solo para dar tiempo al render y evitar parpadeo
        setTimeout(() => setLoading(false), 150);
      }
    };

    void fetchData();
  }, [user, isLoaded]);

  const removeItem = async (type: 'book' | 'story', id: string) => {
    if (type === 'book') {
      setBooksList((prev) => prev.filter((b) => b.bookId !== id));
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

  const activeList: (LibraryBook | LibraryStory)[] = tab === 'books' ? booksList : stories;
  const isBooks = tab === 'books';

  return (
    <div className="p-8 max-w-4xl mx-auto text-white">
      <h1 className="text-3xl font-bold mb-6">📚 My Library</h1>

      <div className="flex gap-4 mb-6">
        <button
          onClick={() => setTab('books')}
          className={`px-4 py-2 rounded-lg transition-colors ${
            tab === 'books' ? 'bg-emerald-600 text-white' : 'bg-gray-700 text-gray-200'
          }`}
        >
          Books
        </button>
        <button
          onClick={() => setTab('stories')}
          className={`px-4 py-2 rounded-lg transition-colors ${
            tab === 'stories' ? 'bg-emerald-600 text-white' : 'bg-gray-700 text-gray-200'
          }`}
        >
          Stories
        </button>
      </div>

      {/* Skeleton estructural */}
      {loading && (
        <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-gray-800 p-4 rounded-lg shadow animate-pulse">
              <div className="w-full h-48 bg-gray-700 rounded-md mb-3" />
              <Skeleton lines={2} />
            </div>
          ))}
        </div>
      )}

      {/* Contenido real */}
      {!loading && (
        <>
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

                let href: string | null = null;
                if (isBooks) {
                  const bookEntry = Object.values(books).find(
                    (b) => b.id === (item as LibraryBook).bookId,
                  );
                  if (bookEntry) href = `/books/${bookEntry.slug}`;
                } else {
                  const storyItem = item as LibraryStory;
                  const bookEntry = Object.values(books).find(
                    (b) => b.id === storyItem.bookId,
                  );
                  const storyEntry = bookEntry?.stories.find(
                    (s) => s.id === storyItem.storyId,
                  );
                  if (bookEntry && storyEntry)
                    href = `/books/${bookEntry.slug}/${storyEntry.slug}`;
                }

                return (
                  <div
                    key={id}
                    role={href ? 'button' : undefined}
                    tabIndex={href ? 0 : -1}
                    onClick={() => href && router.push(href)}
                    onKeyDown={(e) => {
                      if (!href) return;
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        router.push(href);
                      }
                    }}
                    className={`bg-gray-800 p-4 rounded-lg shadow hover:shadow-lg transition ${
                      href ? 'cursor-pointer hover:opacity-90' : ''
                    }`}
                  >
                    <img
                      src={item.coverUrl || '/covers/default.jpg'}
                      alt={item.title}
                      onError={(e) =>
                        (e.currentTarget.src = '/covers/default.jpg')
                      }
                      className="rounded-md mb-3 w-full h-48 object-cover"
                    />
                    <p className="font-semibold mb-2">{item.title}</p>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        removeItem(isBooks ? 'book' : 'story', id);
                      }}
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
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7h6m2 0H7m3-3h4a1 1 0 011 1v1H8V5a1 1 0 011-1z"
                        />
                      </svg>
                      Remove
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
