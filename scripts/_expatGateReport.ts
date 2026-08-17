/**
 * Prepara la correccion de las historias del Expat que fallan el gate de
 * utilidad. SOLO LECTURA: no escribe nada, ni DB ni audio.
 *
 * Por cada historia marcada: que palabra falla, cuanto margen hay sobre el
 * minimo de 20 del validador, y candidatas sacadas del PROPIO TEXTO que sí
 * valen la pena ensenar (recurrentes en el corpus, no ya en el vocab, no
 * nombres propios).
 */
import { PrismaClient } from "../src/generated/prisma";
import { findLookupOnlyVocab } from "../src/lib/vocabUtility";
import { isGermanA1A2 } from "../src/lib/cefr/germanA1A2";

const prisma = new PrismaClient();
const STOP = new Set("der die das den dem des ein eine einen einem einer und oder aber wenn als dass ist sind war waren hat haben wird werden sich nicht auch nur noch schon mehr sehr mit von zu in an auf für bei nach über unter vor durch ohne um ich du er sie es wir ihr man mich dir ihm ihn uns euch sein ihre seine dein mein kein keine was wer wie wo wann warum hier dort jetzt dann so ja nein doch mal etwas nichts alle alles jeder immer wieder schon zum zur im am beim vom ins aufs".split(" "));

async function main() {
  const j = await prisma.journey.findFirst({ where: { name: "Expat", status: "active" }, select: { id: true } });
  if (!j) return console.log("journey no encontrado");
  const stories = await prisma.journeyStory.findMany({
    where: { journeyId: j.id, status: "published" },
    select: { slug: true, title: true, text: true, vocab: true },
    orderBy: { slug: "asc" },
  });

  // Frecuencia de cada token en TODO el corpus aleman publicado.
  const all = await prisma.journeyStory.findMany({
    where: { status: "published", journey: { language: { equals: "german", mode: "insensitive" }, status: { notIn: ["archived"] } } },
    select: { text: true },
  });
  const freq = new Map<string, number>();
  for (const s of all) for (const t of (s.text ?? "").toLowerCase().match(/\p{L}+/gu) ?? []) freq.set(t, (freq.get(t) ?? 0) + 1);

  // Nombres propios: tokens que SIEMPRE aparecen capitalizados a media frase.
  const propios = new Set<string>();
  for (const st of all) {
    for (const m of (st.text ?? "").matchAll(/(?<![.!?"\n]\s)(?<=\s)(\p{Lu}\p{Ll}{2,})/gu)) {
      const w = m[1];
      if (!(st.text ?? "").includes(w.toLowerCase())) propios.add(w.toLowerCase());
    }
  }

  let n = 0;
  for (const s of stories) {
    const vocab = (Array.isArray(s.vocab) ? s.vocab : []) as Array<Record<string, unknown>>;
    const flagged = findLookupOnlyVocab(vocab.map((v) => ({
      word: String(v.word ?? ""), definition: String(v.definition ?? ""),
      type: String(v.type ?? ""), register: String(v.register ?? ""),
    })));
    if (flagged.length === 0) continue;
    n += 1;

    const inVocab = new Set(vocab.map((v) => String(v.word ?? "").toLowerCase().replace(/^(der|die|das)\s+/, "")));
    const cands = [...new Set((s.text ?? "").match(/\p{Lu}\p{L}{4,}|\p{Ll}\p{L}{5,}/gu) ?? [])]
      .map((w) => w.toLowerCase())
      // Fuera lo que un C1 ya sabe (lista A1/A2 del proyecto) y los nombres
      // propios: el spec prohibe ensenarlos, y la frecuencia bruta los sube
      // a lo alto (nadia salia con 231 apariciones).
      .filter((w) => !STOP.has(w) && !inVocab.has(w) && !isGermanA1A2(w) && !propios.has(w))
      .map((w) => ({ w, f: freq.get(w) ?? 0 }))
      .filter((c) => c.f >= 3)
      .sort((a, b) => b.f - a.f)
      .slice(0, 6);

    console.log(`\n── ${s.slug}   vocab=${vocab.length}  margen=${vocab.length - 20}`);
    for (const f of flagged) console.log(`   QUITAR: ${f.word}`);
    console.log(`   candidatas del texto (por recurrencia en el corpus): ${cands.map((c) => `${c.w}(${c.f})`).join(", ") || "ninguna con freq>=3"}`);
  }
  console.log(`\nhistorias afectadas: ${n}`);
}
main().catch(console.error).finally(() => prisma.$disconnect());
