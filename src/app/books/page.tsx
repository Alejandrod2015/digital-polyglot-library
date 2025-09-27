'use client';

import { useRouter } from 'next/navigation';

export default function BooksPage() {
  const router = useRouter();

  const books = [
    {
      id: 'short-stories-mexican',
      title: 'Short Stories in Mexican Spanish',
      cover: '/globe.svg', // Usa una imagen real cuando la tengas
    },
    // Puedes añadir más libros aquí
  ];

  return (
    <main className="min-h-screen bg-black text-white p-8">
      <h1 className="text-3xl font-bold mb-6 text-center">Elige un libro</h1>

      <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 justify-items-center">
        {books.map((book) => (
          <div
            key={book.id}
            className="cursor-pointer hover:scale-105 transition-transform text-center"
            onClick={() => router.push(`/reader/${book.id}`)}
          >
            <img src={book.cover} alt={book.title} className="w-32 h-32 mx-auto mb-4" />
            <p className="text-lg font-medium">{book.title}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
