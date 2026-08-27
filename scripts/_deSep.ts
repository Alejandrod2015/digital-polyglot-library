/** Repara las tablas de verbos separables del bundle aleman.
 *
 * Dos fallos, los dos por lo mismo: el generador solo ve la palabra suelta y
 * el prefijo esta al final de la oracion.
 *
 *   1. "kuendigt ... an" es ANkuendigen (anunciar), no kuendigen (rescindir).
 *      La tabla ensenaba otro verbo, que es peor que no ensenar ninguno.
 *   2. En las que si detecto el separable, las filas de wir y de sie/Sie
 *      pegaban el prefijo ("wir mitbringen"). En oracion principal se separa
 *      en las seis personas. Corregido tambien en buildGlossForms.ts.
 *
 *   npx tsx scripts/_deSep.ts
 */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
const P = ["ich", "du", "er, sie, es", "wir", "ihr", "sie, Sie"];

/** [slug, palabra, infinitivo, seis formas del tronco, fila que sale en el texto] */
const ARREGLOS: Array<[string, string, string, string[], number]> = [
  ["ganz-berlin-wartet-auf-einen-mord", "kommst", "hinkommen", ["komme","kommst","kommt","kommen","kommt","kommen"], 1],
  ["ganz-berlin-wartet-auf-einen-mord", "bringen", "beibringen", ["bringe","bringst","bringt","bringen","bringt","bringen"], 5],
  ["wir-muessen-mal", "hört", "mithören", ["höre","hörst","hört","hören","hört","hören"], 2],
  ["der-spaeti-in-der-weserstrasse", "nehme", "annehmen", ["nehme","nimmst","nimmt","nehmen","nehmt","nehmen"], 0],
  ["feierabend-ist-ein-versprechen", "dreht", "umdrehen", ["drehe","drehst","dreht","drehen","dreht","drehen"], 2],
  ["blumen-giessen-ist-vertrauenssache", "bringt", "mitbringen", ["bringe","bringst","bringt","bringen","bringt","bringen"], 2],
  ["gute-besserung-im-oktober", "rufen", "anrufen", ["rufe","rufst","ruft","rufen","ruft","rufen"], 5],
  ["feedback-auf-deutsch", "läuft", "weiterlaufen", ["laufe","läufst","läuft","laufen","lauft","laufen"], 2],
  ["ein-brief-kuendigt-briefe-an", "dreht", "umdrehen", ["drehe","drehst","dreht","drehen","dreht","drehen"], 2],
  ["ein-brief-kuendigt-briefe-an", "hält", "hochhalten", ["halte","hältst","hält","halten","haltet","halten"], 2],
  ["ein-brief-kuendigt-briefe-an", "sieht", "aussehen", ["sehe","siehst","sieht","sehen","seht","sehen"], 2],
  ["ein-brief-kuendigt-briefe-an", "kündigt", "ankündigen", ["kündige","kündigst","kündigt","kündigen","kündigt","kündigen"], 2],
  ["ein-brief-kuendigt-briefe-an", "kündigen", "ankündigen", ["kündige","kündigst","kündigt","kündigen","kündigt","kündigen"], 3],
  ["sonntags-schliesst-sogar-berlin", "haben", "aufhaben", ["habe","hast","hat","haben","habt","haben"], 5],
  ["ein-antrag-auf-freizeit", "füllen", "ausfüllen", ["fülle","füllst","füllt","füllen","füllt","füllen"], 5],
  ["die-mit-der-thermoskanne", "kommst", "ankommen", ["komme","kommst","kommt","kommen","kommt","kommen"], 1],
  ["zustaendig-ist-ein-anderes-amt", "ruft", "anrufen", ["rufe","rufst","ruft","rufen","ruft","rufen"], 2],
];

/** Las que el generador SI detecto: solo hay que soltar el prefijo en wir y
 *  sie/Sie, y quitar el subrayado, porque en el texto sale el infinitivo. */
const YA_SEPARABLES = new Set(["aufsetzen","mitbringen","annehmen","aufwachen","einreiben","mitspielen","abschrecken"]);

function prefijoDe(inf: string, tronco: string): string {
  return inf.slice(0, inf.length - (tronco.length + 2)) || inf.replace(/en$/, "").slice(0, inf.length - tronco.length);
}

async function main() {
  const filas = await p.tapGlossSet.findMany({ where: { bundle: "german-expat" } });
  const por = new Map(filas.map((f) => [f.slug, f.glosses as Record<string, any>]));
  let n = 0;

  for (const [slug, palabra, inf, tronco, here] of ARREGLOS) {
    const e = por.get(slug)?.[palabra];
    if (!e) { console.error(`no existe ${slug} / ${palabra}`); process.exit(1); }
    // el prefijo es lo que le sobra al infinitivo por delante del tronco de wir
    const prefijo = inf.slice(0, inf.length - tronco[3].length);
    e.f = { kind: "expand", link: "See conjugation", lemma: inf,
            rows: tronco.map((f, i) => [P[i], `${f} … ${prefijo}`]), here };
    n++;
  }

  for (const [slug, glosas] of por) {
    if (slug === "") continue;
    for (const [w, e] of Object.entries(glosas)) {
      if (!YA_SEPARABLES.has(w) || !(e as any).f) continue;
      const f = (e as any).f;
      // El prefijo se lee de la fila de "ich", que ya venia separada.
      const pref = (f.rows[0][1].split(" … ")[1] ?? "").trim();
      if (pref && !f.rows[3][1].includes(" … ")) {
        f.rows[3][1] = `${f.rows[3][1].slice(pref.length)} … ${pref}`;
        f.rows[5][1] = f.rows[3][1];
      }
      f.here = -1; // en el texto sale el infinitivo, ninguna fila lo es
      n++;
    }
  }

  for (const [slug, glosas] of por) {
    if (slug === "") continue;
    await p.tapGlossSet.update({ where: { bundle_slug: { bundle: "german-expat", slug } }, data: { glosses: glosas as never } });
  }
  console.log(`${n} tablas de separables corregidas`);
  await p.$disconnect();
}
main();
