"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { useAuth, UserButton } from "@clerk/nextjs";

type Book = {
  id: string;
  title: string;
  cover: string;
  description?: string;
};

// WHY (2026-07-29): this screen used to render "Books added to your account"
// off the mere absence of an HTTP error. On 2026-07-28 the API answered OK
// while the LibraryBook write had failed; the buyer read "added", found an
// empty library, concluded the payment had not gone through and bought the
// same book a second time. The success state now requires `delivered: true`
// from the API, and a failed delivery gets its own retryable state.
type ClaimState =
  | { status: "loading" }
  | { status: "needsAuth"; books: Book[]; message: string }
  | { status: "success"; books: Book[]; alreadyOwned: boolean }
  | { status: "notDelivered"; books: Book[]; message: string }
  | { status: "error"; title: string; message: string };

export default function ClaimClient({ token }: { token: string }) {
  const { isSignedIn } = useAuth();
  const [state, setState] = useState<ClaimState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => {
    setState({ status: "loading" });
    setAttempt((n) => n + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function redeemToken() {
      try {
        const res = await fetch(`/api/claim/${token}`, { cache: "no-store" });
        const data = await res.json();

        if (cancelled) return;

        // The delivery failed but the purchase is intact: say so plainly and
        // offer a retry. Never present this as success, and never as a used
        // link; both readings push the buyer to pay again.
        if (res.status === 503 || data?.code === "notDelivered" || data?.code === "serverError") {
          setState({
            status: "notDelivered",
            books: data?.books || [],
            message:
              data?.error ||
              "We could not add these books to your library just now. Nothing was lost and you have not been charged again.",
          });
          return;
        }

        if (!res.ok) {
          setState({
            status: "error",
            title:
              data?.code === "usedByAnother"
                ? "This access link has already been used"
                : "This access link is not valid",
            message:
              data?.error ||
              "If you believe this is a mistake, contact us at support@digitalpolyglot.com.",
          });
          return;
        }

        // Signed-out visitor: the API did NOT redeem anything (it must never
        // mutate the token without a session). Prompt sign-in instead of
        // showing a misleading "Books added"; after auth they land back here
        // and the books are granted.
        if (data?.requiresAuth) {
          setState({
            status: "needsAuth",
            books: data.books || [],
            message:
              data.message || "Sign in to add these books to your library.",
          });
          return;
        }

        // A 200 without `delivered` means an older/unknown response shape:
        // treat it as not delivered rather than claiming success blindly.
        if (data?.delivered !== true) {
          setState({
            status: "notDelivered",
            books: data?.books || [],
            message:
              "We could not confirm these books reached your library. Your purchase is safe and you have not been charged again.",
          });
          return;
        }

        setState({
          status: "success",
          books: data.books || [],
          alreadyOwned: data.alreadyOwned === true,
        });
      } catch {
        if (!cancelled) {
          setState({
            status: "notDelivered",
            books: [],
            message:
              "Could not reach the server. Your purchase is safe and you have not been charged again.",
          });
        }
      }
    }

    redeemToken();
    return () => {
      cancelled = true;
    };
  }, [token, attempt]);

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
        <h1 className="text-2xl font-semibold mb-3">{state.title}</h1>
        <p className="text-white/80 mb-6 max-w-xl">{state.message}</p>
        <a
          href="https://reader.digitalpolyglot.com/"
          className="px-4 py-2 bg-white text-[#0D1B2A] rounded-xl hover:bg-gray-200 transition"
        >
          Go to homepage
        </a>
      </main>
    );
  }

  if (state.status === "notDelivered") {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center bg-[#0D1B2A] text-white px-6 text-center">
        <h1 className="text-2xl font-semibold mb-3">We could not add your books yet</h1>
        <p className="text-white/80 mb-2 max-w-xl">{state.message}</p>
        <p className="text-white/60 mb-8 max-w-xl text-sm">
          This link stays valid, so try again in a minute. Please do not buy again: if it
          keeps failing, write to support@digitalpolyglot.com and we will add them by hand.
        </p>

        {state.books.length > 0 && (
          <div className="grid gap-6 sm:grid-cols-2 max-w-3xl mb-8">
            {state.books.map((book) => (
              <div
                key={book.id}
                className="bg-white/10 rounded-2xl p-4 flex flex-col items-center"
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
        )}

        <div className="flex flex-wrap gap-3 justify-center">
          <button
            type="button"
            onClick={retry}
            className="px-6 py-2 bg-white text-[#0D1B2A] rounded-xl hover:bg-gray-200 transition"
          >
            Try again
          </button>
          <a
            href="mailto:support@digitalpolyglot.com"
            className="px-6 py-2 border border-white/40 rounded-xl hover:bg-white/10 transition"
          >
            Contact support
          </a>
        </div>
      </main>
    );
  }

  if (state.status === "needsAuth") {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center bg-[#0D1B2A] text-white px-8 text-center">
        <h1 className="text-3xl font-semibold mb-4">Almost there</h1>
        <p className="text-white/80 mb-8">{state.message}</p>

        {state.books.length > 0 && (
          <div className="grid gap-6 sm:grid-cols-2 max-w-3xl">
            {state.books.map((book) => (
              <div
                key={book.id}
                className="bg-white/10 rounded-2xl p-4 flex flex-col items-center"
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
        )}

        <a
          href={`/sign-in?redirect_url=${encodeURIComponent(`/claim/${token}`)}`}
          className="mt-10 px-6 py-2 bg-white text-[#0D1B2A] rounded-xl hover:bg-gray-200 transition"
        >
          Sign in to add them
        </a>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-[#0D1B2A] text-white px-8 text-center relative">
      <div className="absolute top-4 right-4">
        <UserButton afterSignOutUrl="/" />
      </div>

      <h1 className="text-3xl font-semibold mb-4">
        {state.alreadyOwned
          ? "These books were already in your library"
          : "Books added to your account"}
      </h1>
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
