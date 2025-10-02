"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export default function BackButton() {
  const router = useRouter();

  return (
    <button
      onClick={() => router.push("/books")}
      className="flex items-center gap-2 px-3 py-2 text-white hover:text-yellow-400 transition"
    >
      <ArrowLeft className="w-5 h-5" />
      <span>Back</span>
    </button>
  );
}
