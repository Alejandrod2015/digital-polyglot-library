/**
 * Plan de la escalera: clasifica cada plaza de vocab del Traveler DE A0 en
 * PORTABLE (cabe en cualquier escena del journey y tiene que reaparecer) o
 * ANCLADA (solo tiene sentido en su destino), y reparte para cada portable las
 * historias donde debe volver a salir.
 *
 * El objetivo lo fija [[project_vocab_recirculation_ladder]]: 12 portables y 8
 * ancladas por historia, cuatro encuentros por palabra portable.
 *
 *   npx tsx scripts/_deLadderPlan.ts            # informe
 *   npx tsx scripts/_deLadderPlan.ts --write    # escribe el plan a scripts/_deLadderPlan.json
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import * as fs from "fs";
const p = new PrismaClient();

// ANCLADA: nombra el destino, su oficio o su objeto propio. Si sale de aqui,
// solo puede vivir en su historia y no se le pide que vuelva.
const ANCLADA = /Kreidefels|Königsstuhl|Hühnergott|Feuerstein|Kalk|Buche|Zahnradbahn|Zugspitze|Seilbahn|Gipfel|Grat|Eibsee|Kuckucksuhr|Zinnfigur|Kleeblatt|Ritter|Lebkuchen|Backstube|Kettensteg|Bratwurst|Brötchen|Senf|Pegnitz|Rost|Schwarzwald|Förster|Harz|Pilz|Tanne|Reh|Kutter|Dorsch|Schuppen|Fischer|Steg|Möwe|Fähre|Anlegestelle|Fensterladen|Burg|Mainau|Insel|Rebe|Most|Apfelbaum|Schloss|Fass|Terrasse|Krieg|Mauer|Keller|Affe|Bronze|Ruderboot|Leuchtturm|Gitter|Geländer|Gummijacke|Dänemark|Deutschland|Altstadt|Bahnsteig|Gleis|Schiene|Felswand|Tunnel|Werkstatt|Werkzeug|Span|Holzstück|Kammer|Briefmarke|Umschlag|Advent|Weihnachten|Krankenhaus|Ärztin|Universität|Museum|Soße|Käse|Spätzle|Lehrerin|Kusine|Tante|Ehefrau|Schwester|Diesel|Salz|Gummi|Metall|Zinn|Blech|Dose|Tresen|Laden|Stand|Mandel|Honig|Zucker|Kreide/i;

(async () => {
  const j = await p.journey.findUnique({ where: { id: "cmt0a8vb1000m32p1x7r5ba28" }, select: { topics: true } });
  const orden = j?.topics ?? [];
  const st = (await p.journeyStory.findMany({
    where: { journeyId: "cmt0a8vb1000m32p1x7r5ba28" },
    select: { slug: true, topic: true, slotIndex: true, text: true, vocab: true },
  })).sort((a, b) => (orden.indexOf(a.topic) - orden.indexOf(b.topic)) || (a.slotIndex - b.slotIndex));

  const tok = (t: string) => new Set((String(t).toLowerCase().match(/\p{L}+/gu) ?? []));
  const cuerpos = st.map((s) => tok(String(s.text)));
  const sf = (v: any) => String(v.surface ?? v.word);

  type Plaza = { historia: number; word: string; surface: string; type: string; portable: boolean; sale: number[] };
  const plazas: Plaza[] = [];
  st.forEach((s, i) => {
    for (const v of ((s.vocab as any[]) ?? [])) {
      const surface = sf(v);
      const sale = cuerpos.map((c, k) => (c.has(surface.toLowerCase()) ? k + 1 : 0)).filter(Boolean);
      plazas.push({ historia: i + 1, word: String(v.word), surface, type: String(v.type),
                    portable: !ANCLADA.test(String(v.word)), sale });
    }
  });

  const port = plazas.filter((x) => x.portable);
  const anc = plazas.filter((x) => !x.portable);
  console.log(`${plazas.length} plazas: ${port.length} portables · ${anc.length} ancladas`);
  console.log(`por historia: portables ${(port.length / 21).toFixed(1)} (objetivo 12) · ancladas ${(anc.length / 21).toFixed(1)} (objetivo 8)`);
  const med = (xs: Plaza[]) => (xs.reduce((a, b) => a + b.sale.length, 0) / xs.length).toFixed(2);
  console.log(`encuentros: portables ${med(port)} (objetivo 4) · ancladas ${med(anc)} (objetivo 1)`);
  const deuda = port.filter((x) => x.sale.length < 4);
  console.log(`portables por debajo de 4 encuentros: ${deuda.length}/${port.length}`);
  const objetivo = (port.length * 4 + anc.length * 1) / plazas.length;
  console.log(`media que daria el plan cumplido: ${objetivo.toFixed(2)} (suelo del gate 3,0)`);

  // ── El reparto: a que historias tiene que volver cada portable ──
  //
  // Una palabra enseñada en la historia i vuelve en historias POSTERIORES: eso
  // es la escalera, no un eco hacia atras. Se reparte a las mas cercanas que
  // aun tengan hueco, para que ninguna se coma treinta palabras ajenas.
  const cupo = new Array(22).fill(0);
  const deben: Record<number, string[]> = {};
  for (let i = 1; i <= 21; i++) deben[i] = [];
  for (const x of port.sort((a, b) => a.historia - b.historia)) {
    let faltan = 4 - x.sale.length;
    if (faltan <= 0) continue;
    const candidatas = [];
    for (let k = x.historia + 1; k <= 21; k++) if (!x.sale.includes(k)) candidatas.push(k);
    candidatas.sort((a, b) => (cupo[a] - cupo[b]) || (a - b));
    for (const k of candidatas) {
      if (faltan <= 0) break;
      deben[k].push(x.surface);
      cupo[k]++; faltan--;
    }
  }
  console.log("\npalabras que cada historia tiene que RECOGER de las anteriores:");
  for (let i = 1; i <= 21; i++)
    console.log(`${String(i).padStart(2)} ${String(deben[i].length).padStart(3)}  ${deben[i].slice(0, 14).join(" ")}${deben[i].length > 14 ? " ..." : ""}`);

  if (process.argv.includes("--write")) {
    fs.writeFileSync("scripts/_deLadderPlan.json",
      JSON.stringify({ plazas, recoge: deben }, null, 1) + "\n");
    console.log("escrito scripts/_deLadderPlan.json");
  }
  if (false) {
  }
  await p.$disconnect();
})();
