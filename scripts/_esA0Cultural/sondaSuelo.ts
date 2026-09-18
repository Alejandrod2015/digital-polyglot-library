/**
 * SOLO LECTURA. Sonda del suelo A0 espanol (journey-a0-floor): frases de
 * control que DEBEN saltar y otras que NO, y despues los tres A0 espanoles
 * live para ver que marca en texto real (calibracion, no veredicto).
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
import { validateJourneyStories } from "../../src/lib/validateJourneyStories";

const p = new PrismaClient();
const floor = (text: string) =>
  validateJourneyStories([{ slug: "x", title: "x", text, language: "ES", level: "A0" }], { language: "ES", level: "A0" })
    .find((c) => c.id === "journey-a0-floor");

const DEBEN = [
  "Alondra compró una máscara.", "Ulises tenía hambre.", "Ella ha comprado flores.", "Mañana será otro día.",
  "Ella compraría todo.", "Quiere que sea barato.", "Ulises va a bailar.", "Perla le dice que no.", "Ella les da flores.",
  "Alondra fue al mercado.", "Ellos vieron el desfile.",
];
const NO_DEBEN = [
  "Alondra toma un café en la panadería.", "Hoy es el día del amor.", "Ella está cansada.", "Aquí hay flores.",
  "Me llamo Alondra.", "A Ulises le gusta la cumbia.", "Nos vemos mañana.", "Ella me mira y se ríe.", "Camilo dice: “¿Aló?”", "La máscara es para la fiesta.",
  "Alondra mira la alfombra y sonríe.", "¿Qué es esto?", "Ella se llama Mayra.", "La feria es grande.",
];
async function main() {
  console.log("== DEBEN saltar");
  for (const f of DEBEN) { const c = floor(f); console.log(`${c?.status === "fail" ? "ok  " : "MISS"} ${f}  ${c?.detail ?? ""}`); }
  console.log("== NO deben saltar");
  for (const f of NO_DEBEN) { const c = floor(f); console.log(`${c?.status === "pass" ? "ok  " : "FALSO"} ${f}  ${c?.detail ?? ""}`); }

  const js = await p.journey.findMany({ where: { language: "spanish", status: { in: ["active", "draft"] }, levels: { has: "a0" } }, select: { id: true, name: true, variant: true } });
  for (const j of js) {
    const ss = await p.journeyStory.findMany({ where: { journeyId: j.id, text: { not: null } }, select: { slug: true, title: true, text: true } });
    const c = validateJourneyStories(ss.map((s) => ({ slug: s.slug ?? "", title: s.title ?? "", text: s.text ?? "", language: "ES", level: "A0" })), { language: "ES", level: "A0" })
      .find((x) => x.id === "journey-a0-floor");
    console.log(`\n== ${j.name} ${j.variant} (${ss.length}): ${c?.status}\n  ${(c?.detail ?? "").split(" | ").join("\n  ")}`);
  }
}
main().finally(() => p.$disconnect());
