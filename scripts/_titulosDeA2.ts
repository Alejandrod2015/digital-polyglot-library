/** Los 21 titulos del Friends DE A2 con su tema, si estan narrados y, cuando
 *  lo esten, la medida F0 que el gate dejo en el fragmento 0. Sin sintesis.
 *
 *  OJO con la ultima columna: sale de los gateFlags GUARDADOS, y empalmar un
 *  fragmento con _rerollSection los borra al reconstruir audioFragments. Por
 *  eso dice "sin flags" y no "limpio": la ausencia de flag puede significar
 *  que la toma paso el gate, o que hubo un empalme despues de medirla. La
 *  medida de verdad vive en docs/veredictos-audio-gates.json. */
import "./_loadEnv";
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
const J = "cmubidgaf0007j8np6g7n89iu";
(async () => {
  const j: any = await p.journey.findUnique({ where: { id: J }, select: { topics: true } });
  const orden: string[] = (j.topics as string[]) ?? [];
  const ss: any[] = await p.journeyStory.findMany({ where: { journeyId: J } });
  ss.sort((a, b) => orden.indexOf(a.topic) - orden.indexOf(b.topic) || a.slotIndex - b.slotIndex);
  for (const s of ss) {
    const f0 = (((s.audioFragments ?? []) as any[]).find((f) => f.index === 0)?.gateFlags ?? [])
      .filter((g: any) => g.kind === "uptalk").map((g: any) => g.detail).join("");
    console.log([
      String(orden.indexOf(s.topic) + 1),
      s.topic,
      s.title,
      String(s.title.length),
      s.audioUrl ? "narrada" : "-",
      f0 || (s.audioUrl ? "sin flags" : ""),
    ].join("\t"));
  }
  await p.$disconnect();
})();
