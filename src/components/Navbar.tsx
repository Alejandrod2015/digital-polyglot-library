'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Navbar() {
  const pathname = usePathname();

  const linkClasses = (path: string) =>
    `px-4 py-2 rounded transition ${
      pathname === path
        ? 'bg-[#3170d3] text-white' // azul de marca
        : 'text-[#cccccc] hover:bg-[#61bbb7] hover:text-black' // gris claro → hover teal
    }`;

  return (
    <nav className="fixed top-0 left-0 w-full bg-[#1b263b] shadow-md z-50">
      <div className="flex justify-center gap-6 py-3">
        <Link href="/books" className={linkClasses('/books')}>
          📚 Library
        </Link>
        <Link href="/favorites" className={linkClasses('/favorites')}>
          ⭐ Favorites
        </Link>
        <Link href="/settings" className={linkClasses('/settings')}>
          ⚙️ Settings
        </Link>
      </div>
    </nav>
  );
}
