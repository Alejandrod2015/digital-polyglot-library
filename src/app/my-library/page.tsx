// /src/app/my-library/page.tsx
// Server component — igual patrón que ExplorePage

import MyLibraryClient from "./MyLibraryClient";

export const revalidate = 300;

export default async function MyLibraryPage() {
  // No lógica aquí — todo vive en el client
  return <MyLibraryClient />;
}
