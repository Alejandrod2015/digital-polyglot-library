import type { Metadata } from "next";
import JourneyClient from "./JourneyClient";
import { loadJourneyPageProps } from "./journeyPageLoader";
import {
  getJourneyShareMeta,
  journeyShareDescription,
  journeyShareTitle,
  siteOrigin,
} from "./journeyMeta";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Metadata POR JOURNEY. Antes era estática, así que todos los journeys se
// anunciaban igual: mismo título, misma descripción y ninguna imagen. Pegado en
// una red social, uno de alemán y uno de español se veían idénticos, aunque el
// enlace en sí ya funcionaba (la URL con ?variant= renderiza el journey entero
// a un visitante sin sesión).
//
// No depende de quién mira: se resuelve solo desde el journey, para que lo que
// ve quien recibe el enlace sea lo mismo que vio quien lo compartió.
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ variant?: string }>;
}): Promise<Metadata> {
  const { variant } = await searchParams;
  const meta = await getJourneyShareMeta(variant);
  if (!meta) {
    return {
      title: "Journey | Digital Polyglot",
      description: "Move through language by level and topic, one journey at a time.",
    };
  }

  const title = journeyShareTitle(meta);
  const description = journeyShareDescription(meta);
  const url = `/journey?variant=${encodeURIComponent(meta.slug)}`;
  const image = `/api/og/journey?variant=${encodeURIComponent(meta.slug)}`;

  return {
    // Sin metadataBase, Next resuelve la imagen contra localhost y la
    // previsualización sale rota en producción.
    metadataBase: siteOrigin(),
    title: `${title} | Digital Polyglot`,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      title,
      description,
      url,
      images: [{ url: image, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

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
