/**
 * El tipo de journey se exige al CREARLO.
 *
 * Antes del 2026-08-18 no se guardaba en ninguna parte y se adivinaba por el
 * nombre, que es justo lo que el plan prohíbe ("el nombre nunca es el tipo").
 *
 *   npx tsx scripts/_journeyTypeTest.ts
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { assertJourneyType, JourneyTypeError, FIXED_CAST_BY_TYPE, ORDERED_TYPES } from "../src/lib/journeyType";

const TIPOS = ["conversational", "traveler", "business", "expat", "academic", "cultural", "hospitality", "health"];
const fake = { journeyType: { findMany: async () => TIPOS.map((slug) => ({ slug, label: slug })) } };

let fallos = 0;
const ok = (cond: boolean, nota: string) => {
  if (cond) console.log(`ok    ${nota}`);
  else { console.log(`FALLO ${nota}`); fallos++; }
};

(async () => {
  for (const slug of TIPOS) {
    const r = await assertJourneyType({ typeSlug: slug, name: "X", prisma: fake }).catch(() => null);
    ok(r === slug, `acepta "${slug}"`);
  }
  for (const malo of ["", "   ", null, undefined]) {
    const r = await assertJourneyType({ typeSlug: malo, name: "X", prisma: fake }).then(() => "pasó").catch((e) => e);
    ok(r instanceof JourneyTypeError, `rechaza tipo vacío (${JSON.stringify(malo)})`);
  }
  for (const malo of ["viajero", "Traveler", "expatriado", "friends"]) {
    const r = await assertJourneyType({ typeSlug: malo, name: "X", prisma: fake }).then(() => "pasó").catch((e) => e);
    ok(r instanceof JourneyTypeError, `rechaza tipo inventado "${malo}"`);
  }

  // El plan: nunca más de 2 fijos, y solo Expat y Academic llevan orden obligado.
  ok(TIPOS.every((t) => FIXED_CAST_BY_TYPE[t] >= 1 && FIXED_CAST_BY_TYPE[t] <= 2), "ningún tipo pasa de 2 fijos");
  ok(FIXED_CAST_BY_TYPE.traveler === 2 && FIXED_CAST_BY_TYPE.expat === 1, "traveler 2 fijos, expat 1");
  ok(ORDERED_TYPES.has("expat") && ORDERED_TYPES.has("academic") && ORDERED_TYPES.size === 2, "orden obligado solo en expat y academic");

  console.log(`\n${fallos === 0 ? "✓ el tipo es obligatorio y coherente con el plan" : `✗ ${fallos} fallos`}`);
  process.exit(fallos ? 1 : 0);
})();
