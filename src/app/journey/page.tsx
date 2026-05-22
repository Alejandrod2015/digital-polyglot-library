import JourneyClient from "./JourneyClient";
import { loadJourneyPageProps } from "./journeyPageLoader";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Journey | Digital Polyglot",
  description: "Move through language by level and topic, one journey at a time.",
};

export default async function JourneyPage({
  searchParams,
}: {
  searchParams: Promise<{ variant?: string }>;
}) {
  const { variant } = await searchParams;
  // `basePath: "/journey"` mantiene la URL en /journey?variant=... al
  // entrar sin variant. Misma lógica que la home polyglot usa con "/"
  // → un solo loader, dos puntos de entrada.
  const props = await loadJourneyPageProps({ variant, basePath: "/journey" });
  return <JourneyClient {...props} />;
}
