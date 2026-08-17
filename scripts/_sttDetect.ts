// Detector v2 de audio roto. Solo TRANSCRIBE (no genera audio).
//
// v1 fallaba por comparar bolsas de palabras: un audio que balbucea y luego
// dice la frase correcta pasaba como bueno. Y no miraba la señal más directa
// de todas: el reconocedor MARCA los truncamientos con "--" ("cen--",
// "sonete--"), que es literalmente el sonido cortado de un balbuceo.
//
// Cinco señales, de más a menos fiable:
//   1. TRUNCAMIENTO; "xxx--" en la transcripción. Casi nunca es ruido.
//   2. REPETICIÓN; la misma palabra dos veces seguidas.
//   3. NO-PALABRA; se oye algo que no está en el texto ni se le parece.
//   4. HUECO; silencio largo entre palabras (umbral 0.9s).
//   5. DIVERGENCIA; tramos de 2+ palabras que sobran o faltan.
//
// Filtra el ruido conocido de v1: números escritos con letra frente a dígitos,
// palabras con guion, y las contracciones habladas del portugués (para a→pra),
// que generaban 11 de 16 avisos falsos.
import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
const apiKey = process.env.ELEVENLABS_API_KEY!;

type W = { text: string; start?: number; end?: number; type?: string };
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-z0-9\s-]/gi," ").replace(/\s+/g," ").trim().toLowerCase();

// Contracciones y equivalencias que NO son errores: el habla real las hace.
const EQUIV: Array<[RegExp, string]> = [
  [/\bpra\b/g, "para a"], [/\bpras\b/g, "para as"], [/\bpro\b/g, "para o"],
  [/\bpros\b/g, "para os"], [/\bnum\b/g, "em um"], [/\bnuma\b/g, "em uma"],
  [/\bda\b/g, "de a"], [/\bdo\b/g, "de o"], [/\bna\b/g, "em a"], [/\bno\b/g, "em o"],
];
const NUM: Record<string,string> = { "0":"zero","1":"um","2":"dois","3":"tres","4":"quatro","5":"cinco","6":"seis","7":"sete","8":"oito","9":"nove","10":"dez","20":"vinte","30":"trinta","40":"quarenta","50":"cinquenta","100":"cem" };
function canon(s: string): string {
  let t = norm(s).replace(/-/g, " ");
  for (const [re, rep] of EQUIV) t = t.replace(re, rep);
  t = t.replace(/\b\d+\b/g, (d) => NUM[d] ?? d);
  return t.replace(/\s+/g, " ").trim();
}

async function transcribe(buf: Buffer): Promise<{ words: W[]; text: string }> {
  const fd = new FormData();
  fd.append("model_id","scribe_v1"); fd.append("language_code","por"); fd.append("timestamps_granularity","word");
  fd.append("file", new Blob([new Uint8Array(buf)], { type: "audio/mpeg" }), "s.mp3");
  const r = await fetch("https://api.elevenlabs.io/v1/speech-to-text", { method:"POST", headers:{"xi-api-key":apiKey}, body:fd });
  if (!r.ok) throw new Error(`STT ${r.status}`);
  const j = (await r.json()) as { words?: W[]; text?: string };
  return { words: (j.words ?? []).filter(w => (w.type ?? "word") === "word"), text: j.text ?? "" };
}

