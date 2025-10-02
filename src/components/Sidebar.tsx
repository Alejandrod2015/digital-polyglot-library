"use client";
import Link from "next/link";
import Image from "next/image";
import {
  BookOpen,
  Star,
  Gift,
  BookMarked,
  Settings,
} from "lucide-react";

interface SidebarProps {
  onClose?: () => void;
}

export default function Sidebar({ onClose }: SidebarProps) {
  return (
    <div className="flex flex-col h-full w-full bg-[#0B132B] text-white p-6">
      {/* Logo */}
      <div className="mb-5 flex justify-center">
        <Link href="/" onClick={onClose}>
          <Image
            src="/digital-polyglot-logo.png" // asegúrate de que está en /public
            alt="Digital Polyglot"
            width={180}   // 👈 ajusta el tamaño
            height={180}
            priority
          />
        </Link>
      </div>

      {/* Navegación */}
      <nav className="flex flex-col space-y-6 text-lg font-medium">
        <Link
          href="/books"
          onClick={onClose}
          className="flex items-center gap-3 hover:text-blue-400 transition-colors"
        >
          <BookOpen size={22} /> Books
        </Link>

        <Link
          href="/favorites"
          onClick={onClose}
          className="flex items-center gap-3 hover:text-yellow-400 transition-colors"
        >
          <Star size={22} /> Favorites
        </Link>

        <Link
          href="/freebies"
          onClick={onClose}
          className="flex items-center gap-3 hover:text-green-400 transition-colors"
        >
          <Gift size={22} /> Freebies
        </Link>

        <Link
          href="/story-of-the-day"
          onClick={onClose}
          className="flex items-center gap-3 hover:text-pink-400 transition-colors"
        >
          <BookMarked size={22} /> Story of the Day
        </Link>

        <Link
          href="/settings"
          onClick={onClose}
          className="flex items-center gap-3 hover:text-gray-400 transition-colors"
        >
          <Settings size={22} /> Settings
        </Link>
      </nav>

      {/* Footer */}
      <div className="mt-auto text-xs text-gray-400">
        © {new Date().getFullYear()} Digital Polyglot
      </div>
    </div>
  );
}
