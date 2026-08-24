/** Glosas del paquete francés que pueden estar eligiendo el sentido equivocado:
 *  homógrafos y palabras de varios significados, con TODAS sus frases reales al
 *  lado para leerlas contra la glosa. Solo lectura. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import * as fs from "fs";
const p = new PrismaClient();
const AMBIGUAS = ["est","a","son","vers","pas","tour","temps","fin","livre","livres","porte","portes","pièce","pièces","côté","voix","cours","place","places","monnaie","carte","note","notes","prix","mer","mère","père","pair","sur","sous","car","or","été","суr","point","fois","coup","coups","marche","marches","glace","plat","plats","verre","verres","bas","haute","chaud","chaude","juste","droit","droite","gauche","grand","long","dur","dure","sec","seche","file","fille","mois","mot","mots","nom","noms","part","partie","porte","reste","suite","tirer","tour","tout","toute"];
(async () => {
  const st = await p.journeyStory.findMany({ where: { journeyId: "cmt09ehi60000320qf9efrypu" }, select: { title: true, text: true } });
  const raw = JSON.parse(fs.readFileSync("src/data/tapGlosses/french-expat-lyon.json", "utf8"));
  const g: Record<string, any> = raw.glosses ?? raw;
  const frases: string[] = st.flatMap((s) => `${s.title}. ${s.text}`.split(/(?<=[.!?”])\s+/));
  for (const w of [...new Set(AMBIGUAS)]) {
    const gl = g[w];
    if (!gl) continue;
    const usos = frases.filter((f) => new RegExp(`(?<![\\p{L}'])${w}(?![\\p{L}])`, "iu").test(f));
    if (!usos.length) continue;
    console.log(`\n${w}  ->  ${typeof gl === "string" ? gl : gl.g}`);
    usos.slice(0, 4).forEach((f) => console.log(`     · ${f.trim().slice(0, 110)}`));
    if (usos.length > 4) console.log(`     (+${usos.length - 4} usos más)`);
  }
  await p.$disconnect();
})();
