import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import Sidebar from "../components/Sidebar";
import MobileMenu from "../components/MobileMenu";
import BackNavigationHandler from "@/components/BackNavigationHandler";

export const metadata: Metadata = {
  title: "Digital Polyglot",
  description: "Library of stories with audio",
  icons: {
    icon: [
      { url: "/favicon/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon/favicon.ico" },
    ],
    apple: "/favicon/apple-touch-icon.png",
  },
  manifest: "/favicon/site.webmanifest",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="bg-[#121212]">
      <head>
        {/* Android: status bar oscura */}
        <meta name="theme-color" content="#0D1B2A" />
        {/* iOS: status bar translúcida */}
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />
      </head>

      <body className="bg-[#121212] text-[#E0E0E0]">
        <ClerkProvider publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}>
          <div className="flex h-screen w-screen">
            {/* Sidebar fijo en desktop */}
            <aside className="hidden md:flex md:w-64 bg-[#0B132B] fixed top-0 left-0 bottom-0 z-20">
              <Sidebar />
            </aside>

            {/* Botón menú lateral solo en móvil */}
            <MobileMenu />

            {/* Contenido principal */}
            <div className="flex-1 flex flex-col md:ml-64">
              {/* 👇 Componente cliente para manejar navegación atrás */}
              <BackNavigationHandler />
              <main className="flex-1 overflow-y-auto p-6 pb-40 md:pb-32">
                {children}
              </main>
            </div>
          </div>
        </ClerkProvider>
      </body>
    </html>
  );
}