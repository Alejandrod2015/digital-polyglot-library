import germanExpat from "@/data/tapGlosses/german-expat.json";
import germanHamburg from "@/data/tapGlosses/german-hamburg.json";
import germanFriends from "@/data/tapGlosses/german-friends.json";
import frenchTraveler from "@/data/tapGlosses/french-traveler.json";
import spanishFriends from "@/data/tapGlosses/spanish-friends.json";
import spanishFriendsColombia from "@/data/tapGlosses/spanish-friends-colombia.json";
import spanishFriendsArgentina from "@/data/tapGlosses/spanish-friends-argentina.json";
import spanishFriendsSpainA0 from "@/data/tapGlosses/spanish-friends-spain-a0.json";
import spanishTravelerMexicoA0 from "@/data/tapGlosses/spanish-traveler-mexico-a0.json";
import spanishFriendsMexico from "@/data/tapGlosses/spanish-friends-mexico.json";
import italianFriendsA0 from "@/data/tapGlosses/italian-friends-a0.json";
import germanTravelerA0 from "@/data/tapGlosses/german-traveler-a0.json";

// Piloto "tap any word" (2026-07-06): glosses contextuales autorados por
// historia/journey, precomputados en el repo. El reader envuelve cada
// palabra con gloss en un span tapeable; las 20-25 curadas del vocab[]
// siguen intactas como pills (capa de enseñanza). Este archivo decide
// qué historias participan; hoy solo el journey Expat alemán C1.
//
// Cada entrada: { g: gloss en inglés, t: tipo gramatical } donde t usa las
// mismas claves que el vocab curado (verb|noun|adjective|adverb|pronoun|
// preposition|conjunction|article|number|expression|other) para reusar los colores
// de badge y clasificar bien los favoritos guardados desde el diccionario.
export type TapGloss = { g: string; t: string; r?: string };

type TapGlossBundle = {
  slugs: string[];
  glosses: Record<string, TapGloss>;
};

const BUNDLES: TapGlossBundle[] = [
  germanExpat as TapGlossBundle,
  germanHamburg as TapGlossBundle,
  germanFriends as TapGlossBundle,
  frenchTraveler as TapGlossBundle,
  spanishFriends as TapGlossBundle,
  spanishFriendsColombia as TapGlossBundle,
  spanishFriendsArgentina as TapGlossBundle,
  spanishFriendsSpainA0 as TapGlossBundle,
  spanishTravelerMexicoA0 as TapGlossBundle,
  spanishFriendsMexico as TapGlossBundle,
  italianFriendsA0 as TapGlossBundle,
  germanTravelerA0 as TapGlossBundle,
];

export function getTapGlossesForSlug(slug: string): Record<string, TapGloss> | null {
  for (const bundle of BUNDLES) {
    if (bundle.slugs.includes(slug)) return bundle.glosses;
  }
  return null;
}
