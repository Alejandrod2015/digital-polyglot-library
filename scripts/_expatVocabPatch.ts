/**
 * Aplica la correccion de vocabulario a las historias del Expat que fallan el
 * gate de utilidad, y de paso la deuda del validador que arrastraban.
 *
 * NO TOCA `text`. Solo `vocab`: quita entradas, corrige `surface` y reescribe
 * definiciones. Por eso NO implica regenerar una sola linea de audio.
 *
 * Escribe un JSON POR HISTORIA en scripts/_expatOut/. Uno por archivo a
 * proposito: los checks cross-story de saveStory comparan cada historia con
 * las ANTERIORES DEL MISMO ARCHIVO, y estas cinco viven en cinco temas
 * distintos del journey. Meterlas juntas hacia saltar `arctype-rotation`
 * comparando vecinos que no son vecinos.
 */
import { PrismaClient } from "../src/generated/prisma";
import * as fs from "fs";

const prisma = new PrismaClient();

type Vocab = { type?: string; word: string; surface?: string; definition: string };

type Patch = {
  remove?: string[];
  surface?: Record<string, string>;
  definition?: Record<string, string>;
  /** Cambia la ENTRADA entera (word incluido) conservando su posicion. */
  rewrite?: Record<string, Vocab>;
  add?: Vocab[];
};

const PATCHES: Record<string, Patch> = {
  // ── work-and-office#1 ────────────────────────────────────────────────────
  "duzen-auf-eigene-gefahr": {
    remove: ["der Dienstausweis"],
    surface: {
      "auf eigene Gefahr": "Gefahr",
      "im Hals stecken bleiben": "stecken",
      "unter Druck": "Druck",
    },
  },

  // ── housing-and-flatshare#1 ─────────────────────────────────────────────
  "bewerbungsgespraech-mit-katze": {
    remove: ["der Gehaltsnachweis", "das Führungszeugnis"],
    surface: { "im Eiltempo": "Eiltempo", "ohne Umweg": "Umweg" },
    definition: {
      "das Empfehlungsschreiben":
        "A letter in which someone vouches in writing for your character.",
      übertreiben: "To exaggerate, blowing something up far bigger than it really is.",
      "im Eiltempo": "At top speed, rushing through something in a visible hurry.",
      thronen: "To sit enthroned, placed majestically above everyone in the room.",
      einzeln: "One by one, each of them taken separately in their turn.",
      inoffiziell:
        "Unofficially; true in daily practice although nobody has ever declared it.",
      "der Segen": "A blessing, the approval of whoever really rules the place.",
      "das Bauchgefühl": "A gut feeling; the belly decides before the head can argue.",
      "ohne Umweg": "Straight there, by the shortest way, with no detour at all.",
      neidisch: "Envious, quietly resentful that someone else got the luck.",
      "der Mietvertrag":
        "The rental contract signed between a tenant and the landlord.",
    },
  },

  // ── friends-and-free-time#1 ─────────────────────────────────────────────
  "ein-antrag-auf-freizeit": {
    remove: ["der Mitgliedsantrag"],
    surface: {
      // Verbos separables partidos por el cuerpo: el surface era una oracion
      // entera, no una palabra. El pill se ancla al token que sí esta ahi.
      beitreten: "tritt",
      ausfüllen: "füllen",
      "sich entscheiden": "entscheiden",
      "ohne Formular kein Vergnügen": "Vergnügen",
      "auf Probe": "Probe",
    },
    rewrite: {
      // "dagegen stimmen" comparte raiz con "die Abstimmung", que ya esta en
      // la misma historia: el lector aprendia dos veces stimm-. El adverbio
      // suelto vale por si mismo, viaja a cualquier discusion y no duplica.
      "dagegen stimmen": {
        type: "adverb",
        word: "dagegen",
        surface: "dagegen",
        definition: "Against it, opposed to what is being proposed right now.",
      },
    },
  },

  // ── arrival-and-registration#3 ──────────────────────────────────────────
  "zwei-stempel-bis-zur-existenz": {
    remove: ["die Anmeldebestätigung"],
    surface: { "eine halbe Ewigkeit": "Ewigkeit" },
    definition: {
      // "expression" y "grasp" son ingles B1+ dentro de una definicion que
      // lee un principiante. El validador lo avisa; se corrige igual.
      "die Miene": "The look on someone's face that shows what they feel.",
      begreifen: "To finally understand how something really works, deep down.",
    },
  },

  // ── housing-and-flatshare#3 ─────────────────────────────────────────────
  "umzug-ohne-aufzug": {
    remove: ["das Übergabeprotokoll", "der Zählerstand"],
    surface: {
      "nach reiflicher Überlegung": "Überlegung",
      "Schritt für Schritt": "Schritt",
    },
    definition: {
      "die Schramme": "A scratch or scrape left as a mark on a surface.",
      erben: "To inherit something and keep what the previous owner left you.",
      "der Stammbaum": "A family tree showing the documented line of someone's ancestors.",
      bestehen: "To pass a test or a trial that could have gone wrong.",
      bewohnbar: "Habitable, in a state where a person can actually live.",
      verdient: "Deserved: the honest result of real effort, not of luck.",
      "Schritt für Schritt": "Step by step, one small stage at a time until done.",
    },
    // Las dos que sustituyen a los papeles. Salen del PROPIO texto, se repiten
    // dentro de la historia y son cocina de todos los dias, no tramite.
    add: [
      {
        type: "noun",
        word: "der Herd",
        surface: "Herd",
        definition: "The stove in a kitchen, the flat surface where you cook.",
      },
      {
        type: "verb",
        word: "regeln",
        surface: "regelt",
        definition: "To settle something and set the rule for how it works.",
      },
    ],
  },
};

