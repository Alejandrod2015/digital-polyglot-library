/** Corrige las copias de hermanos cuyo sentido NO es el que cae en este
 *  journey. `rebuildTapGlosses` copia por PALABRA sin mirar la oracion, asi
 *  que trae el argot de otro pais (`parche` = "hangout" de Colombia sobre un
 *  parche de tela, `forro` = insulto argentino sobre un forro de asiento) o la
 *  categoria equivocada (`tira` sustantivo leido como verbo).
 *
 *  Cada fila de ABAJO se leyo contra su frase de ESTE journey; la columna
 *  `frase` la deja escrita para que el que revise no tenga que fiarse.
 *
 *  Escribe en la fila global Y en las 21 de historia, porque
 *  `glossContextChunks escribe` reparte la entrada global en cada una y
 *  corregir solo la global deja las 21 copias viejas.
 *
 *  Idempotente: si la glosa ya es la corregida, no toca nada.
 *
 *  npx tsx scripts/_esColombiaA0Friends/corrigeCopias.ts [--dry]
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";

const prisma = new PrismaClient();
const BUNDLE = "spanish-friends-colombia-a0";

type Fila = { w: string; t?: string; g: string; frase: string };

const FIX: Fila[] = [
  { w: "mira", g: "looks at (mirar)", t: "verb", frase: "Andrés mira la plata y el café" },
  { w: "poco", g: "a little, not much", t: "adverb", frase: "Ella sonríe poco" },
  { w: "rojo", g: "red", t: "adjective", frase: "Hay tres papeles: azul, rojo y blanco" },
  { w: "blanco", g: "white", t: "adjective", frase: "Hay tres papeles: azul, rojo y blanco" },
  { w: "toma", g: "takes (tomar)", t: "verb", frase: "El pan no toma plata ni firma papel" },
  { w: "sobre", g: "envelope", t: "noun", frase: "Dos nombres, un sobre, y cero pelea" },
  { w: "vuelto", g: "change, the money you get back", t: "noun", frase: "Cada color cuida algo: botica, pan o vuelto" },
  { w: "cuenta", g: "tells, says (contar)", t: "verb", frase: "“La compra pequeña queda clara y limpia”, cuenta" },
  { w: "plata", g: "money, in everyday Colombian use", t: "noun", frase: "Andrés mira la plata y el café" },
  { w: "mando", g: "I send, I am in charge (mandar)", t: "verb", frase: "Yo mando el pedido" },
  { w: "manda", g: "is in charge, sends (mandar)", t: "verb", frase: "El vasito manda" },
  { w: "parte", g: "breaks off, cuts (partir)", t: "verb", frase: "Mariana parte un pan compartido y nadie protesta" },
  { w: "pedido", g: "order", t: "noun", frase: "Yo mando el pedido" },
  { w: "libre", g: "free, not taken", t: "adjective", frase: "Hay un asiento libre" },
  { w: "tarde", g: "late", t: "adverb", frase: "Pan llega tarde" },
  { w: "ve", g: "sees (ver)", t: "verb", frase: "Andrés lo ve" },
  { w: "este", g: "this one", t: "pronoun", frase: "Este es reservado" },
  { w: "firma", g: "signs (firmar)", t: "verb", frase: "El pan no toma plata ni firma papel" },
  { w: "gana", g: "wins, gains (ganar)", t: "verb", frase: "Pan aparece y pierde silla, pero gana mesa" },
  { w: "compra", g: "purchase", t: "noun", frase: "La compra pequeña queda clara y limpia" },
  { w: "van", g: "they go (ir)", t: "verb", frase: "Café, pan y plata van separados" },
  { w: "pregunta", g: "asks (preguntar)", t: "verb", frase: "“¿Pan trae maletín o trae hambre?” pregunta" },
  { w: "forro", g: "lining", t: "noun", frase: "dobla el forro y toca el marco" },
  { w: "negro", g: "black", t: "adjective", frase: "Un maletín negro guarda un puesto libre" },
  { w: "parche", g: "patch sewn on cloth", t: "noun", frase: "señala el parche y toca la tabla fina" },
  { w: "mano", g: "hand", t: "noun", frase: "Andrés levanta la mano" },
  { w: "cambio", g: "change, coins given back", t: "noun", frase: "El platito queda libre y todos ríen sin cambio" },
  { w: "caso", g: "hacer caso: to pay attention, to do as told", t: "expression", frase: "Ahora la botica hace caso" },
  { w: "corta", g: "short", t: "adjective", frase: "La nota corta se lee despacio" },
  { w: "recado", g: "message, errand", t: "noun", frase: "Por el recado, la enfermera entra al café" },
  { w: "pega", g: "sticks (pegar)", t: "verb", frase: "Camilo pega el papel en la placa" },
  { w: "sabe", g: "knows (saber)", t: "verb", frase: "Ahora Andrés sabe dónde bajar" },
  { w: "mete", g: "puts it in (meter)", t: "verb", frase: "Mariana recoge el vuelto y lo mete en un monedero" },
  { w: "esperan", g: "are waiting (esperar)", t: "verb", frase: "Tres papeles esperan" },
  { w: "prueba", g: "tries out (probar)", t: "verb", frase: "La panadera prueba la agarradera" },
  { w: "tabla", g: "board", t: "noun", frase: "señala el parche y toca la tabla fina" },
  { w: "sale", g: "goes out, leaves (salir)", t: "verb", frase: "Pilar se sienta y la buseta sale" },
  { w: "toca", g: "touches (tocar)", t: "verb", frase: "La médica toca el papel" },
  { w: "abre", g: "opens (abrir)", t: "verb", frase: "Andrés abre el broche" },
  { w: "poder", g: "power", t: "noun", frase: "el vasito pierde poder" },
  { w: "bajo", g: "low; quietly; under", t: "adverb", frase: "El grupo aplaude bajo" },
  { w: "cebra", g: "zebra crossing", t: "noun", frase: "La médica cruza por la cebra" },
  { w: "aguantan", g: "hold up, endure (aguantar)", t: "verb", frase: "Las flores aguantan" },
  { w: "rueda", g: "rolls (rodar)", t: "verb", frase: "Una moneda rueda junto a la cucharita" },
  { w: "dobla", g: "folds (doblar)", t: "verb", frase: "dobla el forro y toca el marco" },
  { w: "cubierta", g: "cover, outer wrapper", t: "noun", frase: "La enfermera muestra la cubierta" },
  { w: "aviso", g: "I let you know (avisar)", t: "verb", frase: "Yo aviso en el andencito" },
  { w: "plano", g: "camera shot; primer plano: close up", t: "noun", frase: "Primer plano" },
  { w: "medias", g: "a medias: halfway, partly", t: "expression", frase: "café y cara seria a medias" },
  { w: "salgo", g: "I come out, I appear (salir)", t: "verb", frase: "Yo salgo pequeño detrás del pan" },
  { w: "tira", g: "strip", t: "noun", frase: "El peso aparece pegado a una tira roja" },
  { w: "pegado", g: "stuck to", t: "adjective", frase: "El peso aparece pegado a una tira roja" },
  { w: "cuneta", g: "gutter at the edge of the road", t: "noun", frase: "Andrés mira la cuneta" },
  { w: "sal", g: "come out (salir)", t: "verb", frase: "Peso, peso, sal del pan" },
  { w: "canta", g: "sings (cantar)", t: "verb", frase: "Mesa amiga aquí, con café”, canta bajo" },
  { w: "carga", g: "carries (cargar)", t: "verb", frase: "Carga el conductor una tula" },
  { w: "marca", g: "marks (marcar)", t: "verb", frase: "La vendedora marca tres rayitas" },
  { w: "juego", g: "game", t: "noun", frase: "Entre todos suena juego" },
  { w: "mío", g: "mine", t: "pronoun", frase: "Ese pan es mío" },
  { w: "da", g: "gives (dar)", t: "verb", frase: "La lámpara da luz sobre el pan" },
  { w: "lista", g: "ready", t: "adjective", frase: "Recta y lista" },
  { w: "medio", g: "middle", t: "noun", frase: "La tula queda en medio" },
  { w: "campo", g: "room, space", t: "noun", frase: "Hay campo en la mesa amiga" },
  { w: "fuerte", g: "hard, strong", t: "adjective", frase: "Ahora sí trabaja y empuja fuerte" },
  { w: "tapa", g: "covers (tapar)", t: "verb", frase: "El pan sale enorme y me tapa la cara" },
  { w: "pie", g: "foot; de pie: standing", t: "noun", frase: "Julián ve el papel y se queda de pie" },
  { w: "fina", g: "thin, fine", t: "adjective", frase: "señala el parche y toca la tabla fina" },
  { w: "comenta", g: "remarks (comentar)", t: "verb", frase: "También mira la calle”, comenta" },
  { w: "observa", g: "watches, remarks (observar)", t: "verb", frase: "Veo un raspón y una raspadura”, observa Andrés" },
];

(async () => {
  const seco = process.argv.includes("--dry");
  const filas = await prisma.tapGlossSet.findMany({ where: { bundle: BUNDLE }, select: { slug: true, glosses: true } });
  const noEstan = new Set(FIX.map((f) => f.w));
  let cambios = 0;
  for (const fila of filas) {
    const g = fila.glosses as Record<string, any>;
    let toco = false;
    for (const f of FIX) {
      const clave = Object.keys(g).find((k) => k.toLowerCase() === f.w.toLowerCase());
      if (!clave) continue;
      noEstan.delete(f.w);
      const e = g[clave];
      if (e.g === f.g && (!f.t || e.t === f.t)) continue;
      e.g = f.g;
      if (f.t) e.t = f.t;
      toco = true;
      cambios++;
    }
    if (toco && !seco) {
      await prisma.tapGlossSet.update({ where: { bundle_slug: { bundle: BUNDLE, slug: fila.slug } }, data: { glosses: g as never } });
    }
  }
  if (noEstan.size) console.error(`AVISO: ${noEstan.size} palabra(s) de la lista no estan en el bundle: ${[...noEstan].join(", ")}`);
  console.log(`${seco ? "[dry] " : ""}${cambios} entrada(s) corregida(s) sobre ${FIX.length} palabras leidas`);
  await prisma.$disconnect();
})();
