'use client';

import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Cover from "@/components/Cover";

export default function BooksPage() {
  const router = useRouter();

  const books = [
    {
      id: 'ss-es-mx',
      title: 'Short Stories in Mexican Spanish',
      cover: '/covers/ss-es-mx.jpg',
    },
    {
      id: 'ss-es-es',
      title: 'Short Stories in Castilian Spanish',
      cover: '/covers/ss-es-es.jpg',
    },
    {
      id: 'ss-es-arg',
      title: 'Short Stories in Rioplatense Spanish',
      cover: '/covers/ss-es-arg.jpg',
    },
    {
      id: 'ss-de-de',
      title: 'Short Stories in German',
      cover: '/covers/ss-de-de.jpg',
    },
  ];

  return (
    <main className="min-h-screen bg-[#0D1B2A] text-white p-8">
      <h1 className="text-3xl font-bold mb-6 text-center">Library</h1>

      <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 justify-items-center">
        {books.map((book) => (
          <div
            key={book.id}
            className="cursor-pointer hover:scale-105 transition-transform text-center"
            onClick={() => router.push(`/books/${book.id}`)}
          >
            <div className="w-[220px] h-[330px] flex items-center justify-center bg-[#0D1B2A] rounded-xl shadow-lg overflow-hidden">
              <Cover src={book.cover} alt={book.title} className="w-[220px]" />
            </div>
            <p className="text-lg font-medium mt-2">{book.title}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
