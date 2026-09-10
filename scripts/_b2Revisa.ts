/** Tanda de revision de glosas copiadas (2026-09-07, chat de planificacion):
 *  spanish-traveler-spain-b2 (766), spanish-traveler-latam-b2 (802) y
 *  spanish-traveler-latam-b1 (8), leidas contra sus frases; corrige las que
 *  traian el sentido del journey de origen y marca todas como leidas. */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
type Fix = { g: string; t?: string };
const SPAIN_B2: Record<string, Fix> = {
  da: { g: "gives (dar); le da igual, she doesn't mind" },
  caso: { g: "hacer caso, to pay attention" },
  caja: { g: "box" },
  "caña": { g: "a caña, small glass of beer" },
  corta: { g: "short; cuts off (cortar)" },
  mano: { g: "hand" },
  suya: { g: "hers; salirse con la suya, to get one's way" },
  muda: { g: "moves house (mudarse); speechless" },
  gana: { g: "wins (ganar)" },
  tomo: { g: "a volume, thick book", t: "noun" },
  tapa: { g: "a tapa, small plate of food; caps (tapar)" },
  oye: { g: "is heard (oír); oye, hey" },
  acaba: { g: "ends, finishes (acabar)" },
  seco: { g: "dry; curt" },
  libre: { g: "free, not taken", t: "adjective" },
  buenos: { g: "good (bueno); de los buenos, of the good kind" },
  verso: { g: "a verse, a line of the song" },
  pique: { g: "a huff; picarse, to take offense" },
  exacto: { g: "exact", t: "adjective" },
  turno: { g: "one's turn; a shift" },
  hechas: { g: "made, turned into (hecho)" },
  trata: { g: "treats (tratar a alguien de)" },
  nombre: { g: "name" },
  medias: { g: "a medias, half-done, halfway" },
  kiosco: { g: "newsstand, kiosk" },
  cuenta: { g: "the bill; caer en la cuenta, to realize; it tells (contar)" },
  marca: { g: "marks (marcar)" },
  parte: { g: "the report (weather bulletin); part" },
  venta: { g: "the sale" },
  pasar: { g: "to pass by; to spend time" },
  sigue: { g: "keeps on; is still (seguir)" },
  pica: { g: "stings; se pica, takes offense" },
  sellos: { g: "postage stamps" },
  billete: { g: "a banknote" },
  tiende: { g: "holds out (tender la mano)" },
  cerrada: { g: "closed (cerrado)" },
  "patrón": { g: "pattern (cortadas por el mismo patrón)" },
  hermana: { g: "brings people together (hermanar); sister" },
  "pregón": { g: "the pregón, Carnival opening speech" },
  presume: { g: "boasts, shows off (presumir)" },
  prueba: { g: "proof; a test" },
  "sensación": { g: "feeling" },
  pendiente: { g: "pending, unfinished" },
  seguido: { g: "followed (seguir)" },
  medidas: { g: "measured (medir); measurements" },
  encargado: { g: "asked, commissioned (encargar)", t: "verb" },
  reconoce: { g: "recognizes (reconocer)" },
  vuelta: { g: "the trip back; a turn" },
  centro: { g: "center" },
};
const LATAM_B2: Record<string, Fix> = {
  da: { g: "gives (dar)" },
  caja: { g: "the cash box" },
  chile: { g: "Chile (the country)" },
  mano: { g: "hand" },
  once: { g: "la once, teatime (Chile); eleven" },
  pata: { g: "meter la pata, to slip up; paw" },
  suya: { g: "yours, hers" },
  toma: { g: "takes; drinks (tomar)" },
  tomar: { g: "to have, to drink" },
  tiro: { g: "al tiro, right away (Chile)" },
  dicha: { g: "said (decir); dicha al pasar, said in passing", t: "verb" },
  ficha: { g: "form, card (ficha de inscripción)" },
  gana: { g: "beats, wins (ganar)" },
  hice: { g: "I did (hacer)" },
  moja: { g: "gets you wet (mojar)" },
  nota: { g: "notices (notar)", t: "verb" },
  acaba: { g: "ends (acabarse)" },
  alto: { g: "en alto, up high; tall" },
  pena: { g: "valer la pena, to be worth it; embarrassment" },
  corta: { g: "cuts off (cortar); short" },
  chica: { g: "small; letra chica, the fine print" },
  cae: { g: "falls; caer en cuenta, to realize" },
  dudas: { g: "por las dudas, just in case; doubts" },
  fuera: { g: "out, excluded; outside" },
  metro: { g: "a meter (measurement)" },
  blanco: { g: "blank (en blanco); white (wine)" },
  precio: { g: "price" },
  pelada: { g: "peeled (pelar); girl (Colombia)" },
  pegado: { g: "stuck, glued (pegar)" },
  fierro: { g: "iron, metal; the machine (Chile)", t: "noun" },
  socio: { g: "business partner" },
  salga: { g: "turns out (salir: que salga cierta)" },
  conoce: { g: "knows (conocer)" },
  apunte: { g: "notes, a jotting", t: "noun" },
  listas: { g: "lists" },
  yendo: { g: "going (ir); yendo al grano, getting to the point" },
  grano: { g: "al grano, straight to the point; a grain" },
  parada: { g: "standing (parado); a stop" },
  pienso: { g: "I think it over (pensar)" },
  tumba: { g: "knocks her down (tumbar); grave" },
  rueda: { g: "circle, ring of people; wheel" },
  suelto: { g: "loose; me suelto, I loosen up" },
  frente: { g: "de frente, straight on; front" },
  piloto: { g: "a pilot, trial run" },
  prueba: { g: "tastes, tries (probar); a test" },
  toque: { g: "al toque, right away (Peru); a touch" },
  acuerdo: { g: "me acuerdo, I remember; agreement" },
  billetes: { g: "banknotes" },
  corrido: { g: "de corrido, in one go" },
  conocer: { g: "to meet (someone); to know" },
  horario: { g: "schedule, timetable" },
  pendiente: { g: "pending; attentive" },
  vuelta: { g: "de vuelta, back; a turn" },
  vuelto: { g: "the change (money); turned into" },
  sostiene: { g: "holds (sostener la mirada)" },
  caseros: { g: "regular customers (Colombia)" },
  declara: { g: "is declared (declararse)" },
  rejilla: { g: "grille, grate" },
  aguanta: { g: "takes, puts up with (aguantar)" },
  disculpa: { g: "the apology", t: "noun" },
  colectivo: { g: "city bus (Argentina)" },
  despeinarse: { g: "sin despeinarse, without breaking a sweat" },
};
const LATAM_B1: Record<string, Fix> = {
  chile: { g: "Chile (the country)" },
  media: { g: "half (media hora, half an hour)" },
};
const TANDAS: [string, Record<string, Fix>][] = [
  ["spanish-traveler-spain-b2", SPAIN_B2],
  ["spanish-traveler-latam-b2", LATAM_B2],
  ["spanish-traveler-latam-b1", LATAM_B1],
];
(async () => {
  for (const [B, FIX] of TANDAS) {
    const rows = await p.tapGlossSet.findMany({ where: { bundle: B }, select: { slug: true, glosses: true } });
    let leidas = 0, corregidas = 0;
    for (const r of rows) {
      const g: any = { ...(r.glosses as any ?? {}) }; let toca = false;
      for (const [k, v] of Object.entries<any>(g)) {
        if (v?.rev !== false) continue;
        const fix = FIX[k.toLowerCase()];
        if (fix) { g[k] = { ...v, g: fix.g, ...(fix.t ? { t: fix.t } : {}), rev: true }; corregidas++; }
        else { g[k] = { ...v, rev: true }; leidas++; }
        toca = true;
      }
      if (toca) await p.tapGlossSet.update({ where: { bundle_slug: { bundle: B, slug: r.slug } }, data: { glosses: g } });
    }
    console.log(`${B}: leidas ${leidas} · corregidas ${corregidas}`);
  }
})().finally(() => p.$disconnect());
