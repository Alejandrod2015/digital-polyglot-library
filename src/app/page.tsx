'use client';

import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-black text-white px-6 text-center">
      <h1 className="text-4xl md:text-5xl font-bold mb-6">Bienvenido a Digital Polyglot</h1>
      <p className="text-lg md:text-xl mb-8 max-w-md">
        Selecciona un libro para comenzar a leer y escuchar historias.
      </p>
      <button
        onClick={() => router.push('/books')}
        className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded"
      >
        Ver libros
      </button>
    </main>
  );
}
