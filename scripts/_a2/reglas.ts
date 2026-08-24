/** Las reglas que NINGUN gate mide, sobre las 21 ya guardadas. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import * as fs from "fs";
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const st = await p.journeyStory.findMany({
    where: { journeyId: "cmt70xfyt000l3283gxd70wck" },
    select: { slug: true, topic: true, slotIndex: true, title: true, text: true, vocab: true },
    orderBy: [{ topic: "asc" }, { slotIndex: "asc" }],
  });
  const V = (s: any) => (s.vocab ?? []) as Array<{ word: string; surface?: string; type?: string; definition: string; anchor?: boolean }>;

  // 1. glosas con "="
  const g = JSON.parse(fs.readFileSync("src/data/tapGlosses/spanish-traveler-spain-a2.json", "utf8")).glosses;
  const conIgual = Object.entries(g as Record<string, { g: string }>).filter(([, v]) => v.g.includes("="));
  console.log(`1. glosas con "=" : ${conIgual.length}`);

  // 2. imperativo breve como UNICA oracion del turno
  const IMP = /^(?:¡)?\s*(?:[A-ZÁÉÍÓÚÑ][a-zá-úñ]+(?:me|te|le|lo|la|los|las|se|nos)*)\b/;
  const VERBOS_IMP = /^(?:Bájame|Llévatelo|Pásate|Siéntate|Pela|Córtalas|Échalas|Prueba|Dime|Toca|Guarda|Ponlo|Busca|Empuja|Mira|Pregunta|Revuelve|Ordena|Descansa|Sigue|Suelta|Verifique|Enciende|Come|Espera)\b/;
  const malos: string[] = [];
  for (const s of st) for (const m of s.text.matchAll(/“([^”]+)”/g)) {
    const turno = m[1].trim();
    const oraciones = turno.split(/(?<=[.!?])\s+/).map((x) => x.trim()).filter(Boolean);
    if (oraciones.length > 1) continue;                       // hay segunda oracion: limpio
    if (!VERBOS_IMP.test(turno) && !IMP.test(turno)) continue;
    if (!VERBOS_IMP.test(turno)) continue;
    const pal = turno.replace(/[¡!¿?.,;:]/g, "").split(/\s+/).filter(Boolean).length;
    if (pal <= 4) malos.push(`${s.slug}: “${turno}”`);
  }
  console.log(`2. imperativo breve solo en su turno: ${malos.length}`);
  for (const x of malos) console.log(`     ${x}`);

  // 3. relativa colgando al final de la oracion
  const rel: string[] = [];
  for (const s of st) for (const f of s.text.split(/(?<=[.!?”])\s+/)) {
    const t = f.trim().replace(/[”"]$/, "");
    if (/\b(que|quien|donde|cuyo|cuya)\b[^.?!]{6,}[.?!]?$/i.test(t) && /\b(que|quien|donde)\b/.test(t.slice(-60))) {
      const cola = t.slice(t.toLowerCase().lastIndexOf(" que ") + 1);
      if (/^que\b/.test(cola) && cola.split(/\s+/).length >= 3 && cola.split(/\s+/).length <= 9) rel.push(`${s.slug}: …${cola}`);
    }
  }
  console.log(`3. frases que cierran con relativa: ${rel.length}`);
  for (const x of rel) console.log(`     ${x}`);

  // 4. ancladas marcadas
  const conAnchor = st.flatMap(V).filter((v) => v.anchor === true).length;
  const totalPlazas = st.flatMap(V).length;
  console.log(`4. plazas marcadas anchor: ${conAnchor}/${totalPlazas}`);

  // 5. slang declarado
  const slang = st.flatMap((s) => V(s).filter((v) => (v.type ?? "").toLowerCase() === "slang").map((v) => `${s.slug}:${v.word}`));
  console.log(`5. vocab tipo slang: ${slang.length} ${slang.join(", ")}`);

  // 6. tipos validos y definiciones
  const TIPOS = new Set(["verb","noun","adjective","adverb","expression","slang","preposition","number","pronoun"]);
  const tipoMal = st.flatMap((s) => V(s).filter((v) => !TIPOS.has((v.type ?? "").toLowerCase())).map((v) => `${s.slug}:${v.word}(${v.type})`));
  console.log(`6. tipos de vocab fuera de la lista: ${tipoMal.length} ${tipoMal.join(", ")}`);
})().finally(() => p.$disconnect());
