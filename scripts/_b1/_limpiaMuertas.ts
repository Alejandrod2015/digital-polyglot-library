/** Borra de la capa de UNA historia las entradas cuya palabra ya no sale en su
 *  texto: restos de versiones anteriores. Nadie puede tocar una palabra que no
 *  esta, asi que no son glosas, son peso muerto que ademas falla el lint. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const N = (t: string) => t.normalize("NFC").toLowerCase().replace(/[“”"«»().,;:¡!¿?]/g, "").replace(/\s+/g, " ").trim();
(async () => {
  const p = new PrismaClient();
  const B = "spanish-traveler-spain-b1";
  const seco = process.argv.includes("--dry");
  const filas = await p.tapGlossSet.findMany({ where: { bundle: B } });
  const g0 = filas.find((f) => f.slug === "")!;
  const ss = await p.journeyStory.findMany({ where: { slug: { in: g0.slugs } }, select: { slug: true, title: true, text: true } });
  const texto = new Map(ss.map((s) => [s.slug!, N(`${s.title}. ${s.text}`)]));
  let n = 0;
  for (const f of filas) {
    if (!f.slug) continue;
    const t = texto.get(f.slug); if (!t) continue;
    const g = f.glosses as Record<string, any>;
    // POR PALABRA ENTERA. Con `includes` a secas, "era" sobrevivia dentro de
    // "primera" y la entrada muerta se quedaba.
    const hay = (w: string) => {
      const n = N(w);
      if (n.includes(" ")) return t.includes(n);
      return new RegExp(`(^|[^\\p{L}])${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^\\p{L}]|$)`, "u").test(t);
    };
    const fuera = Object.keys(g).filter((w) => !hay(w));
    if (!fuera.length) continue;
    console.log(`${f.slug}: ${fuera.length} muertas · ${fuera.slice(0, 8).join(" ")}`);
    n += fuera.length;
    if (!seco) {
      for (const w of fuera) delete g[w];
      await p.tapGlossSet.update({ where: { bundle_slug: { bundle: B, slug: f.slug } }, data: { glosses: g } });
    }
  }
  console.log(`${seco ? "(dry) " : ""}entradas muertas ${n}`);
  await p.$disconnect();
})();
