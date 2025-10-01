'use client';

import { useRouter } from 'next/navigation';
import Image from 'next/image';

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
    {
      id: 'ss-de-germany',
      title: 'Short Stories in German',
      cover: '/covers/ss-de-germany.jpg',
    },
  ];

  return (
    <main className="min-h-screen bg-[#0D1B2A] text-white p-8">
      <h1 className="text-3xl font-bold mb-6 text-center">Elige un libro</h1>

      <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 justify-items-center">
        {books.map((book) => (
          <div
            key={book.id}
            className="cursor-pointer hover:scale-105 transition-transform text-center"
            onClick={() => router.push(`/books/${book.id}`)}
          >
            <div className="relative w-full h-48">
              <Image
                src={book.cover}
                alt={book.title}
                fill
                className="object-cover rounded-lg shadow-md"
                priority
              />
            </div>
            <p className="text-lg font-medium mt-2">{book.title}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