(async () => {
  // Los flags no son historias: contarlos inflaba el recuento final.
  const slugs = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const rows: Array<{ slug:string; sev:string; t:number; que:string; frase?:string }> = [];
  for (const slug of slugs) {
    const s = await p.journeyStory.findFirst({ where: { slug }, select: { title:true, text:true, audioUrl:true } });
    if (!s?.audioUrl || !s.text) continue;
    const buf = Buffer.from(await (await fetch(s.audioUrl)).arrayBuffer());
    const argPas = process.argv.find(a => /^--x\d$/.test(a));
    const pasadas = argPas ? Number(argPas.slice(3)) : 1;
    const todas: W[][] = [];
    for (let k = 0; k < pasadas; k++) todas.push((await transcribe(buf)).words);
    const textoCanon = canon(s.text);
    // Oraciones del texto, para poder decir QUÉ FRASE hay que escuchar en vez
    // de un segundo suelto.
    const oraciones = s.text.split(/(?<=[.!?])\s+/).map(o => o.trim()).filter(Boolean);
    const oracionesCanon = oraciones.map(canon);
    /** Oración cuyo contenido casa con lo que se oye alrededor del índice i. */
    const oracionDe = (i: number, words: W[]): string => {
      for (let ventana = 4; ventana >= 2; ventana--) {
        const ctx = words.slice(Math.max(0, i - ventana), i + ventana).map(w => canon(w.text)).filter(Boolean);
        for (let k = 0; k + 1 < ctx.length; k++) {
          const par = `${ctx[k]} ${ctx[k + 1]}`;
          const idx = oracionesCanon.findIndex(o => o.includes(par));
          if (idx >= 0) return oraciones[idx];
        }
      }
      return "(no se pudo situar en el texto)";
    };

    for (const words of todas) {
    // Velocidad típica de ESTA narración (caracteres por segundo), como
    // referencia propia: cada voz y cada tempo tienen la suya.
    const velocidades: number[] = [];
    for (let i = 3; i < words.length; i++) {
      const v = words.slice(i - 3, i + 1);
      const t0 = v[0].start ?? 0, t1 = v[v.length - 1].end ?? 0;
      const chars = v.reduce((n, x) => n + norm(x.text).replace(/\s/g, "").length, 0);
      if (t1 > t0) velocidades.push(chars / (t1 - t0));
    }
    velocidades.sort((a, b) => a - b);
    const velocidadMediana = velocidades.length ? velocidades[Math.floor(velocidades.length / 2)] : 0;

    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      const t = w.start ?? 0;
      // La narración abre leyendo el TÍTULO, que no vive en `text`. Todo lo de
      // los primeros segundos sería un falso positivo sistemático.
      if (t < 2.5) continue;
      // 1. truncamiento
      if (/--\s*$/.test(w.text) || /\w--/.test(w.text)) rows.push({ slug, sev:"ALTA", t, que:`truncado "${w.text}"`, frase: oracionDe(i, words) });
      // 2. repetición
      if (i > 0 && norm(words[i-1].text) && norm(words[i-1].text) === norm(w.text)) rows.push({ slug, sev:"ALTA", t, que:`repite "${w.text}"`, frase: oracionDe(i, words) });
      // 3. palabra que no está en el texto. Distinguimos DOS casos, porque no
      //    pesan igual: una contracción real del habla ("pra" por "para a") es
      //    ruido esperado; una palabra que no existe en portugués Y no está en
      //    el texto ("Sepava", "osirzoneu", "desencher") es un balbuceo. Esta
      //    segunda es la señal que pilló las dos zonas que el usuario oyó, así
      //    que sube a ALTA.
      const cw = canon(w.text);
      const bare = norm(w.text).replace(/-/g, "");
      const esContraccion = EQUIV.some(([re]) => re.test(bare));
      if (cw.length >= 4 && !textoCanon.includes(cw)) {
        const raiz = bare.slice(0, Math.max(4, bare.length - 2));
        // El reconocedor reescribe nombres propios ("Thiago" por "Tiago"), así
        // que comparamos también sin la hache y sin dobles.
        const simple = (x: string) => x.replace(/h/g, "").replace(/(.)\1/g, "$1");
        const sinPlural = bare.replace(/s$/, "");
        // OJO: "parecerse" no basta. "dobra-se" contiene "dobra" y aun así es
        // OTRA palabra: el modelo añadió un pronombre. Si lo oído es más largo
        // que lo escrito y lo contiene, es una ADICIÓN, y se reporta.
        const contieneUnaDelTexto = textoCanon.split(" ").some(
          (t) => t.length >= 4 && bare.startsWith(t) && bare.length > t.length + 1
        );
        const pareceDelTexto =
          !contieneUnaDelTexto &&
          (textoCanon.includes(raiz) ||
            simple(textoCanon).includes(simple(bare)) ||
            (sinPlural.length >= 3 && new RegExp(`\\b${sinPlural}s?\\b`).test(textoCanon)));
        if (contieneUnaDelTexto) {
          rows.push({ slug, sev:"ALTA", t, que:`ALARGADA: se oye "${w.text}" donde el texto tiene una palabra más corta`, frase: oracionDe(i, words) });
        }
        rows.push({
          slug,
          sev: esContraccion || pareceDelTexto ? "MEDIA" : "ALTA",
          t,
          que: `se oye "${w.text}" (no está en el texto)`,
          frase: oracionDe(i, words),
        });
      }
      // 4. hueco
      // 3a-bis. INSERCIÓN CORTA. El umbral de 4 letras estaba puesto para no
      //     gritar con cada artículo, y es exactamente lo que escondió el "se"
      //     que el modelo mete en "chega a [se] perguntar".
      if (cw.length > 0 && cw.length < 4 && i > 0 && i < words.length - 1) {
        const antes = canon(words[i-1].text), despues = canon(words[i+1].text);
        const trio = `${antes} ${cw} ${despues}`.trim();
        const parAntes = `${antes} ${despues}`.trim();
        // Si el texto encadena las dos palabras vecinas SIN esta de por medio,
        // la de en medio sobra.
        if (antes && despues && !textoCanon.includes(trio) && textoCanon.includes(parAntes)) {
          rows.push({ slug, sev:"ALTA", t, que:`INSERTADA: se oye "${w.text}" entre "${words[i-1].text}" y "${words[i+1].text}"`, frase: oracionDe(i, words) });
        }
      }

      // 3b. RITMO: cuánto tarda el audio en decir lo que dice. Un balbuceo
      //     puede no transcribirse y aparecer solo como tiempo muerto entre dos
      //     palabras correctas ("frente [0.72s de nada] janela"). Se compara la
      //     velocidad de cada ventana de 4 palabras con la mediana de la
      //     historia; por debajo de la mitad, hay sonido que no es habla.
      if (i >= 3) {
        const v = words.slice(i - 3, i + 1);
        const t0 = v[0].start ?? 0, t1 = v[v.length - 1].end ?? 0;
        const chars = v.reduce((n, x) => n + norm(x.text).replace(/\s/g, "").length, 0);
        const cps = chars / Math.max(0.001, t1 - t0);
        const cruzaPunto = v.slice(0, -1).some(x => /[.!?]\s*$/.test(x.text));
        if (!cruzaPunto && velocidadMediana > 0 && cps < velocidadMediana * 0.5) {
          rows.push({ slug, sev:"ALTA", t: t0, que:`RITMO ROTO: "${v.map(x=>x.text).join(" ")}" tarda ${(t1-t0).toFixed(2)}s (${cps.toFixed(1)} car/s frente a ${velocidadMediana.toFixed(1)} de media)`, frase: oracionDe(i, words) });
        }
      }
      // 3c. Palabra de duración cero: el reconocedor no encontró dónde ponerla.
      if ((w.end ?? 0) - t <= 0.001) rows.push({ slug, sev:"ALTA", t, que:`duración CERO en "${w.text}"`, frase: oracionDe(i, words) });

      // 4. hueco. Tras punto o coma es respiración normal; en MITAD de una
      //    frase es donde se esconde el tropiezo, así que solo ese sube.
      if (i > 0) {
        const h = t - (words[i-1].end ?? 0);
        // ¿Hay puntuación en el TEXTO tras esa palabra? Si el reconocedor puso
        // una coma que el guion no tiene, la pausa no está justificada.
        const previa = norm(words[i-1].text).replace(/[^a-z0-9]/g, "");
        const enTexto = new RegExp(`\\b${previa}\\b\\s*[.,;:!?]`).test(canon(s.text!).replace(/\s+/g, " "))
          || new RegExp(`\\b${previa}\\b\\s*[.,;:!?]`).test(norm(s.text!));
        const trasPuntuacion = /[.!?]\s*$/.test(words[i-1].text) || enTexto;
        if (h >= 0.6) rows.push({ slug, sev: trasPuntuacion ? "BAJA" : "ALTA", t, que:`hueco de ${h.toFixed(2)}s ${trasPuntuacion ? "tras pausa" : "EN MITAD DE FRASE"} entre "${words[i-1].text}" y "${w.text}"`, frase: oracionDe(i, words) });
      }
    }
    } // fin de una pasada
  }

  // UNIÓN de pasadas: la misma señal en el mismo segundo cuenta una vez, y se
  // anota en cuántas pasadas apareció. Una señal que sale en 1 de 3 es más
  // frágil que una que sale en las 3, y eso hay que poder verlo.
  const vistas = new Map<string, { r: typeof rows[0]; veces: number }>();
  for (const r of rows) {
    const k = `${r.slug}|${r.que.replace(/[\d.]+/g, "")}|${Math.round(r.t)}`;
    const prev = vistas.get(k);
    if (prev) prev.veces++;
    else vistas.set(k, { r, veces: 1 });
  }
  rows.length = 0;
  for (const { r, veces } of vistas.values()) rows.push({ ...r, que: `${r.que}${veces > 1 ? `  [${veces} pasadas]` : ""}` });

  const orden = { ALTA:0, MEDIA:1, BAJA:2 } as Record<string,number>;
  // Historia primero: es la unidad con la que se trabaja y con la que se
  // escucha. Dentro, lo grave arriba y por orden de reproducción.
  const posSlug = new Map(slugs.map((sl, i) => [sl, i]));
  rows.sort((a,b) =>
    (posSlug.get(a.slug) ?? 99) - (posSlug.get(b.slug) ?? 99) ||
    orden[a.sev]-orden[b.sev] ||
    a.t-b.t
  );
  let last = "";
  for (const r of rows) {
    if (r.sev === "BAJA") continue; // respiraciones normales: no son defecto
    if (r.slug !== last) { console.log(`\n── ${r.slug}`); last = r.slug; }
    console.log(`   [${r.sev}] ${r.t.toFixed(1)}s  ${r.que}`);
    if (r.frase) console.log(`   [${r.sev}]        frase: "${r.frase}"`);
  }
  console.log(`\n${rows.filter(r=>r.sev==="ALTA").length} señales ALTAS · ${rows.filter(r=>r.sev==="MEDIA").length} MEDIAS · ${rows.filter(r=>r.sev==="BAJA").length} pausas normales (ocultas) · ${slugs.length} historias`);
})().catch(e=>{console.log("FATAL",e.message);process.exit(1);}).finally(()=>p.$disconnect());
