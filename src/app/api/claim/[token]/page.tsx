"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { booksData } from "@/data/books";

interface ClaimResponse {
  message: string;
  books?: string[];
  redeemedBy?: string | null;
  error?: string;
}

export default function ClaimPage({ params }: { params: { token: string } }) {
  const [data, setData] = useState<ClaimResponse | null>(null);
  const [status, setStatus] = useState<"loading" | "success" | "used" | "error">("loading");

  useEffect(() => {
    async function redeem() {
      try {
        const res = await fetch(`/api/claim/${params.token}`);
        const json = await res.json();

        if (json.error === "Token already used") {
          setStatus("used");
        } else if (!res.ok || json.error) {
          setStatus("error");
        } else {
          setStatus("success");
        }

        setData(json);
      } catch (err) {
        console.error(err);
        setStatus("error");
      }
    }

    redeem();
  }, [params.token]);

  // --- Estado: cargando ---
  if (status === "loading") {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0f0f0f] text-white">
        <motion.div
          className="text-xl font-medium"
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
        >
          Redimiendo tu token...
        </motion.div>
      </div>
    );
  }

  // --- Estado: token usado ---
  if (status === "used") {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-[#0f0f0f] text-center text-white p-6">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-3xl font-bold mb-4"
        >
          ⚠️ Este token ya fue utilizado
        </motion.h1>
        <p className="text-gray-400 mb-6">
          Parece que este acceso ya fue redimido por otro usuario.
        </p>
        <Link
          href="/"
          className="rounded-xl bg-yellow-400 px-6 py-2 text-black font-semibold hover:bg-yellow-300 transition"
        >
          Volver al inicio
        </Link>
      </div>
    );
  }

  // --- Estado: error ---
  if (status === "error" || !data) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-[#0f0f0f] text-center text-white p-6">
        <h1 className="text-2xl font-semibold mb-2">🚫 Algo salió mal</h1>
        <p className="text-gray-400 mb-4">{data?.error || "Token inválido o expirado"}</p>
        <Link
          href="/"
          className="rounded-xl bg-yellow-400 px-6 py-2 text-black font-semibold hover:bg-yellow-300 transition"
        >
          Volver al inicio
        </Link>
      </div>
    );
  }

  // --- Estado: éxito ---
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-[#0f0f0f] to-[#1a1a1a] text-white p-6">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="text-center max-w-3xl"
      >
        <h1 className="text-3xl font-bold mb-4">
          🎉 Has desbloqueado tus libros
        </h1>
        <p className="text-gray-400 mb-8">
          {data?.message || "Tus libros se han agregado a tu cuenta."}
        </p>

        <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 justify-center mb-10">
          {data?.books?.map((bookId) => {
            const book = booksData[bookId];
            return (
              <motion.div
                key={bookId}
                className="bg-[#1f1f1f] rounded-2xl shadow-lg overflow-hidden border border-[#333] hover:border-yellow-400 transition"
                whileHover={{ scale: 1.03 }}
              >
                {book ? (
                  <>
                    <Image
                      src={book.cover}
                      alt={book.title}
                      width={300}
                      height={400}
                      className="w-full h-48 object-cover"
                    />
                    <div className="p-4">
                      <h2 className="text-lg font-semibold mb-2">
                        {book.title}
                      </h2>
                      <p className="text-sm text-gray-400 line-clamp-2">
                        {book.description}
                      </p>
                    </div>
                  </>
                ) : (
                  <div className="p-6 text-gray-500 italic">Libro no encontrado</div>
                )}
              </motion.div>
            );
          })}
        </div>

        <Link
          href="/my-library"
          className="rounded-xl bg-yellow-400 px-6 py-2 text-black font-semibold hover:bg-yellow-300 transition"
        >
          Ir a mi biblioteca
        </Link>
      </motion.div>
    </div>
  );
}
