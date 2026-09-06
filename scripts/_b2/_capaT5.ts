/** Capa de contexto del tema 5 del B2 latam. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const B = "spanish-traveler-latam-b2";
type E = { claves: string[]; g: string; t: string; es: string; en: string };
const CAPA: Record<string, E[]> = {
  "se-le-escapan-las-palabras": [
    { claves: ["lulada"], t: "noun", g: "Cali drink of lulo, ice and lime", es: "lo espera con lulada y mecato", en: "waits for him with lulada and snacks" },
    { claves: ["mecato"], t: "noun", g: "snacks (Colombia)", es: "con lulada y mecato", en: "with lulada and snacks" },
    { claves: ["caleño"], t: "adjective", g: "from Cali", es: "el caleño no se olvida", en: "your Cali Spanish is not forgotten" },
    { claves: ["qué más"], t: "expression", g: "Colombian hello", es: "¿Qué más pues?", en: "what else is new, then" },
    { claves: ["mija"], t: "noun", g: "my dear (Colombia)", es: "Quince inviernos, mija", en: "fifteen winters, my dear" },
    { claves: ["oxidarse", "oxidado"], t: "verb", g: "rusted (oxidarse)", es: "Está oxidado no más", en: "it is just rusty" },
    { claves: ["escaparse", "se le escapa"], t: "verb", g: "slips away (escaparse)", es: "el chiste se le escapa", en: "the joke slips away from him" },
    { claves: ["parquear"], t: "verb", g: "to park (loan word)", es: "Voy a parquear el carro", en: "I am going to park the car" },
    { claves: ["rentar", "rentando"], t: "verb", g: "renting (loan word)", es: "estuve rentando un puesto", en: "I was renting a stall" },
    { claves: ["arrendar", "arrendando"], t: "verb", g: "renting (arrendar)", es: "Aquí se dice arrendando", en: "here we say arrendando" },
    { claves: ["desempolvar", "se desempolva"], t: "verb", g: "gets dusted off (desempolvar)", es: "Eso se desempolva", en: "that gets dusted off" },
    { claves: ["dar pena", "da pena"], t: "expression", g: "embarrasses (Colombia)", es: "A Jairo le da pena", en: "Jairo feels embarrassed" },
    { claves: ["chueco", "chueca"], t: "adjective", g: "crooked", es: "sonrisa chueca", en: "a crooked smile" },
    { claves: ["socio", "socia"], t: "noun", g: "business partner", es: "la socia de toda la vida", en: "his lifelong business partner" },
    { claves: ["gringo"], t: "noun", g: "northern foreigner (teasing)", es: "se dice arrendando, gringo", en: "we say arrendando, gringo" },
    { claves: ["pegado"], t: "adjective", g: "stuck to", es: "el calor pegado a la espalda", en: "the heat stuck to your back" },
    { claves: ["a medio camino"], t: "expression", g: "halfway", es: "el vaso de lulada a medio camino", en: "the lulada glass stopped halfway" },
    { claves: ["como si nada"], t: "expression", g: "as if nothing happened", es: "lo recibe como si nada", en: "receives him as if nothing happened" },
    { claves: ["de toda la vida"], t: "expression", g: "lifelong", es: "la socia de toda la vida", en: "his lifelong partner" },
    { claves: ["en ninguna parte"], t: "expression", g: "nowhere", es: "la mitad en ninguna parte", en: "half of it nowhere at all" }
  ],
  "de-una": [
    { claves: ["de una"], t: "expression", g: "right away (Colombia)", es: "hágale de una", en: "go ahead, right away" },
    { claves: ["hágale"], t: "expression", g: "go ahead (Colombia)", es: "remata con un hágale de una", en: "closes with a go-ahead-right-now" },
    { claves: ["trasteo"], t: "noun", g: "house move (Colombia)", es: "amanece con trasteo ajeno", en: "wakes up to someone else's move" },
    { claves: ["arriendo"], t: "noun", g: "rent (Colombia)", es: "con el arriendo en efectivo", en: "with the rent in cash" },
    { claves: ["bomba", "bombas"], t: "noun", g: "balloon (Colombia)", es: "bombas verdes en la puerta", en: "green balloons at the door" },
    { claves: ["fiador"], t: "noun", g: "guarantor", es: "los papeles del fiador", en: "the guarantor's papers" },
    { claves: ["desocupado"], t: "adjective", g: "vacant", es: "lleva un mes desocupado", en: "has been vacant for a month" },
    { claves: ["giro"], t: "noun", g: "turn of phrase", es: "un giro de dos sílabas", en: "a two-syllable turn of phrase" },
    { claves: ["sílaba", "sílabas"], t: "noun", g: "syllable", es: "un giro de dos sílabas", en: "a two-syllable turn of phrase" },
    { claves: ["flotar", "flotando"], t: "verb", g: "floating (flotar)", es: "que queda flotando", en: "that stays floating in the air" },
    { claves: ["amanecer", "amanece"], t: "verb", g: "wakes up being (amanecer)", es: "amanece con trasteo ajeno", en: "wakes up with someone else's move" },
    { claves: ["negocio"], t: "noun", g: "business", es: "el negocio de los jugos", en: "the juice business" },
    { claves: ["cita"], t: "noun", g: "appointment", es: "La cita es de pocas vueltas", en: "the appointment is short and direct" },
    { claves: ["dudar", "duda"], t: "verb", g: "hesitates (dudar)", es: "El que duda pierde el local", en: "who hesitates loses the shop" },
    { claves: ["en efectivo"], t: "expression", g: "in cash", es: "el arriendo en efectivo", en: "the rent in cash" },
    { claves: ["sonar a", "suena a"], t: "expression", g: "sounds like", es: "le suena a apuro", en: "sounds like being rushed to him" },
    { claves: ["sin pensarlo"], t: "expression", g: "without thinking twice", es: "ya, ahora, sin pensarlo", en: "now, right now, without thinking twice" },
    { claves: ["empezar de nuevo"], t: "expression", g: "start over", es: "Bienvenido a empezar de nuevo", en: "welcome to starting over" },
    { claves: ["bienvenido"], t: "expression", g: "welcome", es: "Bienvenido a empezar de nuevo", en: "welcome to starting over" },
    { claves: ["sin más"], t: "expression", g: "just like that", es: "guarda las llaves sin más", en: "puts the keys away, just like that" }
  ],
  "volvio-a-hablar-caleno": [
    { claves: ["cholado"], t: "noun", g: "Cali shaved-ice dessert", es: "reparte cholado dulce", en: "hands out sweet cholado" },
    { claves: ["guayaba"], t: "noun", g: "guava", es: "guayaba pelada", en: "peeled guava" },
    { claves: ["plaza de mercado"], t: "expression", g: "market hall (Colombia)", es: "plaza de mercado, dominó", en: "market mornings, dominoes" },
    { claves: ["rebusque"], t: "noun", g: "hustle (Colombia)", es: "Fueron meses de rebusque", en: "they were months of hustle" },
    { claves: ["ñapa"], t: "noun", g: "free extra (Colombia)", es: "prueba la lulada y pide ñapa", en: "tastes the lulada and asks for extra" },
    { claves: ["ir al grano", "al grano"], t: "expression", g: "get to the point", es: "yendo al grano", en: "getting straight to the point" },
    { claves: ["refrán"], t: "noun", g: "proverb", es: "el refrán no hace falta terminarlo", en: "the proverb needs no finishing" },
    { claves: ["camarón"], t: "noun", g: "shrimp (of the proverb)", es: "Camarón que se duerme...", en: "shrimp that falls asleep..." },
    { claves: ["punto final"], t: "expression", g: "full stop", es: "antes del punto final", en: "before the sentence ends" },
    { claves: ["exprimir", "exprimidos"], t: "verb", g: "squeezed (exprimir)", es: "salen exprimidos al momento", en: "come out squeezed on the spot" },
    { claves: ["licuadora"], t: "noun", g: "blender", es: "la licuadora no descansa", en: "the blender never rests" },
    { claves: ["hielo"], t: "noun", g: "ice", es: "Jairo raspa hielo", en: "Jairo shaves ice" },
    { claves: ["al momento"], t: "expression", g: "on the spot", es: "exprimidos al momento", en: "squeezed on the spot" },
    { claves: ["pelar", "pelada"], t: "verb", g: "peeled (pelar)", es: "guayaba pelada", en: "peeled guava" },
    { claves: ["en alto"], t: "expression", g: "raised high", es: "levanta el vaso en alto", en: "raises the glass up high" },
    { claves: ["por dentro"], t: "expression", g: "on the inside", es: "como quien brinda por dentro", en: "like someone toasting on the inside" },
    { claves: ["dormirse", "se duerme"], t: "verb", g: "falls asleep (dormirse)", es: "Camarón que se duerme...", en: "shrimp that falls asleep..." },
    { claves: ["aparecer", "aparece"], t: "verb", g: "shows up (aparecer)", es: "ese dueño aparece por el puesto", en: "that owner shows up at the stand" },
    { claves: ["probar", "prueba"], t: "verb", g: "tastes (probar)", es: "prueba la lulada", en: "tastes the lulada" },
    { claves: ["traducir", "traduce"], t: "verb", g: "translates (traducir)", es: "ya no traduce", en: "no longer translates in his head" }
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
