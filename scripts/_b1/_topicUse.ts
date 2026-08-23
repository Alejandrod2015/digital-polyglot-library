import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const js = await p.journey.findMany({ where: { status: { not: "archived" } } });
  const uso = new Map<string, string[]>();
  for (const j of js as never as Array<Record<string, unknown>>) {
    const tag = `${j.name}/${j.language}/${j.variant}/${JSON.stringify(j.levels)}`;
    for (const t of (j.topics as string[]) ?? []) uso.set(t, [...(uso.get(t) ?? []), tag]);
  }
  for (const s of ["understanding-and-repeating","secrets-and-promises","slang-misunderstandings","negotiations-deals","bureaucracy-and-paperwork","fixing-and-repairs","roads-and-driving","help-and-repairs","humor-wordplay"])
    console.log(`${s.padEnd(30)} ${(uso.get(s) ?? ["(sin usar)"]).join(" · ")}`);
  console.log("\n--- A0 Friends spain ---");
  const a0 = js.find((x) => (x as never as Record<string,unknown>).id === "cmrr5hnbl000032k1esry5n8g") as never as Record<string,unknown>;
  console.log(JSON.stringify(a0.topics));
  console.log("\n--- temas de TODOS los journeys de español (live+draft) ---");
  for (const j of js as never as Array<Record<string, unknown>>) if (j.language === "spanish")
    console.log(`${String(j.name).padEnd(10)} ${j.variant}/${JSON.stringify(j.levels)} ${j.status}: ${(j.topics as string[]).join(", ")}`);
})().finally(() => p.$disconnect());
