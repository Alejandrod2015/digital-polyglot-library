export default function BookLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Este layout actúa como “barrera” entre la página del libro y sus historias.
  // No renderiza contenido del libro, solo los children.
  return <>{children}</>;
}
