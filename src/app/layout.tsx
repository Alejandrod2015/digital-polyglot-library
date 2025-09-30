import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import Navbar from "../components/Navbar"; // ruta relativa para evitar problemas

export const metadata: Metadata = {
  title: "Digital Polyglot",
  description: "Library of stories with audio",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-black text-white">
        <ClerkProvider publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}>
          <Navbar />
          <main className="p-6">{children}</main>
        </ClerkProvider>
      </body>
    </html>
  );
}
