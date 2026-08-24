/** Cuanto se NOMBRA el sitio en cada journey de Espana, y con que otros
 *  topónimos se apoya. Solo cuenta; no juzga. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
const LUGARES = ["Nerja","Málaga","Frigiliana","Andalucía","Sevilla","Granada","Madrid","Almuñécar","Torrox","Maro"];
(async () => {
  for (const [id, et] of [
    ["cmrr5hnbl000032k1esry5n8g", "Friends ES/spain a0"],
    ["cmsvz6mz9000732gsgsfer0ko", "Traveler ES/spain a1"],
    ["cmt70xfyt000l3283gxd70wck", "Traveler ES/spain a2"],
    ["cmt5x67ze000l320cpgunu5vi", "Traveler ES/spain b1"],
  ] as const) {
    const st = await p.journeyStory.findMany({ where: { journeyId: id, text: { not: null } }, select: { slug: true, title: true, text: true, synopsis: true } });
    const enCuerpo: Record<string, number> = {}; const hist: Record<string, Set<string>> = {};
    let sinp = 0;
    for (const s of st) {
      let hay = false;
      for (const l of LUGARES) {
        const n = (`${s.title} ${s.text}`.match(new RegExp(`\\b${l}\\b`, "g")) ?? []).length;
        if (n) { enCuerpo[l] = (enCuerpo[l] ?? 0) + n; (hist[l] ??= new Set()).add(s.slug!); hay = true; }
      }
      if (!hay) sinp++;
    }
    const det = Object.entries(enCuerpo).sort((a, b) => b[1] - a[1])
      .map(([l, n]) => `${l} ${n} (${hist[l].size} hist.)`).join(" · ") || "ninguno";
    console.log(`${et.padEnd(22)} ${st.length - sinp}/${st.length} historias nombran el sitio · ${det}`);
  }
})().finally(() => p.$disconnect());
