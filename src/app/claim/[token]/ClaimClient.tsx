"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useAuth, UserButton } from "@clerk/nextjs";

type Book = {
  id: string;
  title: string;
  cover: string;
  description?: string;
};

type ClaimState =
  | { status: "loading" }
  | { status: "success"; books: Book[]; message: string }
  | { status: "error"; message: string };

export default function ClaimClient({ token }: { token: string }) {
  const { isSignedIn } = useAuth();
  const [state, setState] = useState<ClaimState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    async function redeemToken() {
      try {
        const res = await fetch(`/api/claim/${token}`);
        const data = await res.json();

        if (cancelled) return;

        if (!res.ok) {
          const friendly =
            res.status === 410
              ? "If you believe this is a mistake, contact us at support@digitalpolyglot.com."
              : data?.error || "An unexpected error has occurred.";
          setState({ status: "error", message: friendly });
          return;
        }

        setState({
          status: "success",
          books: data.books || [],
          message: data.message || "Books added to your account",
        });
      } catch (err) {
        if (!cancelled) {
          setState({
            status: "error",
            message:
              "Could not connect to the server. Please try again in a few minutes.",
          });
        }
      }
    }

    redeemToken();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (state.status === "loading") {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#0D1B2A] text-white">
        <p className="text-lg animate-pulse">Validating your access...</p>
      </main>
    );
  }

  if (state.status === "error") {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center bg-[#0D1B2A] text-white px-6 text-center">
        <h1 className="text-2xl font-semibold mb-3">This access link has already been used.</h1>
        <p className="text-white/80 mb-6">{state.message}</p>
        <a
          href="https://reader.digitalpolyglot.com/"
          className="px-4 py-2 bg-white text-[#0D1B2A] rounded-xl hover:bg-gray-200 transition"
        >
          Go to homepage
        </a>
      </main>
    );
  }

  const message = state.message.includes("already")
    ? "📚 You had already added these books."
    : "✅ Books added to your account";

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-[#0D1B2A] text-white px-8 text-center relative">
      <div className="absolute top-4 right-4">
        <UserButton afterSignOutUrl="/" />
      </div>

      <h1 className="text-3xl font-semibold mb-4">{message}</h1>
      <p className="text-white/80 mb-8">
        {isSignedIn
          ? "You can now find them in your library."
          : "Sign in to access your new books."}
      </p>

      <div className="grid gap-6 sm:grid-cols-2 max-w-3xl">
        {state.books.map((book) => (
          <div
            key={book.id}
            className="bg-white/10 rounded-2xl p-4 flex flex-col items-center hover:bg-white/20 transition"
          >
            <Image
              src={book.cover || "/covers/default.jpg"}
              alt={book.title}
              width={128}
              height={192}
              className="rounded-lg mb-3 object-cover"
            />
            <p className="font-medium">{book.title}</p>
          </div>
        ))}
      </div>

      <a
        href={
          isSignedIn
            ? "https://reader.digitalpolyglot.com/my-library"
            : `https://reader.digitalpolyglot.com/sign-in?redirect_url=/claim/${token}`
        }
        className="mt-10 px-6 py-2 bg-white text-[#0D1B2A] rounded-xl hover:bg-gray-200 transition"
      >
        {isSignedIn ? "Go to my library" : "Sign in to view library"}
      </a>
    </main>
  );
}
