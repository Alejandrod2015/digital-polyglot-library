import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
const MIO = "cmt5x67ze000l320cpgunu5vi";
(async () => {
  const j = await p.journey.findUnique({ where: { id: MIO } });
  const a = j as never as Record<string, unknown>;
  const rows = await p.journeyStory.findMany({ where: { journeyId: MIO },
    select: { text: true, status: true } });
  const conTexto = rows.filter((r) => String((r as never as {text?:string}).text ?? "").trim()).length;
  console.log(`journey ${a.status} · ${rows.length} filas · ${conTexto} con texto · nextJourneyId=${a.nextJourneyId}`);
  const cad = await p.journey.findMany({ where: { language: "spanish", status: { not: "archived" } },
    select: { id: true, name: true, variant: true, levels: true, nextJourneyId: true } });
  console.log("\ncadena en espanol:");
  for (const x of cad) console.log(`  ${String(x.name).padEnd(10)} ${x.variant}/${JSON.stringify(x.levels)}  next=${x.nextJourneyId ?? "vacio"}`);
})().catch((e)=>console.log("aviso:", String(e.message).slice(0,120))).finally(() => p.$disconnect());
