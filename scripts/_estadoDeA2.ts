/** Estado de audio de las historias narradas del Friends DE A2 (Hannover):
 *  master, duracion de fragmentos, gateFlags que quedan y ritmo. */
import "./_loadEnv";
import { PrismaClient } from "../src/generated/prisma";
import { rapidasDe, informe } from "./checkNarrationPace";
const p = new PrismaClient();
const J = "cmubidgaf0007j8np6g7n89iu";
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
(async () => {
  const ss = await p.journeyStory.findMany({ where: { journeyId: J, NOT: { audioUrl: null } }, orderBy: { slotIndex: "asc" } });
  for (const s of ss as any[]) {
    const fr: any[] = (s.audioFragments ?? []) as any[];
    const con = fr.filter((f) => f.gateFlags?.length);
    console.log(`\n${s.slug} · ${fr.length} fragmentos · ${con.length} marcados · qa=${s.audioQaStatus ?? "null"}`);
    for (const f of con) console.log(`   [${f.index}] ${mmss(f.startSec ?? 0)} ${f.gateFlags.map((g: any) => g.kind + " " + g.detail).join(", ")}`);
    console.log(`   ${informe(s.slug, rapidasDe(s.audioSegments ?? [], fr))}`);
  }
  await p.$disconnect();
})();
