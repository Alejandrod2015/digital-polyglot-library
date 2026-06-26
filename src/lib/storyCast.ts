/**
 * Single source of truth for a story's characters: name, role, age band and
 * gender. Both the COVER prompt (to render the right ages/genders and keep the
 * characters' names) and the VOICE-selection pipeline read from here, so the
 * illustration and the audio never drift apart (e.g. an elderly man on the
 * cover but a 40-year-old voice in the audio).
 *
 * This is the local seed. The canonical home is `JourneyStory.cast` (Json) in
 * the Prisma schema; it is intentionally NOT migrated to the prod DB yet. Until
 * the migration ships, `getStoryCast` reads this map first and any future
 * DB-backed cast second. The story generator should emit this object directly
 * (it already knows the characters as it writes), making the map obsolete.
 */

export type AgeBand =
  | "child" // ~5-12
  | "teen" // ~13-17
  | "young-adult" // ~18-30
  | "adult" // ~30-50
  | "older-adult" // ~50-65
  | "elderly"; // ~65+

export type Gender = "f" | "m" | "nb";

export interface CastMember {
  name: string;
  role: string; // narrative role, e.g. "padre viudo", "hermana que vuelve"
  ageBand: AgeBand;
  gender: Gender;
  /** false when the character is referenced/absent (dead, away) but not on-page. */
  present?: boolean;
}

export interface StoryCast {
  characters: CastMember[];
}

/** Human-readable age phrase for an image prompt. */
const AGE_PHRASE: Record<AgeBand, string> = {
  child: "a child (around 8 years old)",
  teen: "a teenager",
  "young-adult": "a young adult in their twenties",
  adult: "an adult in their thirties or forties",
  "older-adult": "a person in their fifties or early sixties",
  elderly: "an elderly person (around seventy)",
};

const GENDER_NOUN: Record<Gender, string> = { f: "woman", m: "man", nb: "person" };

/** Seeded casts, keyed by JourneyStory.id. */
const SEED: Record<string, StoryCast> = {
  // Domingo con papá; A1, home-family, Bogotá.
  // Narrated by Valeria (adult LATAM woman), single narrator. The cover must
  // read consistent with that voice: an ADULT register, not an aged one. Both
  // Marina and Hernán are adults (thirties/forties); Hernán is the father but
  // is drawn as a fit middle-aged man, NOT a grey, lined, elderly figure; a
  // visibly old man clashes with the adult-woman narration the listener hears.
  cmpqkibj70001326n3vpbzwvj: {
    characters: [
      { name: "Marina", role: "hija (ancla, = la voz narradora), joven, rostro fresco", ageBand: "young-adult", gender: "f", present: true },
      { name: "Hernán", role: "padre maduro de unos cuarenta y muchos, sienes con leves canas, rostro amable y en forma, presencia cálida secundaria", ageBand: "adult", gender: "m", present: true },
      { name: "la madre", role: "esposa fallecida (ausente)", ageBand: "adult", gender: "f", present: false },
    ],
  },
  // Una pizca de canela; A1, home-family, Cuenca.
  cmpr20r56000132b8a7pqugsv: {
    characters: [
      { name: "Lucía", role: "hermana en casa", ageBand: "adult", gender: "f", present: true },
      { name: "Daniela", role: "hermana que vuelve de Madrid", ageBand: "adult", gender: "f", present: true },
    ],
  },
};

export function getStoryCast(storyId: string): StoryCast | null {
  return SEED[storyId] ?? null;
}

/**
 * Build the character description block for a cover image prompt: keeps the
 * real names and pins the age/gender of every on-page character, plus any
 * meaningful absent character (e.g. an empty place at the table).
 */
export function castToCoverLines(cast: StoryCast): string {
  const present = cast.characters.filter((c) => c.present !== false);
  const absent = cast.characters.filter((c) => c.present === false);
  const lines: string[] = [];
  if (present.length > 0) {
    lines.push(
      "Characters present, render their ages and genders exactly: " +
        present
          .map((c) => `${c.name}, ${AGE_PHRASE[c.ageBand]} ${GENDER_NOUN[c.gender]} (${c.role})`)
          .join("; ") +
        ".",
    );
  }
  if (absent.length > 0) {
    lines.push(
      "Acknowledge but do NOT draw these absent characters: " +
        absent.map((c) => `${c.name} (${c.role})`).join("; ") +
        ".",
    );
  }
  return lines.join(" ");
}
