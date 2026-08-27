import { config } from "dotenv"; config({ path: ".env.local", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
const OBJETIVO = [
  ["portuguese", "brazil", "a1"], ["spanish", "latam", "a1"],
  ["spanish", "mexico", "a0"], ["spanish", "spain", "a2"],
];
async function main() {
  const filas = await p.tapGlossSet.findMany({ select: { bundle: true, slug: true, slugs: true } });
  const dueno = new Map<string, string>();
  for (const f of filas) if (f.slug === "") for (const s of f.slugs) dueno.set(s, f.bundle);
  const conCapa = new Set(filas.filter((f) => f.slug !== "").map((f) => f.slug));
  for (const [lang, vari, lvl] of OBJETIVO) {
    const js = await p.journey.findMany({
      where: { status: { in: ["active", "draft"] }, language: lang, variant: vari, levels: { has: lvl } },
      select: { id: true, name: true, stories: { select: { slug: true, topic: true, slotIndex: true }, orderBy: [{ topic: "asc" }, { slotIndex: "asc" }] } },
    });
    for (const j of js) {
      const slugs = j.stories.map((s) => s.slug).filter(Boolean) as string[];
      const bundles = [...new Set(slugs.map((s) => dueno.get(s) ?? "SIN BUNDLE"))];
      const faltan = slugs.filter((s) => !conCapa.has(s));
      console.log(`\n${j.name} ${lang}/${vari}/${lvl}  id=${j.id}`);
      console.log(`  bundle: ${bundles.join(", ")}   historias ${slugs.length}, sin capa ${faltan.length}`);
      console.log("  " + faltan.join("\n  "));
    }
  }
  await p.$disconnect();
}
main();
