import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
const CAND = ["Elvira","Amparo","Berta","Celia","Inés","Lola","Maite","Olga","Pilar","Sagrario","Teresa","Verónica",
              "Andrés","Bruno","Emilio","Gonzalo","Ignacio","Lorenzo","Ramón","Sergio","Tomás","Vicente","Fermín","Álex"];
(async () => {
  const js = await p.journey.findMany({ where: { language: { equals: "spanish", mode: "insensitive" }, status: { not: "archived" } }, select: { id: true, variant: true } });
  const rows = await p.journeyStory.findMany({ where: { journeyId: { in: js.map((x) => x.id) } }, select: { journeyId: true, text: true } });
  const uso = new Map<string, Set<string>>();
  for (const r of rows) {
    const v = js.find((x) => x.id === r.journeyId)!.variant ?? "?";
    for (const n of CAND) if (new RegExp(`\\b${n}\\b`).test(r.text)) (uso.get(n) ?? uso.set(n, new Set()).get(n)!).add(v);
  }
  console.log("LIBRES:", CAND.filter((n) => !uso.has(n)).join(", "));
  console.log("\nen uso:", [...uso].map(([n, v]) => `${n}(${[...v].join("/")})`).join(", "));
  await p.$disconnect();
})();
