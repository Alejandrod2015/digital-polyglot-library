/** Capa de contexto del tema 6 del B2 latam. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const B = "spanish-traveler-latam-b2";
type E = { claves: string[]; g: string; t: string; es: string; en: string };
const CAPA: Record<string, E[]> = {
  "el-vino-equivocado": [
    { claves: ["rotisería"], t: "noun", g: "Argentine prepared-food shop", es: "la dueña de la rotisería", en: "the owner of the rotisería" },
    { claves: ["vitel toné", "vitel", "toné"], t: "noun", g: "cold veal in tuna sauce", es: "el vitel toné se lleva con blanco", en: "vitel toné goes with white wine" },
    { claves: ["nene"], t: "noun", g: "kid, dear (Argentina)", es: "Pero se agradece, nene", en: "but much appreciated, dear" },
    { claves: ["lustrado", "lustrados"], t: "adjective", g: "polished (lustrar)", es: "zapatos lustrados", en: "polished shoes" },
    { claves: ["botella"], t: "noun", g: "bottle", es: "botella bajo el brazo", en: "a bottle under his arm" },
    { claves: ["novia"], t: "noun", g: "girlfriend", es: "la familia de la novia", en: "his girlfriend's family" },
    { claves: ["muchacho"], t: "noun", g: "young man", es: "antes que al muchacho", en: "before looking at the young man" },
    { claves: ["anillo", "anillos"], t: "noun", g: "ring", es: "el anillo que Norma hace girar", en: "the ring Norma spins around" },
    { claves: ["entrevista"], t: "noun", g: "interview", es: "como en entrevista", en: "as if in a job interview" },
    { claves: ["grave"], t: "adjective", g: "serious", es: "Meter la pata no fue grave", en: "putting his foot in it was not serious" },
    { claves: ["meter la pata"], t: "expression", g: "put your foot in it", es: "Meter la pata no fue grave", en: "putting his foot in it was not serious" },
    { claves: ["fijarse", "se fija"], t: "verb", g: "notices (fijarse)", es: "se fija en todo", en: "notices everything" },
    { claves: ["hacer girar", "hace girar"], t: "expression", g: "spins around", es: "que Norma hace girar cuando duda", en: "that Norma spins when she hesitates" },
    { claves: ["se agradece"], t: "expression", g: "much appreciated", es: "Pero se agradece, nene", en: "but much appreciated, dear" },
    { claves: ["lavar los platos"], t: "expression", g: "wash the dishes", es: "Sé lavar los platos como nadie", en: "I can wash dishes like nobody else" },
    { claves: ["de los buenos"], t: "expression", g: "the good kind", es: "un vino de allá, de los buenos", en: "a wine from home, the good kind" },
    { claves: ["de allá"], t: "expression", g: "from back home", es: "un vino de allá", en: "a wine from back home" },
    { claves: ["sobre todo"], t: "expression", g: "above all", es: "es sobre todo Norma", en: "is above all Norma" },
    { claves: ["como nadie"], t: "expression", g: "like nobody else", es: "lavar los platos como nadie", en: "wash dishes like nobody else" },
    { claves: ["en la puerta"], t: "expression", g: "at the door", es: "promete en la puerta", en: "promises at the door" }
  ],
  "la-tanda-quemada": [
    { claves: ["franco", "de franco"], t: "noun", g: "day off (Argentina)", es: "De franco en su laburo", en: "on his day off from work" },
    { claves: ["milanesa", "milanesas"], t: "noun", g: "breaded cutlet", es: "la primera tanda de milanesas", en: "the first batch of milanesas" },
    { claves: ["pan rallado", "rallado"], t: "expression", g: "breadcrumbs", es: "Harina, huevo, pan rallado", en: "flour, egg, breadcrumbs" },
    { claves: ["hornalla"], t: "noun", g: "stove burner (Argentina)", es: "la hornalla no espera a nadie", en: "the burner waits for nobody" },
    { claves: ["tanda"], t: "noun", g: "batch", es: "la primera tanda sale dorada", en: "the first batch comes out golden" },
    { claves: ["rebozar"], t: "verb", g: "to coat for frying (rebozar)", es: "¿Sabés rebozar, nene", en: "do you know how to bread, kid" },
    { claves: ["quemarse", "se quema"], t: "verb", g: "burns (quemarse)", es: "se pasa de punto y se quema", en: "goes past the point and burns" },
    { claves: ["dorado", "dorada"], t: "adjective", g: "golden brown", es: "sale dorada", en: "comes out golden brown" },
    { claves: ["clienta"], t: "noun", g: "customer (woman)", es: "atendía a una clienta", en: "was helping a customer" },
    { claves: ["cumplido"], t: "noun", g: "compliment", es: "no dice nada, que es un cumplido", en: "says nothing, which is a compliment" },
    { claves: ["consolar", "consuela"], t: "verb", g: "comforts (consolar)", es: "no grita ni consuela", en: "neither shouts nor comforts" },
    { claves: ["valer", "valía"], t: "verb", g: "was worth (valer)", es: "la cuenta de lo que valía", en: "the sum of what it was worth" },
    { claves: ["tirar", "tira"], t: "verb", g: "tosses (tirar)", es: "le tira un delantal", en: "tosses him an apron" },
    { claves: ["doblado"], t: "adjective", g: "folded", es: "se lo lleva doblado", en: "takes it home folded" },
    { claves: ["sacar la cuenta", "saca la cuenta"], t: "expression", g: "work out the cost", es: "saca la cuenta de lo que valía", en: "works out what it was worth" },
    { claves: ["pasarse de punto", "se pasa de punto"], t: "expression", g: "get overcooked", es: "se pasa de punto y se quema", en: "goes past the point and burns" },
    { claves: ["sin chistar"], t: "expression", g: "without protest", es: "Paga sin chistar", en: "pays without a word of protest" },
    { claves: ["a la hora de", "la hora de cerrar"], t: "expression", g: "when it is time to", es: "hasta la hora de cerrar", en: "until closing time" },
    { claves: ["abrir la caja", "abre la caja"], t: "expression", g: "open the till", es: "abre la caja", en: "opens the till" },
    { claves: ["salir de tu bolsillo", "sale de tu bolsillo"], t: "expression", g: "come out of your pocket", es: "Esto sale de tu bolsillo", en: "this comes out of your pocket" }
  ],
  "sabado-de-franco": [
    { claves: ["a cargo"], t: "expression", g: "in charge", es: "Vos quedás a cargo del negocio", en: "you are in charge of the shop" },
    { claves: ["campanita"], t: "noun", g: "little doorbell", es: "la campanita de la puerta suena", en: "the little doorbell rings" },
    { claves: ["desatarse", "se desata"], t: "verb", g: "unties (desatarse)", es: "se desata el delantal", en: "unties her apron" },
    { claves: ["quedar a cargo", "quedás a cargo"], t: "expression", g: "stay in charge", es: "Vos quedás a cargo", en: "you stay in charge" },
    { claves: ["cualquier cosa"], t: "expression", g: "anything at all", es: "Cualquier cosa, me llamás", en: "anything at all, you call me" },
    { claves: ["darse vuelta"], t: "expression", g: "turn around", es: "se va sin darse vuelta", en: "leaves without turning around" },
    { claves: ["cartera"], t: "noun", g: "handbag", es: "cartera al hombro", en: "handbag over her shoulder" },
    { claves: ["al hombro"], t: "expression", g: "over the shoulder", es: "cartera al hombro", en: "handbag over her shoulder" },
    { claves: ["ganarse"], t: "verb", g: "to earn (ganarse)", es: "ganarse el saludo de los clientes", en: "to earn the customers' hello" },
    { claves: ["saludo"], t: "noun", g: "greeting", es: "ganarse el saludo", en: "to earn the greeting" },
    { claves: ["cobrar", "cobra"], t: "verb", g: "charges (cobrar)", es: "Atiende, cobra, reboza", en: "serves, charges, breads" },
    { claves: ["a la vuelta"], t: "expression", g: "on returning", es: "A la vuelta, ya de noche", en: "on her return, already at night" },
    { claves: ["de noche"], t: "expression", g: "at night", es: "ya de noche", en: "already at night" },
    { claves: ["con llave"], t: "expression", g: "locked", es: "cerrado con llave", en: "locked with the key" },
    { claves: ["contado", "contada"], t: "adjective", g: "counted", es: "La plata está contada dos veces", en: "the money is counted twice" },
    { claves: ["vuelto"], t: "noun", g: "change (Latin America)", es: "con el vuelto listo", en: "with the change ready" },
    { claves: ["tapado", "tapada"], t: "adjective", g: "covered", es: "tapada con una servilleta", en: "covered with a napkin" },
    { claves: ["tibio", "tibia"], t: "adjective", g: "lukewarm", es: "todavía tibia", en: "still warm" },
    { claves: ["parado", "parada"], t: "adjective", g: "standing", es: "la prueba ahí parada", en: "tastes it standing right there" },
    { claves: ["por primera vez"], t: "expression", g: "for the first time", es: "por primera vez en años", en: "for the first time in years" }
  ]
};
(async () => {
  const p = new PrismaClient();
  let n = 0;
  for (const [slug, entradas] of Object.entries(CAPA)) {
    const fila = await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle: B, slug } } });
    const g = { ...((fila?.glosses ?? {}) as Record<string, unknown>) } as Record<string, unknown>;
    for (const e of entradas) {
      if (e.es.split(/\s+/).length > 8) throw new Error(`trozo largo: ${e.es}`);
      for (const k of e.claves) { g[k] = { g: e.g, t: e.t, c: { es: e.es, en: e.en }, rev: true }; n++; }
    }
    await p.tapGlossSet.upsert({
      where: { bundle_slug: { bundle: B, slug } },
      create: { bundle: B, slug, language: "spanish", variant: "latam", slugs: [], glosses: g as never },
      update: { glosses: g as never },
    });
  }
  console.log(`claves escritas ${n}`);
  await p.$disconnect();
})();
