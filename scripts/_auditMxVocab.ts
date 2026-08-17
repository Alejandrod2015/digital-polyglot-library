import { config } from "dotenv";
config({ path: ".env.local" }); config({ path: ".env" });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();

const BOOK = "short-stories-in-mexican-spanish";

type V = { word: string; definition: string; type?: string };

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

// Palabras funcionales que no merecen entrada de vocabulario en un B1.
const FUNCTION_WORDS = new Set([
  "el","la","los","las","un","una","unos","unas","de","del","a","al","en","con",
  "por","para","y","o","pero","que","como","si","no","sí","su","sus","mi","mis",
  "tu","tus","es","son","era","eran","ser","estar","este","esta","esto","ese",
  "esa","eso","muy","más","menos","ya","también","cuando","donde","porque",
]);

const VALID_TYPES = new Set([
  "noun","verb","adjective","adverb","expression","phrase","idiom","preposition",
  "conjunction","pronoun","interjection",
]);

// Marcadores de ortografía británica vs estadounidense en las definiciones.
const BRITISH = /\b\w*(?:our|ise|ised|ising|isation|yse|ysed|tre|logue|lled|lling|ller)\b/gi;
const BRIT_KNOWN = [
  "flavour","flavours","colour","colours","neighbour","neighbours","favour",
  "favourite","favourites","honour","labour","harbour","behaviour","odour",
  "rumour","savour","splendour","theatre","centre","litre","metre","fibre",
  "realise","realised","organise","organised","recognise","recognised",
  "apologise","emphasise","memorise","specialise","analyse","analysed",
  "catalogue","dialogue","travelled","travelling","traveller","cancelled",
  "marvellous","jewellery","practise","chilli","chillies","tyre","pyjamas",
  "moustache","grey","aluminium","plough","sceptical","storey","whisky",
];

async function main() {
  const stories = await p.catalogStory.findMany({
    where: { bookId: BOOK },
    orderBy: { position: "asc" },
    select: { position: true, slug: true, title: true, text: true, vocab: true },
  });

  const seenGlobal = new Map<string, number[]>(); // palabra -> posiciones
  const rows: string[] = [];
  let totalEntries = 0;

  const issues: Record<string, string[]> = {
    notInText: [],
    dupInStory: [],
    emptyDef: [],
    badType: [],
    noType: [],
    functionWord: [],
    defEqualsWord: [],
    longDef: [],
    multiWord: [],
    britishSpelling: [],
    capitalized: [],
  };

  for (const s of stories) {
    const vocab = (s.vocab ?? []) as unknown as V[];
    totalEntries += vocab.length;
    const textNorm = norm(s.text);
    const seenHere = new Set<string>();
    const words = vocab.length;
    const chars = s.text.length;
    const density = ((words / (chars / 5)) * 100).toFixed(1); // % sobre palabras aprox
    rows.push(
      `${String(s.position).padStart(2)} | ${String(words).padStart(2)} entradas | ${String(chars).padStart(5)} chars | ~${density}% | ${s.slug}`
    );

    for (const v of vocab) {
      const w = (v.word ?? "").trim();
      const d = (v.definition ?? "").trim();
      const t = (v.type ?? "").trim();
      const key = norm(w);
      const tag = `[${s.position}] "${w}"`;

      if (!textNorm.includes(key)) issues.notInText.push(`${tag} -> "${d}"`);
      if (seenHere.has(key)) issues.dupInStory.push(tag);
      seenHere.add(key);
      if (!seenGlobal.has(key)) seenGlobal.set(key, []);
      seenGlobal.get(key)!.push(s.position);

      if (!d) issues.emptyDef.push(tag);
      if (!t) issues.noType.push(tag);
      else if (!VALID_TYPES.has(t)) issues.badType.push(`${tag} type="${t}"`);
      if (norm(d) === key) issues.defEqualsWord.push(`${tag} -> "${d}"`);
      if (d.split(/\s+/).length > 8) issues.longDef.push(`${tag} -> "${d}"`);
      if (FUNCTION_WORDS.has(key) && !w.includes(" "))
        issues.functionWord.push(`${tag} -> "${d}"`);
      if (w.includes(" ")) issues.multiWord.push(`${tag} (${w.split(/\s+/).length} palabras)`);
      if (/^[A-ZÁÉÍÓÚÑ]/.test(w)) issues.capitalized.push(`${tag} -> "${d}"`);

      const dl = d.toLowerCase();
      for (const b of BRIT_KNOWN) {
        if (new RegExp(`\\b${b}\\b`).test(dl)) {
          issues.britishSpelling.push(`${tag} -> "${d}"  [${b}]`);
          break;
        }
      }
    }
  }

  console.log("=== DENSIDAD POR HISTORIA ===");
  rows.forEach((r) => console.log(r));
  console.log(`\nTOTAL entradas: ${totalEntries}`);

  console.log("\n=== REPETICIONES ENTRE HISTORIAS ===");
  const repeated = [...seenGlobal.entries()]
    .filter(([, pos]) => pos.length > 1)
    .sort((a, b) => b[1].length - a[1].length);
  console.log(`palabras repetidas en 2+ historias: ${repeated.length}`);
  for (const [w, pos] of repeated.slice(0, 40)) {
    console.log(`  ${w.padEnd(24)} x${pos.length}  historias ${pos.join(",")}`);
  }

  console.log("\n=== HALLAZGOS ===");
  for (const [k, list] of Object.entries(issues)) {
    console.log(`\n-- ${k}: ${list.length}`);
    list.slice(0, 25).forEach((l) => console.log(`   ${l}`));
    if (list.length > 25) console.log(`   ... y ${list.length - 25} más`);
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
