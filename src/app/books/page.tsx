'use client';

import { useRouter } from 'next/navigation';
import Cover from "@/components/Cover";
import { books } from "@/data/books";

export default function BooksPage() {
  const router = useRouter();

  // Pasamos el objeto a array
  const booksArray = Object.values(books);

  return (
    <main className="min-h-screen bg-[#0D1B2A] text-white p-8">
      <h1 className="text-3xl font-bold mb-6 text-center">Library</h1>

      <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 justify-items-center">
        {booksArray.map((book) => (
          <div
            key={book.slug}
            className="cursor-pointer hover:scale-105 transition-transform text-center"
            onClick={() => router.push(`/books/${book.slug}`)}
          >
            <div className="w-[220px] h-[330px] flex items-center justify-center bg-[#0D1B2A] rounded-xl shadow-lg overflow-hidden">
              <Cover src={book.cover ?? ""} alt={book.title} className="w-[220px]" />
            </div>
            <p className="text-lg font-medium mt-2">{book.title}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
