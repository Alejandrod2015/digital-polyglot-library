/**
 * Arma los sets de practica del Traveler IT A1.
 *
 * No inventa frases: cada ejercicio sale de una oracion REAL del cuerpo, la que
 * contiene la superficie enseñada, para que el `audioClip.sentence` sea texto de
 * la historia y no una frase paralela.
 *
 * Los distractores son palabras REALES del journey, del MISMO tipo y de OTRA
 * historia. Es lo que pide `project_practice_distractor_quality` y lo que evita
 * el fallo del constructor automatico, que regala la respuesta porque solo una
 * opcion encaja gramaticalmente.
 */
import { config } from "dotenv";
config({ path: ".env" }); config({ path: ".env.local" });
import * as fs from "fs";
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();
const TOPICS = ["roads-and-driving","phones-and-signal","rooms-and-keys","forest-and-hiking","village-festivals","pharmacy-emergencies","bureaucracy-and-paperwork"];
const GLOSS_RAW = JSON.parse(fs.readFileSync("src/data/tapGlosses/italian-traveler-a1.json","utf8")).glosses as Record<string,{g:string,t:string}>;
const GLOSS: Record<string,{g:string,t:string}> = {};
for (const [k,v] of Object.entries(GLOSS_RAW)) GLOSS[k.normalize("NFC").toLowerCase()] = v;
/** Limite de palabra que sirve con acentos: `\b` es ASCII y no ve la e de caffe. */
const lim = (w: string) => new RegExp(`(?<![\\p{L}])${w.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}(?![\\p{L}])`, "iu");
const frases = (t:string)=> t.replace(/\s*\n+\s*/g," ").split(/(?<=[.!?”])\s+/).map(x=>x.trim()).filter(Boolean);
/**
 * Recorta la oracion a la CLAUSULA que lleva la palabra. Las oraciones del
 * cuerpo van de 13 a 21 palabras y los ejercicios admiten 12 o 14, asi que
 * reusarlas enteras no cabe; y escribir frases paralelas seria enseñar sobre un
 * texto que el alumno no ha leido. Se corta por coma, `e`, `ma`, `pero` y `poi`,
 * que es donde el italiano separa clausulas, y se deja una frase de verdad.
 */
/** Un recorte tiene que leerse como una frase: fuera comillas sueltas, la
 *  conjuncion con la que empezaba la clausula y la puntuacion de los bordes. */
function limpiar(t: string): string {
  let x = t.replace(/[“”]/g, "")
    .replace(/^\s*(e|ma|però|poi|che|o)\s+/i, "")
    .replace(/^[,;:.\s]+|[,;:.\s]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  // Una ventana puede cortar detras de una preposicion o un articulo y dejar
  // "…dopo giorni di." Se recorta la cola hasta que la frase acabe en algo.
  const COLA = /\s+(con|di|da|in|su|per|tra|fra|e|che|a|al|allo|alla|ai|agli|alle|del|dello|della|dei|degli|delle|il|lo|la|i|gli|le|un|uno|una|senza|come|più|meno|anche|non|si|ci|ne|mi|ti|lo|li)$/i;
  while (COLA.test(x)) x = x.replace(COLA, "");
  return x.trim();
}
function clausula(frase: string, sup: string, max: number): string | null {
  const limpia = frase.replace(/[“”]/g, "").replace(/\s+/g, " ").trim();
  const re = lim(sup);
  if (pal(limpia) <= max) return limpia;
  const trozos = limpia.split(/,\s+|\s+e\s+|\s+ma\s+|\s+però\s+|\s+poi\s+|\s+che\s+|:\s+/);
  const candidatas = trozos.filter(t => re.test(t)).sort((a, b) => pal(b) - pal(a));
  for (const c of candidatas) {
    let t = limpiar(c);
    if (pal(t) > max || pal(t) < 4) continue;
    return t[0].toUpperCase() + t.slice(1) + ".";
  }
  // Ultimo recurso: ventana alrededor de la palabra, dentro de la misma
  // oracion. Una clausula suelta puede quedar en una palabra ("promette") o
  // pasarse de largo; la ventana siempre da un trozo del texto que el alumno ha
  // leido, que es lo que importa para el clip de audio.
  const tk = limpia.split(/\s+/);
  const at = tk.findIndex(x => re.test(x));
  if (at < 0) return null;
  let a = at, b = at;
  while (b - a + 1 < max) {
    const antes = a > 0, despues = b < tk.length - 1;
    if (!antes && !despues) break;
    if (antes && (!despues || at - a <= b - at)) a--; else b++;
  }
  let t = limpiar(tk.slice(a, b + 1).join(" "));
  if (pal(t) < 4) return null;
  return t[0].toUpperCase() + t.slice(1) + ".";
}
const pal = (s:string)=>s.trim().split(/\s+/).filter(Boolean).length;
/** En una lista de cuatro opciones el "(lema)" de unas y no de otras es un
 *  soplo: se lee como marca, no como ayuda. En la glosa del lookup si vale. */
const opcion = (g:string)=> g.replace(/\s*\([^)]*\)\s*$/,"").trim();

