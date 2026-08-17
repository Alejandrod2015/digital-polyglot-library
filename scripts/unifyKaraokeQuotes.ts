/**
 * Pasa a comillas inglesas “ ” la copia congelada del texto que vive dentro de
 * `audioWordTimings.storyPlainText`, que es LO QUE EL LECTOR RENDERIZA de
 * verdad (src/components/HighlightedStoryContent.tsx). Sin esto, cambiar el
 * `text` de la historia deja el karaoke mostrando las comillas viejas.
 *
 *   npx tsx scripts/unifyKaraokeQuotes.ts --journey <id> --topics a,b,c [--apply]
 *
 * El swap es 1:1 en caracteres, así que todos los offsets charStart/charEnd
 * siguen apuntando al mismo sitio. El script lo verifica por historia y NO
 * escribe si alguna cambia de longitud. Sin --apply solo informa.
 */
import { config } from "dotenv"; config({ path: ".env", quiet: true }); config({ path: ".env.local", quiet: true });
import { PrismaClient } from "../src/generated/prisma";

const p = new PrismaClient();
const LQ = "“", RQ = "”";

function toCurly(s: string): { out: string; odd: boolean } {
  let out = s
    .replace(/«([^»«]*)»/g, (_m, i) => LQ + i + RQ)
    .replace(/»([^«»]*)«/g, (_m, i) => LQ + i + RQ)
    .replace(/„([^"„]*)"/g, (_m, i) => LQ + i + RQ);
  // Comillas SIMPLES en par: solo son comillas si la apertura no va pegada a
  // una letra (pegada = elisión: pa', un po', de' Fiori, geht's).
  out = out.replace(/(^|[^\p{L}\p{N}])'([^'\n]{2,70})'/gu, (_m, pre, inner) => `${pre}${LQ}${inner}${RQ}`);
  const straight = (out.match(/"/g) || []).length;
  if (straight % 2 === 1) return { out, odd: true };
  let open = true;
  out = out.replace(/"/g, () => { const c = open ? LQ : RQ; open = !open; return c; });
  return { out, odd: false };
}

const arg = (n: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : undefined; };

(async () => {
  const journeyId = arg("journey");
  const topics = (arg("topics") ?? "").split(",").filter(Boolean);
  const all = process.argv.includes("--all");
  const apply = process.argv.includes("--apply");
  if (!journeyId && !all) { console.error("usage: --journey <id> [--topics a,b,c] | --all  [--apply]"); process.exit(2); }

  const rows = await p.journeyStory.findMany({
    where: all
      ? { journey: { is: { status: { in: ["active", "draft"] } } } }
      : { journeyId, ...(topics.length ? { topic: { in: topics } } : {}) },
    orderBy: [{ topic: "asc" }, { slotIndex: "asc" }],
    select: { id: true, slug: true, topic: true, slotIndex: true, audioWordTimings: true },
  });

  let changed = 0, skipped = 0;
  for (const r of rows) {
    const payload = r.audioWordTimings as { storyPlainText?: string } | null;
    if (!payload?.storyPlainText) { console.log(`  - ${r.slug}: sin word timings`); skipped++; continue; }
    const { out, odd } = toCurly(payload.storyPlainText);
    if (odd) { console.error(`  ! ${r.slug}: comilla recta impar, se deja intacto`); skipped++; continue; }
    if (out.length !== payload.storyPlainText.length) {
      console.error(`  ! ${r.slug}: la longitud cambia (${payload.storyPlainText.length} -> ${out.length}). ABORTA.`);
      process.exit(1);
    }
    if (out === payload.storyPlainText) { console.log(`  = ${r.slug}: ya estaba en inglesas`); continue; }
    if (apply) {
      await p.journeyStory.update({
        where: { id: r.id },
        data: { audioWordTimings: { ...(payload as object), storyPlainText: out } },
      });
    }
    console.log(`  ${apply ? "✓" : "·"} ${r.slug}`);
    changed++;
  }
  console.log(`\n${changed} payloads ${apply ? "actualizados" : "a actualizar"} · ${skipped} saltados${apply ? "" : "  (usa --apply para escribir)"}`);
})().finally(() => p.$disconnect());
