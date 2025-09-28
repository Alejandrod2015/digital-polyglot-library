import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Digital Polyglot",
  description: "Librería de cuentos con audio",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
