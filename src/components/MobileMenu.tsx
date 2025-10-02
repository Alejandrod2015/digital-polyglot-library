"use client";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import Sidebar from "./Sidebar";

export default function MobileMenu() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // 👇 Cierra el sidebar automáticamente cuando cambia la ruta
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

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

        {/* Sidebar (links normales, sin onClose necesario) */}
        <Sidebar />
      </div>
    </div>
  );
}
