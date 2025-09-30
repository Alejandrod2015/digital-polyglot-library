import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import Navbar from "../components/Navbar"; // 👈 asegúrate de que está aquí

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
          <main className="pt-16 p-6">{children}</main>
        </ClerkProvider>
      </body>
    </html>
  );
}