/**
 * Clase de desinencia italiana, para que los distractores CONCUERDEN con la
 * respuesta en genero y numero.
 *
 * Sin esto, un hueco que pide un adjetivo masculino singular se resolvia sin
 * saber italiano: `silenzioso` contra `aperta` y `alte` se elige mirando la
 * terminacion, porque las otras dos no encajan con el sustantivo. Medido sobre
 * los 63 huecos: en 23 la respuesta era la UNICA opcion con su terminacion.
 * Es el mismo fallo que el constructor automatico, solo que por otra puerta:
 * alli el distractor sale del lema, aqui salia del tipo sin mirar la forma.
 *
 * La `-e` no separa masculino de femenino ni singular de plural femenino, y eso
 * esta BIEN: son justo los casos en que un italiano tampoco decide por la
 * desinencia, asi que el ejercicio sigue midiendo lo que dice medir.
 */
const desin = (w: string) => {
  const c = w.normalize("NFC").toLowerCase().slice(-1);
  if (/[àèéìòù]/.test(c)) return "acento";
  return "oaei".includes(c) ? c : "otro";
};

/**
 * Singular o plural, comparando la forma con su lema.
 *
 * Hace falta porque la desinencia sola no basta en la clase `-e`, que junta el
 * masculino singular (`gettone`), el femenino singular (`cattedrale`) y el
 * femenino PLURAL (`mucche`). Con solo la desinencia, un hueco que venia
 * detras de `un` se resolvia igual de facil: `un mucche` no existe. Y ese no
 * es un fallo de desinencia sino de numero, que el lema si delata.
 */
const numero = (lema: string, forma: string) => {
  const l = lema.normalize("NFC").toLowerCase();
  const f = forma.normalize("NFC").toLowerCase();
  if (l === f) return "sg";
  if (/a$/.test(l) && /e$/.test(f)) return "pl";
  if (/[oe]$/.test(l) && /i$/.test(f)) return "pl";
  return "sg";
};

/**
 * Genero, sacado del CORPUS y no de la desinencia.
 *
 * La desinencia decide en `-o` y `-a`, pero no en `-e`, que es donde estaba el
 * ultimo agujero: `cattedrale` (f) entre las opciones de un hueco que venia
 * detras de `il` se descarta sin saber la palabra. El genero de esas no esta en
 * la forma, pero si en los cuerpos: cada sustantivo aparece ahi con su articulo
 * al menos una vez. Se lee de ahi y solo se cae a la desinencia cuando el
 * corpus no lo dice.
 */
// Determinantes, separados por genero Y por numero: el mismo barrido da las dos
// cosas y el numero lo necesita `occhiali`, un plural cuyo lema YA es plural, o
// sea invisible para la comparacion lema/forma.
const DET: Array<[RegExp, string, string]> = [
  [/\b(il|lo|un|uno|nel|nello|dal|dallo|al|allo|sul|sullo|del|dello)\s+$/i, "m", "sg"],
  [/\b(la|una|nella|dalla|alla|sulla|della)\s+$/i, "f", "sg"],
  [/\b(i|gli|dei|degli|nei|negli|dai|dagli|ai|agli|sui|sugli)\s+$/i, "m", "pl"],
  [/\b(le|delle|nelle|dalle|alle|sulle)\s+$/i, "f", "pl"],
];
function rasgosDelCorpus(cuerpos: string[]) {
  const cache = new Map<string, string>();
  return (lema: string, forma: string) => {
    const f = forma.normalize("NFC").toLowerCase();
    if (cache.has(f)) return cache.get(f)!;
    const votos = new Map<string, number>();
    const re = new RegExp(`(?<![\\p{L}])${f.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}])`, "giu");
    for (const c of cuerpos) for (const hit of c.matchAll(re)) {
      const antes = c.slice(Math.max(0, hit.index! - 12), hit.index!);
      for (const [rx, g, n] of DET) if (rx.test(antes)) votos.set(`${g}:${n}`, (votos.get(`${g}:${n}`) ?? 0) + 1);
    }
    let mejor = "", max = 0;
    for (const [k, v] of votos) if (v > max) { mejor = k; max = v; }
    // Sin articulo delante en ningun cuerpo: se cae a la forma. La desinencia
    // acierta en `-o` y `-a`; en `-e` no decide, y ahi vale mas no filtrar que
    // filtrar mal, asi que sale `?` y solo casa con otros `?`.
    const gen = /o$/.test(f) ? "m" : /a$/.test(f) ? "f" : "?";
    const out = mejor || `${gen}:${numero(lema, f)}`;
    cache.set(f, out);
    return out;
  };
}

