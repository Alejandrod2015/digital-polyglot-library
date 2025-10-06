"use client";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Menu, X, ChevronDown, ArrowLeft } from "lucide-react";
import Sidebar from "./Sidebar";

export default function MobileMenu() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Detecta si estamos en modo lectura (tiene storySlug en la URL)
  const isStoryPage = /^\/books\/[^/]+\/[^/]+$/.test(pathname || "");
  // Detecta si estamos en página de libro (pero no historia)
  const isBookPage = /^\/books\/[^/]+$/.test(pathname || "");

  // 👇 Cierra el sidebar automáticamente cuando cambia la ruta
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  if (isStoryPage) {
    // 👉 En modo historia: mostrar chevron hacia abajo (solo en mobile)
    const bookSlug = pathname?.split("/")[2];
    return (
      <div className="fixed top-0 left-0 z-30 p-4 md:hidden">
        <Link href={`/books/${bookSlug}`} className="text-white">
          <ChevronDown size={28} />
        </Link>
      </div>
    );
  }

  if (isBookPage) {
    // 👉 En página de libro: mostrar flecha al listado de libros (solo en mobile)
    return (
      <div className="fixed top-0 left-0 z-30 p-4 md:hidden">
        <Link href="/books" className="text-white">
          <ArrowLeft size={28} />
        </Link>
      </div>
    );
  }

  // 👉 En cualquier otra página: mostrar hamburguesa normal (solo en mobile)
  return (
    <div className="md:hidden">
      {/* Botón hamburguesa */}
      <button
        onClick={() => setOpen(true)}
        className="p-4 text-white fixed top-0 left-0 z-30"
      >
        <Menu size={28} />
      </button>

      {/* Overlay oscuro */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 bg-black bg-opacity-50 z-20"
        />
      )}

      {/* Sidebar deslizante */}
      <div
        className={`fixed top-0 left-0 h-full w-64 bg-[#0B132B] z-30 transform transition-transform duration-300 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Botón cerrar */}
        <button
          onClick={() => setOpen(false)}
          className="absolute top-4 right-4 text-white"
        >
          <X size={28} />
        </button>

        {/* Sidebar */}
        <Sidebar />
      </div>
    </div>
  );
}
