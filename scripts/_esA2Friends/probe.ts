// Solo lectura: escalera y porton de temas en seco para el Friends ES spain A2.
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
import { assertLadderContiguous } from "../../src/lib/journeyLadder";
import { assertTopicsGrounded } from "../../src/lib/topicEvidence";
const p = new PrismaClient();
const TEMAS = ["Music & Bands", "Phones & Social Media", "Driving & Cars", "Money & Loans", "Clothes & Looks", "Couples & Dating", "Fairs & Street Parties"];
const slug = (l: string) => l.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
(async () => {
  const js = await p.journey.findMany({ select: { id: true, name: true, language: true, variant: true, levels: true, status: true } });
  assertLadderContiguous({ name: "Friends", language: "spanish", variant: "spain", levels: ["a2"] }, js as any);
  console.log("escalera: pasa");
  const existentes = await p.topic.findMany({ select: { slug: true, label: true } });
  const choque = TEMAS.filter((t) => existentes.some((e) => e.slug === slug(t) || e.label.toLowerCase() === t.toLowerCase()));
  console.log("slugs:", TEMAS.map(slug).join(", "), "| choques con Topic:", choque.length ? choque : "ninguno");
  try {
    await assertTopicsGrounded({ language: "spanish", prisma: p, proposals: TEMAS.map((label) => ({ label, slug: slug(label) })),
      journeyEvidence: ["Holiday home in Spain and I wish to talk to neighbours", "My boyfriend and I have been dating for a year and a half now"] });
    console.log("porton de temas (journey-level, en seco): pasa");
  } catch (e) { console.log("porton de temas:", (e as Error).message); }
  await p.$disconnect();
})();
