/**
 * Cambia plazas de vocabulario del Expat FR A0 que no enseñan nada: las 34 de
 * relleno (definición "a word this scene needs…", forma conjugada) y las 4 que
 * repetían una plaza ya enseñada en otra historia. Escribe el payload y lo pasa
 * por `saveStory.ts`, que es el único que puede escribir contenido.
 *
 *   npx tsx scripts/_frFixVocab.ts <salida.json>
 */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import * as fs from "fs";
const p = new PrismaClient();
const ID = "cmt09ehi60000320qf9efrypu";

type Nueva = { word: string; type: string; surface: string; definition: string };
const CAMBIOS: Record<string, Record<string, Nueva>> = {
  "la-monnaie-exacte": {
    "le tour": { word: "boire", type: "verb", surface: "boit", definition: "to take a drink of something" },
  },
  "la-truffade-et-le-telephone": {
    "le repas": { word: "lourd", type: "adjective", surface: "lourd", definition: "heavy, filling in your stomach" },
  },
  "la-pharmacie-avant-le-medecin": {
    "blanche": { word: "la femme", type: "noun", surface: "femme", definition: "a grown woman, not a girl" },
    "cassée": { word: "mardi", type: "noun", surface: "mardi", definition: "the second day of the week" },
    "demandé": { word: "trouver", type: "verb", surface: "trouve", definition: "to find what you look for" },
  },
  "un-medecin-traitant-pour-deux-ans": {
    "ordonnance": { word: "la secrétaire", type: "noun", surface: "secrétaire", definition: "the person who answers in an office" },
    "pressée": { word: "chez", type: "preposition", surface: "chez", definition: "at the home of somebody" },
    "restée": { word: "le nom", type: "noun", surface: "nom", definition: "the word that says who somebody is" },
    "revenue": { word: "tout de suite", type: "expression", surface: "tout de suite", definition: "right now, without waiting" },
    "secrétaire": { word: "écouter", type: "verb", surface: "écoute", definition: "to listen to what somebody says" },
    "répond": { word: "après", type: "preposition", surface: "après", definition: "later than something else" },
  },
  "la-cheville-et-la-glace": {
    "aller": { word: "le pied", type: "noun", surface: "pied", definition: "the part of your leg you stand on" },
    "allumée": { word: "s'asseoir", type: "verb", surface: "assoit", definition: "to sit down on a seat" },
    "assoit": { word: "bouger", type: "verb", surface: "bouges", definition: "to move your body" },
    "bouges": { word: "repartir", type: "verb", surface: "repart", definition: "to go away again" },
    "chaussure": { word: "travailler", type: "verb", surface: "travailler", definition: "to do your job" },
    "croit": { word: "descendre", type: "verb", surface: "descend", definition: "to go down to a lower place" },
    "repart": { word: "aucun", type: "adjective", surface: "aucune", definition: "not a single one" },
    "répondent": { word: "trop", type: "adverb", surface: "trop", definition: "more than what is good" },
    "travailler": { word: "un peu", type: "expression", surface: "un peu", definition: "a small amount, not much" },
  },
  "sa-chaise-reste-vide-deux-heures": {
    "chaise": { word: "septembre", type: "noun", surface: "septembre", definition: "the month when school starts again" },
    "entrée": { word: "l'entrée", type: "noun", surface: "entrée", definition: "the way into a building" },
    "immeuble": { word: "lire", type: "verb", surface: "lit", definition: "to look at words and understand them" },
    "onze": { word: "onze", type: "adjective", surface: "onze", definition: "the number after ten" },
    "prénoms": { word: "déjà", type: "adverb", surface: "déjà", definition: "before now, sooner than you thought" },
    "quatrième": { word: "quatrième", type: "adjective", surface: "quatrième", definition: "the one that comes after the third" },
    "apporter": { word: "aussi", type: "adverb", surface: "aussi", definition: "as well, like the other one" },
    "garder": { word: "alors", type: "adverb", surface: "Alors", definition: "in that case, if it is so" },
  },
  "deux-mille-marches-a-deux": {
    "dames": { word: "la fin", type: "noun", surface: "fin", definition: "the last part of something" },
    "dois": { word: "chaque", type: "adjective", surface: "chaque", definition: "every single one of them" },
    "dort": { word: "autre", type: "adjective", surface: "autre", definition: "different from this one" },
    "escaliers": { word: "à voix haute", type: "expression", surface: "à voix haute", definition: "loudly enough for others to hear" },
    "fenêtres": { word: "vers", type: "preposition", surface: "Vers", definition: "at about that time" },
  },
  "la-porte-qu-il-faut-tirer": {
    "année": { word: "devenir", type: "verb", surface: "devient", definition: "to turn into something else" },
    "entend": { word: "entendre", type: "verb", surface: "entend", definition: "to notice a sound with your ears" },
    "reprend": { word: "l'appartement", type: "noun", surface: "appartement", definition: "the home inside a big building" },
    "signe": { word: "signer", type: "verb", surface: "signe", definition: "to write your name to say yes" },
    "trompent": { word: "se tromper", type: "verb", surface: "trompent", definition: "to do or say the wrong thing" },
  },
};

(async () => {
  const out = process.argv[2];
  const rows = await p.journeyStory.findMany({
    where: { journeyId: ID, slug: { in: Object.keys(CAMBIOS) } },
    select: { topic: true, slotIndex: true, title: true, slug: true, synopsis: true, text: true, vocab: true, arcType: true },
  });
  const payload = rows.map((r) => {
    const mapa = CAMBIOS[r.slug!];
    const vocab = ((r.vocab as any[]) ?? []).map((v) => {
      const n = mapa[String(v.word)];
      return n ? { ...v, ...n } : v;
    });
    const faltan = Object.keys(mapa).filter((k) => !((r.vocab as any[]) ?? []).some((v) => String(v.word) === k));
    if (faltan.length) throw new Error(`${r.slug}: no encontré ${faltan.join(", ")}`);
    return { ...r, vocab };
  });
  fs.writeFileSync(out, JSON.stringify(payload, null, 2));
  console.log(`${payload.length} historias -> ${out}`);
  await p.$disconnect();
})();