async function main() {
  const outDir = "scripts/_expatOut";
  fs.mkdirSync(outDir, { recursive: true });

  // La fuente es el SNAPSHOT previo al parche, no la base. Leer de la base
  // hacia el script no idempotente: al segundo pase `remove` no encontraba
  // nada y `add` duplicaba las dos entradas nuevas.
  const snapshot = JSON.parse(fs.readFileSync("scripts/_expatSrc.json", "utf8")) as any[];

  for (const [slug, patch] of Object.entries(PATCHES)) {
    const s = snapshot.find((x) => x?.slug === slug);
    if (!s) { console.log(`NO ENCONTRADA EN EL SNAPSHOT: ${slug}`); continue; }

    const vocab = (Array.isArray(s.vocab) ? s.vocab : []) as unknown as Vocab[];
    const before = vocab.length;
    const drop = new Set((patch.remove ?? []).map((w) => w.toLowerCase()));

    const kept = vocab.filter((v) => !drop.has(v.word.toLowerCase()));
    if (kept.length !== before - drop.size) {
      console.log(`  !! ${slug}: esperaba quitar ${drop.size}, quito ${before - kept.length}`);
    }

    const next = kept.map((v) => {
      const rw = patch.rewrite?.[v.word];
      if (rw) return { ...rw };
      const out = { ...v };
      const surf = patch.surface?.[v.word];
      if (surf) out.surface = surf;
      const def = patch.definition?.[v.word];
      if (def) out.definition = def;
      return out;
    });
    for (const a of patch.add ?? []) next.push(a);

    // Cinturon: todo surface tiene que estar LITERALMENTE en el cuerpo, que es
    // justo lo que el validador comprueba y lo que el reader necesita.
    const body = (s.text ?? "").toLowerCase();
    for (const v of next) {
      const needle = (v.surface ?? v.word).toLowerCase();
      if (!body.includes(needle)) console.log(`  !! ${slug}: "${v.word}" surface "${needle}" NO esta en el cuerpo`);
    }

    console.log(`${slug}: ${before} -> ${next.length}`);
    fs.writeFileSync(
      `${outDir}/${slug}.json`,
      JSON.stringify([{ ...s, vocab: next }], null, 2)
    );
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
