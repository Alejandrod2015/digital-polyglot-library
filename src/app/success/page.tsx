// DESPUÉS
import Link from "next/link";

export default function SuccessPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gray-950 text-white">
      <h1 className="text-4xl font-bold mb-4">✅ Payment successful!</h1>
      <p className="text-lg text-gray-300 mb-8">
        Your subscription is now active. You can close this page and start exploring all stories.
      </p>
      <Link
        href="/"
        className="px-6 py-3 bg-indigo-600 rounded-xl hover:bg-indigo-700 transition"
      >
        Go back to Digital Polyglot
      </Link>
    </main>
  );
}
