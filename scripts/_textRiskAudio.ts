// Frases con riesgo de hacer tropezar al sintetizador, detectadas SOBRE EL
// TEXTO. No gasta audio: no llama a ElevenLabs ni transcribe.
//
// De dónde sale: las 5 frases confirmadas por oído en el journey PT comparten
// una forma. Una palabra que ACABA en vocal, seguida de una partícula átona de
// una sola vocal ("a", "o", "e"), seguida de otra palabra que EMPIEZA por
// vocal. Tres vocales seguidas sin consonante que las separe:
//
//   "atravess[a] [a] [a]reia"      → truncado "a--"
//   "ajud[a] [a] [e]ncher"         → "desencher"
//   "sob[e] [a] [e]scada"          → "pras pras"
//   "par[a] [a] [j]anela"          → balbuceo entre frente y janela
//
// El modelo se come o repite la partícula, porque en habla real esas vocales
// se funden. El arreglo no es re-tirar la toma: es reescribir la frase.
import { config } from "dotenv"; config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();

const VOCAL = /[aeiouáéíóúâêôãõà]/i;
// SOLO artículos y preposiciones de una vocal. La conjunción "e" queda fuera:
// aparece constantemente en portugués ("castanha e entrega") y ninguna de las
// frases confirmadas por oído la tenía. Incluirla daba 57 avisos de los cuales
// la inmensa mayoría eran sanos.
const ATONAS = new Set(["a", "o", "as", "os"]);
// El otro patrón confirmado: "para a/as/o/os", que en habla real se contrae a
// "pra/pras/pro/pros". Ahí el modelo duda entre decirlo y contraerlo, y sale el
// balbuceo, aunque la palabra siguiente NO empiece por vocal ("para a janela").
const CONTRACCION = /\bpara\s+(a|as|o|os)\s+\w+/gi;

/** Devuelve los tramos de riesgo de una frase. */
export function riesgos(frase: string): string[] {
  const pal = frase.split(/\s+/).map((w) => w.replace(/[^\wáéíóúâêôãõàç]/gi, ""));
  const out: string[] = [];
  for (let i = 1; i < pal.length - 1; i++) {
    const prev = pal[i - 1], cur = pal[i].toLowerCase(), next = pal[i + 1];
    if (!prev || !cur || !next) continue;
    if (!ATONAS.has(cur)) continue;
    const prevAcabaVocal = VOCAL.test(prev.slice(-1));
    const nextEmpiezaVocal = VOCAL.test(next[0] ?? "");
    if (prevAcabaVocal && nextEmpiezaVocal) out.push(`${prev} ${pal[i]} ${next}`);
    // VOCAL REPETIDA: la palabra ACABA en la misma vocal que el artículo que
    // la sigue ("dobr[a] [a]", "cheg[a] [a]", "atravess[a] [a]"). Las dos
    // vocales se funden en el habla y el modelo se come o dobla la partícula.
    // Es el patrón que comparten TODAS las frases confirmadas por oído, y no
    // exige que la palabra siguiente empiece por vocal: "dobra a esquina"
    // rompía y "chega a perguntar" también, con consonante detrás.
    else if (prev.slice(-1).toLowerCase() === cur && cur.length === 1) {
      out.push(`${prev} ${pal[i]} ${next}`);
    }
  }
  for (const m of frase.matchAll(CONTRACCION)) out.push(m[0]);
  return out;
}

async function main() {
  const soloUno = process.argv[2];
  const journeys = await p.journey.findMany({
    where: { status: { notIn: ["archived", "draft"] }, ...(soloUno ? { language: { equals: soloUno, mode: "insensitive" } } : {}) },
    select: { id: true, name: true, language: true, variant: true },
  });
  for (const j of journeys) {
    const st = await p.journeyStory.findMany({ where: { journeyId: j.id, status: "published" }, select: { slug: true, text: true } });
    let total = 0;
    const detalle: string[] = [];
    for (const s of st) {
      for (const frase of (s.text ?? "").split(/(?<=[.!?])\s+/)) {
        const r = [...new Set(riesgos(frase.trim()))];
        if (!r.length) continue;
        total += r.length;
        detalle.push(`   ${s.slug}\n      tramo: ${r.map((x) => `«${x}»`).join(" · ")}\n      frase: ${frase.trim()}`);
      }
    }
    console.log(`\n${j.language}/${j.variant} · ${j.name} → ${total} tramos de riesgo en ${st.length} historias`);
    for (const d of detalle) console.log(d);
  }
}
// Solo corre el informe si se invoca directamente; así otro script puede
// importar `riesgos` sin disparar una consulta a la base.
if (require.main === module) main().finally(() => p.$disconnect());
else void p.$disconnect();
