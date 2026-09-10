import { prisma } from "@/lib/prisma";

/**
 * Que idiomas se pueden elegir de verdad y cuales van con "Coming soon".
 *
 * Vivia dentro de `/api/mobile/languages`, asi que la app lo sabia y la web no:
 * el selector del onboarding web era una lista fija de seis nombres sin ninguna
 * senal de disponibilidad, y quien elegia frances terminaba el onboarding en
 * una historia de otro idioma. Aqui hay una sola fuente para las dos.
 *
 * Un idioma esta VIVO cuando tiene al menos un Journey no archivado ni
 * borrador. Tener journey y cero historias publicadas no lo hace "coming soon":
 * eso sale como tema vacio en la malla, que es otra cosa.
 */

export type LanguageAvailability = {
  /** Slug canonico en minusculas: "spanish", "french". */
  code: string;
  label: string;
  comingSoon: boolean;
  variants: Array<{ code: string; label: string; comingSoon: boolean }>;
};

export async function getLanguageAvailability(): Promise<LanguageAvailability[]> {
  const [languages, journeys] = await Promise.all([
    prisma.language.findMany({
      orderBy: { sortOrder: "asc" },
      include: { variants: { orderBy: { sortOrder: "asc" } } },
    }),
    prisma.journey.findMany({
      where: { status: { notIn: ["archived", "draft"] } },
      select: { language: true, variant: true },
    }),
  ]);

  const languagesWithJourneys = new Set(
    journeys.map((j) => j.language.trim().toLowerCase())
  );
  // Disponibilidad por (idioma, variante): un idioma puede estar vivo en
  // general y tener una variante sin nada (espanol tiene LATAM y no Spain),
  // asi que el selector necesita poder apagar solo esa.
  const journeyVariantPairs = new Set(
    journeys
      .filter((j) => j.variant)
      .map((j) => `${j.language.trim().toLowerCase()}:${j.variant!.trim().toLowerCase()}`)
  );

  return languages.map((lang) => {
    const langKey = lang.code.trim().toLowerCase();
    return {
      code: langKey,
      label: lang.label,
      comingSoon: !languagesWithJourneys.has(langKey),
      variants: lang.variants.map((v) => ({
        code: v.code,
        label: v.label,
        comingSoon: !journeyVariantPairs.has(`${langKey}:${v.code.trim().toLowerCase()}`),
      })),
    };
  });
}

/**
 * Los idiomas que se pueden elegir HOY, en minusculas.
 *
 * Lo que NO esta en la lista va con "Coming soon", y eso incluye a los que ni
 * siquiera estan en el catalogo de Studio (el japones del selector web, el
 * chino de la app). Preguntar "esta disponible" en vez de "esta marcado como
 * proximamente" es lo que hace que un idioma nuevo no se cuele por el hueco.
 */
export async function getAvailableLanguageCodes(): Promise<string[]> {
  const rows = await getLanguageAvailability();
  return rows.filter((r) => !r.comingSoon).map((r) => r.code);
}
