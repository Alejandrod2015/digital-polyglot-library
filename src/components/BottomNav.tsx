"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function BottomNav() {
  const pathname = usePathname();

  const linkClasses = (path: string) =>
    `px-4 py-2 rounded transition ${
      pathname === path
        ? "bg-[#3170d3] text-white"
        : "text-[#cccccc] hover:bg-[#61bbb7] hover:text-black"
    }`;

  return (
    <nav className="fixed bottom-0 left-0 w-full bg-[#0D1B2A] shadow-md z-10">
      <div className="flex justify-center gap-6 py-3">
        <Link href="/books" className={linkClasses("/books")}>
          📚 Library
        </Link>
        <Link href="/favorites" className={linkClasses("/favorites")}>
          Favorites
        </Link>
        <Link href="/settings" className={linkClasses("/settings")}>
          ⚙️ Settings
        </Link>
      </div>
    </nav>
  );
}
