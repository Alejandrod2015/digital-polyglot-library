/**
 * Mide la recirculacion de un journey con la MISMA formula que
 * `journey-vocab-recirculation` en src/lib/validateJourneyStories.ts.
 * Solo lectura. Sirve para calibrar el liston de un nivel que aun no lo tiene.
 */
import { config } from "dotenv"; config({ path: ".env.local" }); config({ path: ".env" });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();

const tok = (t: string) => (t.toLowerCase().match(/\p{L}+/gu) ?? []);
const clave = (v: any) => String(v.surface ?? v.word).toLowerCase().replace(/^(der|die|das|le|la|el|il|o|a)\s+/, "");

(async () => {
  const js = await p.journey.findMany({ where: { language: "spanish", status: { in: ["active", "draft"] as any } } });
  for (const j of js) {
    const ss = await p.journeyStory.findMany({ where: { journeyId: j.id }, select: { text: true, vocab: true } });
    if (!ss.some((s) => (s.vocab as any[])?.length)) continue;
    const cuerpos = ss.map((s) => new Set(tok(s.text ?? "")));
    const todas: Array<{ n: number; anchor: boolean }> = [];
    for (const s of ss) for (const v of ((s.vocab as any[]) ?? []))
      todas.push({ n: cuerpos.filter((c) => c.has(clave(v))).length, anchor: Boolean(v.anchor) });
    const marca = todas.some((x) => x.anchor);
    const port = marca ? todas.filter((x) => !x.anchor) : todas;
    const media = port.reduce((a, b) => a + b.n, 0) / (port.length || 1);
    const unaVez = port.filter((x) => x.n <= 1).length;
    const cola = port.length ? unaVez / port.length : 0;
    const anc = todas.filter((x) => x.anchor).length;
    console.log(
      `${String(j.levels[0] ?? "?").toUpperCase().padEnd(3)} ${j.status.padEnd(6)} ${(j.name + " " + j.variant).padEnd(22)}` +
      ` media ${media.toFixed(2)} · cola ${(cola * 100).toFixed(0)}% · plazas ${todas.length}` +
      ` · ancladas ${anc} (${Math.round((anc / todas.length) * 100)}%)${marca ? "" : " · SIN marcar ancladas"}`,
    );
  }
  await p.$disconnect();
})();