/**
 * Clave de concordancia: genero + numero, que es lo que de verdad tiene que
 * cuadrar con el articulo y el sustantivo del hueco. La desinencia era un
 * apaño que funcionaba en `-o` y `-a` y fallaba justo donde importa.
 */
const hazConc = (rasgos: (l: string, f: string) => string) => (lema: string, forma: string) =>
  rasgos(lema, forma);

/**
 * Las traducciones de los huecos se escriben a mano (`_itA1/traducciones.json`,
 * clave = la oracion ya con `_____`) porque generarlas daba cosas como
 * "_____ sweats", que es la glosa de la respuesta pegada a un guion bajo y no
 * una traduccion. Se inyectan AQUI y no en un paso aparte para que regenerar
 * los sets no las pierda.
 */
const TRAD = JSON.parse(fs.readFileSync("scripts/_itA1/traducciones.json", "utf8")) as Record<string, string>;

function run(){
  const st = (JSON.parse(fs.readFileSync("scripts/_itA1/ALL.json","utf8")) as any[])
    .sort((a,b)=>(TOPICS.indexOf(a.topic)-TOPICS.indexOf(b.topic))||(a.slotIndex-b.slotIndex));
  // Bolsa global por tipo, para sacar distractores de otras historias.
  const bolsa = new Map<string,{w:string,s:string,g:string,slug:string}[]>();
  for (const s of st) for (const v of s.vocab) {
    const sup=String(v.surface??v.word).normalize("NFC").toLowerCase(); const g=GLOSS[sup]?.g;
    if(!g) continue;
    const t=String(v.type);
    bolsa.set(t,[...(bolsa.get(t)??[]),{w:String(v.word),s:sup,g,slug:s.slug}]);
  }
  const conc = hazConc(rasgosDelCorpus(st.map((x:any)=>String(x.text).normalize("NFC").toLowerCase())));
  let semilla = 7;
  let sinConcordar = 0;
  const rnd = ()=> (semilla = (semilla*1103515245+12345) % 2147483648) / 2147483648;
  const distractores = (tipo:string, slug:string, evitar:Set<string>, n:number, key?:string) => {
    const todos=(bolsa.get(tipo)??[]).filter(x=>x.slug!==slug && !evitar.has(x.g) && !evitar.has(x.s));
    // Con `conc` solo entran los que comparten desinencia; si no llegan a `n`
    // se completa con el resto, y el hueco se APUNTA en el informe: una
    // opcion que no concuerda es exactamente lo que veniamos a quitar.
    const pool = key ? todos.filter(x=>conc(x.w, x.s)===key) : todos;
    const out:{s:string,g:string,w:string}[]=[];
    const usados=new Set<string>();
    while(out.length<n && pool.length){
      const x=pool[Math.floor(rnd()*pool.length)];
      if(usados.has(x.g)||usados.has(x.s)){ pool.splice(pool.indexOf(x),1); continue; }
      usados.add(x.g); usados.add(x.s); out.push({s:x.s,g:x.g,w:x.w});
      pool.splice(pool.indexOf(x),1);
    }
    if (key && out.length < n) {
      const resto = todos.filter(x=>!usados.has(x.g) && !usados.has(x.s));
      while (out.length < n && resto.length) {
        const x = resto.splice(Math.floor(rnd()*resto.length), 1)[0];
        usados.add(x.g); usados.add(x.s); out.push({s:x.s,g:x.g,w:x.w});
      }
      sinConcordar += n - out.filter(x=>conc(x.w, x.s)===key).length;
    }
    return out;
  };

  const informe:string[]=[];
  for (const s of st) {
    const fs_ = frases(s.text);
    // Una misma oracion puede dar pie a TRES ejercicios: el recorte por clausula
    // deja frases distintas, y el validador prohibe repetir la palabra
    // objetivo, no la oracion. Sin esto se quedaban ocho plazas sin cubrir por
    // historia y la cobertura total es obligatoria para sembrar.
    const usadas = new Map<number, number>();
    const ejercicios:any[] = [];
    const objetivos = new Set<string>();
    // 1. match_meaning con cuatro sustantivos concretos de esta historia
    const nombres = s.vocab.filter((v:any)=>v.type==="noun" && GLOSS[String(v.surface??v.word).normalize("NFC").toLowerCase()]).slice(0,4);
    if (nombres.length===4) {
      const opts = nombres.map((v:any)=>opcion(GLOSS[String(v.surface??v.word).normalize("NFC").toLowerCase()].g));
      ejercicios.push({ type:"match_meaning", word:nombres.map((v:any)=>String(v.surface??v.word)).join(","), sentence:"",
        payload:{ prompt:"Match the words to their meanings.",
          pairs: nombres.map((v:any,i:number)=>({ word:String(v.surface??v.word), answer:opts[i], options:[...opts] })) } });
      for (const v of nombres) objetivos.add(String(v.surface??v.word).normalize("NFC").toLowerCase());
    }
    // 2. el resto: una frase real por palabra, alternando significado y hueco
    let i=0, huecos=0;
    for (const v of s.vocab) {
      const sup=String(v.surface??v.word); const k=sup.normalize("NFC").toLowerCase();
      if (objetivos.has(k)) continue;
      const g=GLOSS[k]; if(!g) { informe.push(`${s.slug}: sin glosa ${k}`); continue; }
      const re=lim(sup);
      const orden=fs_.map((f,j)=>({f,j})).filter(x=>re.test(x.f)).sort((a,b)=>(usadas.get(a.j)??0)-(usadas.get(b.j)??0));
      // La cobertura total es obligatoria para sembrar, asi que si todas las
      // oraciones candidatas estan gastadas se usa igual la menos usada: repetir
      // una oracion es peor que dejar una plaza sin ejercicio, no al reves.
      const idx=orden.length ? orden[0].j : -1;
      if(idx<0){ informe.push(`${s.slug}: sin frase para ${sup}`); continue; }
      const hueco = huecos < 3 && i%2===1;
      const max = hueco?12:14;
      const frase = clausula(fs_[idx], sup, max);
      if (!frase) { informe.push(`${s.slug}: no se puede recortar para ${sup}`); continue; }
      usadas.set(idx,(usadas.get(idx)??0)+1); objetivos.add(k); i++; if(hueco) huecos++;
      const evitar=new Set<string>([g.g, k, ...frase.toLowerCase().split(/\W+/)]);
      const d=distractores(String(v.type), s.slug, evitar, 3, hueco ? conc(String(v.word), sup) : undefined);
      if(d.length<3){ informe.push(`${s.slug}: pocos distractores para ${sup}`); continue; }
      const audio={ storySlug:s.slug, storySource:"user", sentence:frase, targetWord:sup, language:"italian" };
      if (hueco) {
        ejercicios.push({ type:"fill_blank", word:sup,
          sentence: frase.replace(lim(sup), "_____"),
          payload:{ prompt:"Complete the sentence.", answer:sup, options:[sup,...d.map(x=>x.s)],
            translation: TRAD[frase.replace(lim(sup), "_____")] ?? "@@TRADUCIR@@", optionTranslations:[opcion(g.g),...d.map(x=>opcion(x.g))], audioClip:audio } });
      } else {
        ejercicios.push({ type:"meaning_in_context", word:sup,
          sentence: frase.replace(lim(sup), `[[${sup}]]`),
          payload:{ prompt:"Choose the meaning in context.", answer:opcion(g.g), options:[opcion(g.g),...d.map(x=>opcion(x.g))], audioClip:audio } });
      }
    }
    // Dos ejercicios de la MISMA oracion no pueden ir seguidos: en pantalla se
    // lee como si la app se repitiera. Se reparten alternando por oracion de
    // origen, con el match siempre delante.
    const porFrase = new Map<string, any[]>();
    for (const e of ejercicios.slice(1)) {
      const f = e.payload?.audioClip?.sentence ?? String(e.sentence);
      porFrase.set(f, [...(porFrase.get(f) ?? []), e]);
    }
    const colas = [...porFrase.values()];
    const orden: any[] = [ejercicios[0]];
    while (colas.some((c) => c.length)) for (const c of colas) if (c.length) orden.push(c.shift());
    orden.forEach((e, k) => { if (k >= 10) e.featured = false; else delete e.featured; });
    const ejerciciosOrdenados = orden;
    fs.writeFileSync(`scripts/_sets/${s.slug}.json`, JSON.stringify(ejerciciosOrdenados,null,1));
    console.log(`${s.slug.padEnd(34)} ${ejerciciosOrdenados.length} ejercicios · ${objetivos.size}/${s.vocab.length} plazas cubiertas`);
  }
  if (sinConcordar) console.log(`
AVISO: ${sinConcordar} opcion(es) sin concordar con la respuesta (el pool del tipo no daba tres).`);
  if(informe.length) console.log(`\nHUECOS (${informe.length}):\n  `+informe.slice(0,30).join("\n  "));
}
run(); prisma.$disconnect();
