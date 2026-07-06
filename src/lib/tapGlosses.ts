import germanExpat from "@/data/tapGlosses/german-expat.json";

// Piloto "tap any word" (2026-07-06): glosses contextuales autorados por
// historia/journey, precomputados en el repo. El reader envuelve cada
// palabra con gloss en un span tapeable; las 20-25 curadas del vocab[]
// siguen intactas como pills (capa de enseñanza). Este archivo decide
// qué historias participan; hoy solo el journey Expat alemán C1.
type TapGlossBundle = {
  slugs: string[];
  glosses: Record<string, string>;
};

const BUNDLES: TapGlossBundle[] = [germanExpat as TapGlossBundle];

export function getTapGlossesForSlug(slug: string): Record<string, string> | null {
  for (const bundle of BUNDLES) {
    if (bundle.slugs.includes(slug)) return bundle.glosses;
  }
  return null;
}
