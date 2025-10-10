import AccessClient from './AccessClient';

export default async function BookLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ bookSlug: string }>;
}) {
  const { bookSlug } = await params;

  return <AccessClient bookSlug={bookSlug}>{children}</AccessClient>;
}
