import { books } from "@/data/books";
import Link from "next/link";

interface Props {
  params: { bookId: string };
}

export default function BookPage({ params }: Props) {
  const { bookId } = params;
  const book = books[bookId];

  if (!book) {
    return <div className="p-8 text-center">Libro no encontrado.</div>;
  }

  return (
    <div className="flex flex-col items-center text-center p-8">
      <h1 className="text-3xl font-bold mb-4">{book.title}</h1>
      <p className="max-w-2xl text-lg mb-6">{book.description}</p>

      <Link
        href={`/books/${bookId}/stories`}
        className="px-6 py-3 bg-blue-600 text-white rounded-xl shadow hover:bg-blue-700"
      >
        Leer historias
      </Link>
    </div>
  );
}

export function generateStaticParams() {
  return Object.keys(books).map((id) => ({ bookId: id }));
}
