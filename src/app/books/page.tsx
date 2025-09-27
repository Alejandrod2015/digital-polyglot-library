'use client';

import { useRouter } from 'next/navigation';

export default function BooksPage() {
  const router = useRouter();

  const books = [
  {
    id: 'short-stories-mexican',
    title: 'Short Stories in Mexican Spanish',
    cover: '/covers/sss_mexico.jpg',
  },
  {
    id: 'short-stories-spain',
    title: 'Short Stories in Castilian Spanish',
    cover: '/covers/sss_spain.jpg',
  },
  {
    id: 'short-stories-argentina',
    title: 'Short Stories in Rioplatense Spanish',
    cover: '/covers/sss_argentina.jpg',
  },
];


  return (
    <main className="min-h-screen bg-black text-white p-8">
      <h1 className="text-3xl font-bold mb-6 text-center">Elige un libro</h1>

      <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 justify-items-center">
        {books.map((book) => (
          <div
            key={book.id}
            className="cursor-pointer hover:scale-105 transition-transform text-center"
            onClick={() => router.push(`/books/${book.id}`)}
          >
            <img
              src={book.cover}
              alt={book.title}
              className="w-full h-48 object-cover rounded-lg shadow-md"
            />
            <p className="text-lg font-medium">{book.title}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
