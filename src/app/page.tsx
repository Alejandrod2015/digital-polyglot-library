"use client";

import { useRouter } from "next/navigation";
import { books } from "@/data/books";
import Cover from "@/components/Cover";
import { useEffect, useState, useMemo } from "react";
import { useUser } from "@clerk/nextjs";

type ContinueItem = { id: string; title: string; cover: string };

export default function Home() {
  const router = useRouter();
  const { user } = useUser();

  const allBooks = Object.values(books);
  const [continueListening, setContinueListening] = useState<ContinueItem[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("dp_continue_listening_v1");
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setContinueListening(
          parsed.filter(
            (i) => typeof i?.id === "string" && typeof i?.cover === "string"
          )
        );
      }
    } catch {
      // ignora datos corruptos
    }
  }, []);

  // 🔹 Leer idiomas preferidos (nombres como "German", "Spanish", etc.)
  const targetLanguages =
    (user?.publicMetadata?.targetLanguages as unknown) ?? [];

  // 🔹 Filtrar libros por idioma seleccionado (coincidencia exacta por nombre)
  const filteredBooks = useMemo(() => {
    if (
      Array.isArray(targetLanguages) &&
      targetLanguages.every((i) => typeof i === "string") &&
      targetLanguages.length > 0
    ) {
      return allBooks.filter((b) =>
        targetLanguages.includes(b.language ?? "")
      );
    }
    return allBooks;
  }, [allBooks, targetLanguages]);

  const capitalize = (value?: string) =>
    value ? value.charAt(0).toUpperCase() + value.slice(1) : "—";

  return (
    <main className="min-h-screen bg-[#0D1B2A] text-white flex flex-col items-center justify-center px-8 pb-28 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
      {/* New Releases */}
      <section className="mb-12 text-center w-full max-w-5xl">
        <h2 className="text-2xl font-semibold mb-6">New Releases</h2>
        <div className="grid gap-8 grid-cols-1 sm:grid-cols-2 place-items-center">
          {filteredBooks.slice(0, 5).map((book) => (
            <div
              key={book.id}
              onClick={() => router.push(`/books/${book.slug}?from=home`)}
              className="flex items-center gap-6 w-full max-w-[480px] bg-white/5 rounded-2xl p-5 cursor-pointer hover:bg-white/10 hover:shadow-md transition-all duration-200"
            >
              <div className="w-[38%] sm:w-[35%] md:w-[120px] flex-shrink-0">
                <Cover
                  src={book.cover ?? "/covers/default.jpg"}
                  alt={book.title}
                />
              </div>
              <div className="flex flex-col justify-center text-left flex-1 text-white">
                <h3 className="font-semibold text-lg leading-snug mb-2 line-clamp-2">
                  {book.title}
                </h3>
                <div className="space-y-1 text-sm text-white/80">
                  <p>
                    <span className="font-medium text-white">Language:</span>{" "}
                    {capitalize(book.language)}
                  </p>
                  <p>
                    <span className="font-medium text-white">Level:</span>{" "}
                    {capitalize(book.level)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Picked for you */}
      <section className="mb-12 text-center w-full max-w-5xl">
        <h2 className="text-2xl font-semibold mb-6">Picked for you</h2>
        <div className="grid gap-8 grid-cols-1 sm:grid-cols-2 place-items-center">
          {filteredBooks.slice(-5).map((book) => (
            <div
              key={book.id}
              onClick={() => router.push(`/books/${book.slug}?from=home`)}
              className="flex items-center gap-6 w-full max-w-[480px] bg-white/5 rounded-2xl p-5 cursor-pointer hover:bg-white/10 hover:shadow-md transition-all duration-200"
            >
              <div className="w-[38%] sm:w-[35%] md:w-[120px] flex-shrink-0">
                <Cover
                  src={book.cover ?? "/covers/default.jpg"}
                  alt={book.title}
                />
              </div>
              <div className="flex flex-col justify-center text-left flex-1 text-white">
                <h3 className="font-semibold text-lg leading-snug mb-2 line-clamp-2">
                  {book.title}
                </h3>
                <div className="space-y-1 text-sm text-white/80">
                  <p>
                    <span className="font-medium text-white">Language:</span>{" "}
                    {capitalize(book.language)}
                  </p>
                  <p>
                    <span className="font-medium text-white">Level:</span>{" "}
                    {capitalize(book.level)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Continue listening */}
      {continueListening.length > 0 && (
        <section className="w-full max-w-5xl text-center">
          <h2 className="text-2xl font-semibold mb-6">Continue listening</h2>
          <div className="grid gap-8 grid-cols-1 sm:grid-cols-2 place-items-center">
            {continueListening.map((item) => (
              <div
                key={item.id}
                onClick={() => router.push(`/books/${item.id}?from=home`)}
                className="flex items-center gap-6 w-full max-w-[480px] bg-white/5 rounded-2xl p-5 cursor-pointer hover:bg-white/10 hover:shadow-md transition-all duration-200"
              >
                <div className="w-[38%] sm:w-[35%] md:w-[120px] flex-shrink-0">
                  <Cover src={item.cover} alt={item.title} />
                </div>
                <div className="flex flex-col justify-center text-left flex-1 text-white">
                  <h3 className="font-semibold text-lg leading-snug mb-2 line-clamp-2">
                    {item.title}
                  </h3>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
