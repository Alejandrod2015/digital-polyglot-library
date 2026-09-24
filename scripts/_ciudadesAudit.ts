import { config } from "dotenv";
config({ path: ".env.local" }); config({ path: ".env" });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();

const STOP = new Set(["El","La","Los","Las","Un","Una","Y","Pero","Cuando","Si","No","Es","Está","Está","Yo","Tú","Él","Ella","Me","Mi","Su","Al","Del","De","En","A","Que","Para","Por","Con","Lo","Le","Se","Ya","Ahora","Hoy","Ayer","Mañana","Aquí","Allí","Entonces","Después","Antes","Todo","Todos","Todas","Nada","Nadie","Muy","Más","Menos","También","Hay","Ser","Estar","Der","Die","Das","Ich","Du","Er","Sie","Es","Wir","Ihr","Und","Aber","Wenn","Dann","Nicht","Ein","Eine","Il","Lo","La","Gli","Le","Un","Una","E","Ma","Che","Non","O","As","Os","Um","Uma","Mas","Não","Eu","Ele","Ela","Nós"]);

function caps(text: string): string[] {
  const out: string[] = [];
  // tokens starting uppercase, not sentence-initial
  const re = /(?<=[^.!?¿¡\n"“”]\s)([A-ZÁÉÍÓÚÑÜÄÖÅŁŚŻŹĆĄĘ][\p{L}]+(?:\s+(?:de|del|la|los)\s+[A-ZÁÉÍÓÚÑÜ][\p{L}]+)?)/gu;
  let m;
  while ((m = re.exec(text))) out.push(m[1]);
  return out;
}

(async () => {
  const js = await p.journey.findMany({
    where: { status: { in: ["active", "draft"] } },
    include: { stories: { select: { title: true, text: true, synopsis: true, cast: true } } },
    orderBy: [{ language: "asc" }, { variant: "asc" }, { name: "asc" }],
  });
  for (const j of js) {
    const castNames = new Set<string>();
    for (const s of j.stories) {
      const c: any = s.cast;
      if (c && Array.isArray(c.characters)) for (const ch of c.characters) if (ch?.name) String(ch.name).split(/\s+/).forEach(n => castNames.add(n));
    }
    const perStory = new Map<string, Set<number>>();
    const total = new Map<string, number>();
    j.stories.forEach((s, i) => {
      const blob = [s.title ?? "", s.synopsis ?? "", s.text ?? ""].join("\n");
      for (const t of caps(blob)) {
        if (STOP.has(t) || castNames.has(t)) continue;
        total.set(t, (total.get(t) ?? 0) + 1);
        if (!perStory.has(t)) perStory.set(t, new Set());
        perStory.get(t)!.add(i);
      }
    });
    const rows = [...perStory.entries()]
      .map(([t, set]) => ({ t, stories: set.size, hits: total.get(t)! }))
      .filter(r => r.hits >= 2)
      .sort((a, b) => b.stories - a.stories || b.hits - a.hits)
      .slice(0, 18);
    const written = j.stories.filter(s => (s.text ?? "").length > 50).length;
    console.log(`\n## ${j.status.toUpperCase()} | ${j.name} | ${j.language}/${j.variant} | ${j.levels.join(",")} | ${j.id} | escritas ${written}/${j.stories.length}`);
    console.log(rows.map(r => `${r.t}[${r.stories}h/${r.hits}]`).join("  "));
  }
  await p.$disconnect();
})();
