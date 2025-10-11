// src/app/books/[bookSlug]/layout.tsx

export default function BookLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Hacemos pública la página del libro.
  // La verificación de acceso solo se aplica dentro de las historias.
  return <>{children}</>;
}
