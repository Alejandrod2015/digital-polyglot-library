/**
 * lint:vulgar-register. Ninguna palabra vulgar llega al lector sin su marca.
 *
 * El check `vocab-vulgar-register` del validador protege lo que se guarda a
 * partir de ahora; esto barre lo que YA esta en la base, que es donde nacio el
 * problema: el 2026-09-10 el Friends latam C1 tenia cero plazas con register
 * "vulgar" y un tester lo encontro tocando "culero" en Android.
 *
 * Mira dos sitios, porque el lector pinta desde los dos:
 *   1. el vocab curado de toda historia de un journey live o draft
 *   2. las glosas de tap-any-word (TapGlossSet): una palabra vulgar sin `r`
 *      sale en la tarjeta de quick lookup sin aviso
 *
 * La regla y el lexico viven en src/lib/vulgarVocab.ts, el mismo archivo que
 * usa el validador.
 *
 * Run:  npm run lint:vulgar-register          (exit 1 si hay alguna)
 *       npx tsx scripts/checkVulgarRegister.ts --json   (lista para arreglar)
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { vulgarSinMarcar, esVulgarPorLexico, glosaDiceVulgar } from "../src/lib/vulgarVocab";

type FalloVocab = { journeyId: string; journey: string; slug: string; topic: string; slotIndex: number; word: string; register: string | null; motivo: string };
type FalloGlosa = { bundle: string; slug: string; clave: string; r: string | null };

(async () => {
  const p = new PrismaClient();
  try {
    const journeys = await p.journey.findMany({
      where: { status: { in: ["active", "draft"] } },
      select: { id: true, name: true, language: true, variant: true, status: true },
    });
    const porId = new Map(journeys.map((j) => [j.id, j]));
    const historias = await p.journeyStory.findMany({
      where: { journeyId: { in: journeys.map((j) => j.id) } },
      select: { journeyId: true, slug: true, topic: true, slotIndex: true, vocab: true },
    });

    const vocab: FalloVocab[] = [];
    for (const h of historias) {
      const j = porId.get(h.journeyId)!;
      for (const f of vulgarSinMarcar((h.vocab ?? []) as never[], j.language, j.variant)) {
        vocab.push({
          journeyId: j.id, journey: `${j.status} ${j.language}/${j.variant} ${j.name}`,
          slug: h.slug ?? "?", topic: h.topic, slotIndex: h.slotIndex, ...f,
        });
      }
    }

    const glosas: FalloGlosa[] = [];
    const sets = await p.tapGlossSet.findMany({ select: { bundle: true, slug: true, language: true, variant: true, glosses: true } });
    for (const s of sets) {
      const mapa = (s.glosses ?? {}) as Record<string, { g?: string; r?: string }>;
      for (const [clave, g] of Object.entries(mapa)) {
        if (!g || (g.r ?? "").toLowerCase() === "vulgar") continue;
        if (esVulgarPorLexico(clave, s.language, s.variant) || glosaDiceVulgar(g.g)) {
          glosas.push({ bundle: s.bundle, slug: s.slug, clave, r: g.r ?? null });
        }
      }
    }

    if (process.argv.includes("--json")) {
      console.log(JSON.stringify({ vocab, glosas }, null, 1));
      return;
    }
    if (!vocab.length && !glosas.length) {
      console.log("lint:vulgar-register: ninguna palabra vulgar sin marcar.");
      return;
    }
    console.error(`lint:vulgar-register: ${vocab.length} plaza(s) de vocab y ${glosas.length} glosa(s) vulgares sin register "vulgar".`);
    for (const f of vocab) console.error(`  vocab  ${f.journey} · ${f.slug}: ${f.word} [${f.register ?? "sin register"}] (${f.motivo})`);
    for (const g of glosas.slice(0, 60)) console.error(`  glosa  ${g.bundle}/${g.slug || "(global)"}: ${g.clave} [${g.r ?? "sin r"}]`);
    if (glosas.length > 60) console.error(`  ... y ${glosas.length - 60} glosas mas (--json para la lista entera)`);
    console.error(`\n  Vocab: npx tsx scripts/saveStory.ts <data.json> --journey <id> --register-only`);
    process.exitCode = 1;
  } finally {
    await p.$disconnect();
  }
})();
