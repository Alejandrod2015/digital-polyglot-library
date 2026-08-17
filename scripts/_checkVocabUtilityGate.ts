/**
 * Comprueba que el nuevo check `vocab-utility` DISPARA de verdad dentro del
 * validador canónico, sobre historias reales. SOLO LECTURA, no guarda nada.
 */
import { PrismaClient } from "../src/generated/prisma";
import { validateGeneratedStory } from "../src/lib/validateGeneratedStory";

const prisma = new PrismaClient();
const SLUGS = ["duzen-auf-eigene-gefahr", "umzug-ohne-aufzug", "cafe-y-pan-de-yema"];

async function main() {
  for (const slug of SLUGS) {
    const s = await prisma.journeyStory.findFirst({
      where: { slug },
      select: { title: true, slug: true, text: true, synopsis: true, arcType: true, vocab: true, level: true },
    });
    if (!s) { console.log(`${slug}: no encontrada`); continue; }
    const payload = {
      title: s.title ?? "",
      slug: s.slug ?? "",
      text: s.text ?? "",
      synopsis: s.synopsis ?? "",
      arcType: s.arcType ?? "",
      vocab: (Array.isArray(s.vocab) ? s.vocab : []) as never,
    } as never;
    const res = await validateGeneratedStory(payload, { level: (s.level ?? "").toUpperCase() });
    const check = res.checks.find((c) => c.id === "vocab-utility");
    const vocabCount = Array.isArray(s.vocab) ? s.vocab.length : 0;
    console.log(`\n── ${slug}  (vocab ${vocabCount}, margen sobre el minimo de 20: ${vocabCount - 20})`);
    console.log(`   vocab-utility: ${check?.status ?? "AUSENTE"}`);
    if (check && check.status !== "pass") console.log(`   ${check.detail}`);
  }
}
main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
