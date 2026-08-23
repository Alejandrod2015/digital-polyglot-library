/**
 * Auditoria de los sets de practica del Traveler DE A0 contra las reglas que
 * ya estan escritas en el proyecto: cobertura, frases que ya no existen en el
 * texto, los cuatro defectos de distractor del constructor automatico
 * ([[project_practice_autobuilder_limits]]), nombres propios en la oracion
 * (regla 8 de autoria, que rompe el TTS), guiones largos y topes de longitud.
 * Solo lectura.
 *
 *   npx tsx scripts/_dePracticeAudit.ts
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";

const p = new PrismaClient();
const JID = "cmt0a8vb1000m32p1x7r5ba28";
const NOMBRES = ["Hannah", "Elias", "Sophie", "Noah", "Emilia", "Leon", "Marie"];
// El hueco se come el determinante ("die Glocken" por el vocab "die Glocke"),
// asi que para comparar contra el vocab hay que quitar articulo y flexion.
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim()
  .replace(/^(der|die|das|den|dem|des|ein|eine|einen|einem|einer)\s+/, "");
const raiz = (s: string) => norm(s).replace(/(en|er|es|e|n|s|t)$/, "");

type Ex = { type: string; word: string; sentence: string; featured: boolean; payload: any };

(async () => {
  const j = await p.journey.findUnique({ where: { id: JID }, select: { topics: true } });
  const order = j?.topics ?? [];
  const st = (await p.journeyStory.findMany({
    where: { journeyId: JID, NOT: { text: null } },
    select: { slug: true, text: true, vocab: true, topic: true, slotIndex: true,
              practiceSet: { select: { locked: true, exercises: { orderBy: { orderIndex: "asc" } } } } },
  })).sort((a, b) => (order.indexOf(a.topic) - order.indexOf(b.topic)) || (a.slotIndex - b.slotIndex));

  const acc: Record<string, number> = {};
  const bump = (k: string, n = 1) => { acc[k] = (acc[k] ?? 0) + n; };
  const muestras: Record<string, string[]> = {};
  const guarda = (k: string, s: string) => { (muestras[k] ??= []).length < 3 && muestras[k].push(s); };

  let totalEx = 0, totalFill = 0, totalMeaning = 0;
  for (const s of st) {
    const cuerpo = String(s.text).replace(/\s+/g, " ");
    const vocab = ((s.vocab as any[]) ?? []);
    const lemas = new Set(vocab.map((v) => norm(String(v.word))));
    const surfaces = new Set(vocab.map((v) => norm(String(v.surface ?? v.word))));
    const exs = (s.practiceSet?.exercises ?? []) as unknown as Ex[];
    totalEx += exs.length;

    // cobertura del vocab
    const cubiertas = new Set(exs.flatMap((e) => String(e.word).split(",").map(norm)));
    const sinCubrir = vocab.filter((v) => !cubiertas.has(norm(String(v.word))) && !cubiertas.has(norm(String(v.surface ?? v.word))));
    bump("plazas de vocab sin ningun ejercicio", sinCubrir.length);
    bump("plazas de vocab totales", vocab.length);

    for (const e of exs) {
      const sent = String(e.sentence ?? "");
      const limpio = sent.replace(/\[\[|\]\]/g, "").replace(/\s+/g, " ").trim();

      // la palabra objetivo tiene que ser del vocab de SU historia
      for (const w of String(e.word).split(",")) {
        const raices = new Set([...lemas, ...surfaces].map(raiz));
        if (w && !lemas.has(norm(w)) && !surfaces.has(norm(w)) && !raices.has(raiz(w))) { bump("palabra objetivo fuera del vocab de su historia"); guarda("fuera-vocab", `${s.slug}: ${w}`); }
      }
      if (/[—–]/.test(sent) || /[—–]/.test(JSON.stringify(e.payload))) { bump("guion largo"); guarda("emdash", `${s.slug}: ${sent.slice(0, 50)}`); }

      if (e.type === "meaning_in_context") {
        totalMeaning++;
        if (!/\[\[[^\]]+\]\]/.test(sent)) { bump("meaning sin [[ ]]"); guarda("sin-marcas", `${s.slug}: ${sent.slice(0, 60)}`); }
        // la oracion tiene que seguir existiendo en el texto
        // En un set CURADO la oracion se escribe de nuevo (sin nombres, recortada),
        // asi que no tiene por que salir literal del cuerpo. El chequeo solo vale
        // contra un set AUTOMATICO, que copia la frase de la historia.
        const auto = !(e.payload?.translation || /\[\[/.test(sent));
        const trozo = limpio.split(" ").slice(0, 5).join(" ");
        if (auto && trozo.split(" ").length >= 4 && !cuerpo.includes(trozo)) { bump("meaning: oracion que ya no esta en el texto"); guarda("stale", `${s.slug}: ${limpio.slice(0, 60)}`); }
        if (limpio.split(/\s+/).length > 14) { bump("meaning: oracion de mas de 14 palabras"); guarda("larga-m", `${s.slug}: ${limpio.slice(0, 70)}`); }
      }

      if (e.type === "fill_blank") {
        totalFill++;
        const opts: string[] = (e.payload?.options ?? []).map(String);
        const ans = String(e.payload?.answer ?? "");
        if (new Set(opts).size !== opts.length) { bump("fill: opciones duplicadas"); guarda("dup", `${s.slug}: ${opts.join(" / ")}`); }
        if (opts.length !== 4) { bump("fill: no tiene 4 opciones"); guarda("n-opts", `${s.slug}: ${opts.length}`); }
        // mayuscula: en aleman el sustantivo va en mayuscula, asi que una
        // opcion con caja distinta a la respuesta la regala
        const dis = opts.filter((o) => o !== ans);
        const caja = (w: string) => /^[A-ZÄÖÜ]/.test(w);
        if (dis.some((o) => caja(o) !== caja(ans))) { bump("fill: distractor con mayuscula distinta a la respuesta"); guarda("caja", `${s.slug}: ${ans} vs ${dis.join(", ")}`); }
        // terminacion: respuesta flexionada y distractores en infinitivo. Solo
        // se mide en respuestas de UNA palabra: con articulo ("die Kante") el
        // test de terminacion marca cualquier plural aleman.
        const inf = (w: string) => !w.includes(" ") && /(en|ern|eln)$/.test(w) && !caja(w);
        if (!ans.includes(" ") && !inf(ans) && dis.filter(inf).length >= 2) { bump("fill: respuesta flexionada y distractores en infinitivo"); guarda("forma", `${s.slug}: ${ans} vs ${dis.join(", ")}`); }
        // distractor que ya sale en la propia frase
        const enFrase = dis.filter((o) => new RegExp(`\\b${o.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(limpio));
        if (enFrase.length) { bump("fill: distractor que ya aparece en la frase"); guarda("en-frase", `${s.slug}: ${enFrase.join(", ")} en «${limpio.slice(0, 50)}»`); }
        // Un hueco con dos palabras alrededor no tiene pista semantica: se
        // acierta por descarte, no por entender la palabra.
        const contexto = limpio.replace(/_{3,}/g, " ").split(/\s+/).filter((t) => /\p{L}/u.test(t));
        if (contexto.length < 4) { bump("fill: hueco casi sin contexto (menos de 4 palabras)"); guarda("sin-pista", `${s.slug}: ${limpio}`); }
        // Categoria gramatical: si los distractores son de otro tipo, la
        // gramatica delata la respuesta.
        const tipoDe = (w: string) => vocab.find((v) => norm(String(v.surface ?? v.word)) === norm(w) || norm(String(v.word)) === norm(w))?.type;
        const tAns = tipoDe(ans);
        const tipos = dis.map(tipoDe).filter(Boolean);
        if (tAns && tipos.length && tipos.every((t) => t !== tAns)) { bump("fill: distractores de otra categoria gramatical"); guarda("pos", `${s.slug}: ${ans} (${tAns}) vs ${dis.join(", ")}`); }
        // Hueco a mitad de palabra: la terminacion se queda fuera y ninguna
        // otra opcion encaja con ella ("_____n schlagen sechs").
        if (/_{3,}\p{L}/u.test(limpio)) { bump("fill: hueco a mitad de palabra"); guarda("medio", `${s.slug}: ${limpio.slice(0, 55)}`); }
        if (!e.payload?.translation) bump("fill: sin translation");
        if (!e.payload?.optionTranslations) bump("fill: sin optionTranslations");
        if (limpio.split(/\s+/).length > 12) { bump("fill: oracion de mas de 12 palabras"); guarda("larga-f", `${s.slug}: ${limpio.slice(0, 70)}`); }
      }

      const abre = (limpio.match(/“/g) ?? []).length, cierra = (limpio.match(/”/g) ?? []).length;
      if (abre !== cierra) { bump("oracion con comilla huerfana"); guarda("comilla", `${s.slug}: ${limpio.slice(0, 55)}`); }

      // nombres propios: rompen el TTS y la QA de transcripcion
      if (NOMBRES.some((n) => new RegExp(`\\b${n}\\b`).test(limpio))) { bump("oracion con nombre propio de personaje"); guarda("nombre", `${s.slug}: ${limpio.slice(0, 60)}`); }
    }
  }

  console.log(`21 sets · ${totalEx} ejercicios (${totalFill} fill_blank, ${totalMeaning} meaning_in_context)\n`);
  for (const [k, v] of Object.entries(acc).sort((a, b) => b[1] - a[1])) console.log(`${String(v).padStart(4)}  ${k}`);
  console.log("");
  for (const [k, v] of Object.entries(muestras)) console.log(`[${k}] ${v.join(" | ")}`);
  await p.$disconnect();
})();
