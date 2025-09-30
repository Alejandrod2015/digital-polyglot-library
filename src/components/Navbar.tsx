'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Navbar() {
  const pathname = usePathname();

  const linkClasses = (path: string) =>
    `px-4 py-2 rounded ${
      pathname === path
        ? 'bg-blue-600 text-white'
        : 'text-gray-300 hover:bg-gray-700'
    }`;

  return (
    <nav className="bg-gray-900 p-4 flex gap-4 shadow-lg">
      <Link href="/books" className={linkClasses('/books')}>
        📚 Library
      </Link>
      <Link href="/favorites" className={linkClasses('/favorites')}>
        ⭐ Favorites
      </Link>
      <Link href="/settings" className={linkClasses('/settings')}>
        ⚙️ Settings
      </Link>
    </nav>
  );
}
