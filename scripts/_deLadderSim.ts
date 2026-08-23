/**
 * Simula la escalera: cambia las plazas de un solo encuentro por palabras que
 * YA se enseñan en otra historia y que ademas estan en el cuerpo de esta. Es lo
 * que hacen los A0 buenos, que repiten 170 a 210 plazas de 500; el aleman
 * repite 14. No toca ni un cuerpo.
 *
 *   npx tsx scripts/_deLadderSim.ts [--write plan.json]
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import * as fs from "fs";
const p = new PrismaClient();
const FUNC = new Set(("und der die das den dem des ein eine einen einem einer ist sind bin war waren ich du er sie es wir ihr man mich mir dich dir uns sich mein meine dein sein seine ihre ihren nicht kein keine mit von zu in im am an auf aus bei nach vor über unter für als wie so aber oder denn dann noch nur schon auch sehr mehr hat habe haben hatte wird werden kann können muss müssen will wollen jetzt hier da dort weil dass wenn ob zum zur vom beim ins etwas nichts alles alle jeder jede jedes viel viele wenig mal doch ja nein immer wieder bis seit ohne durch gegen um zwischen hinter neben").split(/\s+/));

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
  const enc = (k: string) => cuerpos.filter((c) => c.has(k.toLowerCase())).length;

  // Catalogo de lo enseñado: surface -> {word, type, definition, historias}
  const ense = new Map<string, any>();
  st.forEach((s, i) => {
    for (const v of ((s.vocab as any[]) ?? [])) {
      const k = sf(v).toLowerCase();
      if (!ense.has(k)) ense.set(k, { ...v, de: [] });
      ense.get(k).de.push(i + 1);
    }
  });

  const plan: Record<string, Array<{ fuera: string; dentro: string }>> = {};
  st.forEach((s, i) => {
    const voc = ((s.vocab as any[]) ?? []).map((v) => ({ v, k: sf(v).toLowerCase(), n: enc(sf(v)) }));
    const yo = new Set(voc.map((x) => x.k));
    // Candidatas: enseñadas en OTRA historia, presentes en MI cuerpo, con 3+
    // encuentros, que no enseño yo ya y que no son palabras funcion.
    const cand = [...ense.entries()]
      .filter(([k, v]) => !yo.has(k) && cuerpos[i].has(k) && enc(k) >= 3 && !FUNC.has(k) && !v.de.includes(i + 1))
      .map(([k, v]) => ({ k, v, n: enc(k) }))
      .sort((a, b) => b.n - a.n);
    // Plazas debiles: un solo encuentro. El ancla cultural del destino NO se
    // toca aunque salga una sola vez: esa es su naturaleza y otra regla la
    // exige en el vocab ([[feedback_cultural_anchor_always_vocab]]).
    const ANCLA = /Kreidefels|Königsstuhl|Hühnergott|Feuerstein|Kalk|Buche|Zahnradbahn|Zugspitze|Seilbahn|Gipfel|Grat|Eibsee|Kuckucksuhr|Zinnfigur|Kleeblatt|Ritter|Lebkuchen|Backstube|Kettensteg|Bratwurst|Brötchen|Senf|Pegnitz|Rost|Schwarzwald|Förster|Harz|Pilz|Tanne|Reh|Kutter|Dorsch|Schuppen|Fischer|Steg|Möwe|Fähre|Anlegestelle|Fensterladen|Burg|Rebe|Most|Apfelbaum|Schloss|Fass|Terrasse|Krieg|Mauer|Keller|Affe|Bronze|Ruderboot|Leuchtturm|Gitter|Geländer|Gummijacke|Dänemark|Deutschland|Altstadt|Bahnsteig|Gleis|Schiene|Felswand|Tunnel|Werkstatt|Werkzeug|Span|Holzstück|Kammer|Briefmarke|Umschlag|Advent|Weihnachten|Krankenhaus|Ärztin|Universität|Museum|Soße|Käse|Lehrerin|Kusine|Tante|Ehefrau|Schwester|Diesel|Salz|Gummi|Metall|Zinn|Blech|Dose|Tresen|Laden|Mandel|Honig|Zucker|Kreide|Insel|Mainau/i;
    const debiles = voc.filter((x) => x.n <= 1 && !ANCLA.test(String(x.v.word))).sort((a, b) => a.n - b.n);
    // Se cambian como mucho 9 por historia, para dejar sitio a las ancladas.
    const cambios = Math.min(9, debiles.length, cand.length);
    plan[s.slug!] = [];
    for (let c = 0; c < cambios; c++)
      plan[s.slug!].push({ fuera: sf(debiles[debiles.length - 1 - c].v), dentro: cand[c].k });
  });

  // Media resultante
  let tot = 0, n = 0, unaVez = 0;
  st.forEach((s, i) => {
    const fuera = new Set(plan[s.slug!].map((x) => x.fuera.toLowerCase()));
    const dentro = plan[s.slug!].map((x) => x.dentro);
    const nuevo = ((s.vocab as any[]) ?? []).map(sf).filter((w) => !fuera.has(w.toLowerCase())).concat(dentro);
    for (const w of nuevo) { const e = enc(w); tot += e; n++; if (e <= 1) unaVez++; }
  });
  const cambios = Object.values(plan).reduce((a, b) => a + b.length, 0);
  console.log(`cambios propuestos: ${cambios} (${(cambios / 21).toFixed(1)} por historia)`);
  console.log(`media resultante: ${(tot / n).toFixed(2)} · una sola vez ${unaVez}/${n}`);
  const w = process.argv.indexOf("--write");
  if (w > 0) { fs.writeFileSync(process.argv[w + 1], JSON.stringify(plan, null, 1) + "\n"); console.log("plan escrito"); }
  await p.$disconnect();
})();
