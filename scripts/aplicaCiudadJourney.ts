/**
 * Rellena Journey.city / Journey.cityMode con lo MEDIDO en la auditoria del
 * 2026-09-24 (docs/auditoria-ciudades-journeys-2026-09-24.md).
 *
 * NO cambia ninguna ciudad: escribe lo que YA es cierto hoy en el texto de las
 * historias. Cambiar una ciudad es otra cosa y se decide aparte, porque tres de
 * los journeys que incumplen la regla estan publicados y narrados.
 *
 *   npx tsx scripts/aplicaCiudadJourney.ts --dry   (solo imprime)
 *   npx tsx scripts/aplicaCiudadJourney.ts
 *
 * Idempotente: vuelve a escribir lo mismo. Si un journey ya tiene una ciudad
 * DISTINTA de la de esta tabla, NO la pisa y avisa; alguien la habra cambiado a
 * proposito (p.ej. el Friends ES colombia A0, que otro chat pasa a Medellin).
 */
import { config } from "dotenv";
config({ path: ".env.local" }); config({ path: ".env" });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
const DRY = process.argv.includes("--dry");

type Fila = { id: string; que: string; city: string | null; mode: "single" | "multi" | "none" };

const FILAS: Fila[] = [
  // ── Una ciudad marco. La columna sale del texto, no de contar apariciones.
  { id: "cmt5x63te001832ro42v9dhr9", que: "Traveler AR egypt A0", city: "El Cairo", mode: "single" },
  { id: "cmt09ehi60000320qf9efrypu", que: "Expat FR france A1", city: "Clermont-Ferrand", mode: "single" },
  { id: "cmu0doigc0007j8e292tycths", que: "Friends FR france B1", city: "Lille", mode: "single" },
  { id: "cmtwz1iop000l32jybeo2jg4x", que: "Friends FR france A1", city: "Paris", mode: "single" },
  { id: "cmu04ereh000732z7px7naqa2", que: "Friends FR france A2", city: "Nantes", mode: "single" },
  { id: "cmtwo6cys0007j8yzg6ni3fsc", que: "Friends FR france A0", city: "Marseille", mode: "single" },
  { id: "cmr92f0qz000032ff1dfd4fgx", que: "Expat DE germany C1", city: "Berlin", mode: "single" },
  { id: "cmrdbz11t000032asrvo832i9", que: "Expat DE germany C1 (Hamburgo)", city: "Hamburg", mode: "single" },
  { id: "cmubidgaf0007j8np6g7n89iu", que: "Friends DE germany A2", city: "Hannover", mode: "single" },
  { id: "cmu0dqr6y0007j8o52i1s3gf7", que: "Friends DE germany A1", city: "Frankfurt", mode: "single" },
  { id: "cmu047bkz0007326jsgeptkox", que: "Friends DE germany A0", city: "Bremen", mode: "single" },
  { id: "cmu1bfmb3000732wxuuwj7j2a", que: "Friends IT italy A1", city: "Milan", mode: "single" },
  { id: "cmu0dpa3i0007j80ugstn0jf0", que: "Friends IT italy A0", city: "Genova", mode: "single" },
  { id: "cmt5x635e000m32roty396dz9", que: "Traveler KO korea A0", city: "Seul", mode: "single" },
  { id: "cmt5x629l000032rouvjjr1wf", que: "Traveler PL poland A0", city: "Krakow", mode: "single" },
  { id: "cmu8cbe0f000732rj3or0lld1", que: "Friends PT brazil A1", city: "Brasilia", mode: "single" },
  { id: "cmt5vx8du000732fjgkwi59ks", que: "Friends ES argentina A1", city: "Buenos Aires", mode: "single" },
  { id: "cmu7f663l0007j87p36m70mp6", que: "Friends ES chile A1", city: "Valparaiso", mode: "single" },
  { id: "cmue7cgmf0007j8p6sh7f7xrh", que: "Friends ES colombia A0", city: "Pereira", mode: "single" },
  { id: "cmud5qhu00006j81cmkl4u5ks", que: "Friends ES mexico A0", city: "Guadalajara", mode: "single" },
  { id: "cmu36dk1d0007j8p7grgcyiok", que: "Friends ES spain A2", city: "Salamanca", mode: "single" },
  { id: "cmub2d9ly000732omf2bfg39b", que: "Friends ES spain B1", city: "Santiago de Compostela", mode: "single" },
  { id: "cmtplpfum0007j8c6piegwt31", que: "Traveler ES spain B2", city: "Vitoria", mode: "single" },
  { id: "cmt5x67ze000l320cpgunu5vi", que: "Traveler ES spain B1", city: "Madrid", mode: "single" },
  { id: "cmsvz6mz9000732gsgsfer0ko", que: "Traveler ES spain A1", city: "Nerja", mode: "single" },
  { id: "cmt70xfyt000l3283gxd70wck", que: "Traveler ES spain A2", city: "Nerja", mode: "single" },

  // ── Gira: los siete temas son siete sitios. La regla se aplica sitio a sitio.
  { id: "cmroo4w4v0000324ow1o9qlcp", que: "Friends DE germany C1", city: null, mode: "multi" },
  { id: "cmqfnp3tf000032afygkqp8z2", que: "Traveler DE germany A1", city: null, mode: "multi" },
  { id: "cmt0a8vb1000m32p1x7r5ba28", que: "Traveler DE germany A0", city: null, mode: "multi" },
  { id: "cmt5wqsf7000032ghesowd0jy", que: "Traveler IT italy A2", city: null, mode: "multi" },
  { id: "cmss0fkc40007j8dub1zpa1kc", que: "Traveler IT italy A1", city: null, mode: "multi" },
  { id: "cmtvpqsfv000832hgemzk20cl", que: "Traveler PT brazil A0", city: null, mode: "multi" },
  { id: "cmtrcpgso00073232h8vaf7na", que: "Traveler PT brazil B1", city: null, mode: "multi" },
  { id: "cmtq5n9a50007j8812p9lzxjr", que: "Traveler PT brazil B2", city: null, mode: "multi" },
  { id: "cmsou2uk0000732mqa4oatcmn", que: "Traveler PT brazil A1", city: null, mode: "multi" },
  { id: "cmsyrge55000732u9oiu8wue3", que: "Traveler PT brazil A2", city: null, mode: "multi" },
  { id: "cmrqn1s5s000032tj3kq0gykb", que: "Friends ES argentina C1", city: null, mode: "multi" },
  { id: "cmrpm0tra000032vgxcs33wrb", que: "Friends ES colombia C1", city: null, mode: "multi" },
  { id: "cmu410zep000732szrw94t2sl", que: "Cultural ES latam A0", city: null, mode: "multi" },
  { id: "cmtmylg7k0007321h6t7njesx", que: "Traveler ES latam B1", city: null, mode: "multi" },
  { id: "cmtgelq560007j84n3ujx9bpd", que: "Traveler ES latam A2", city: null, mode: "multi" },
  { id: "cmtpls1l20007j8epwgcs6e1h", que: "Traveler ES latam B2", city: null, mode: "multi" },
  { id: "cmt5vxwgd0007324oesy195k8", que: "Traveler ES latam A1", city: null, mode: "multi" },
  { id: "cmqrtaj1p000032qtda86z6um", que: "Traveler ES latam A0", city: null, mode: "multi" },
  { id: "cmrrrpru1000032nnzsmraa7h", que: "Friends ES mexico C1", city: null, mode: "multi" },
  { id: "cmrrqjd2n000032nvnp2tryzg", que: "Traveler ES mexico A1", city: null, mode: "multi" },
  { id: "cmrr5hnbl000032k1esry5n8g", que: "Friends ES spain A1", city: null, mode: "multi" },

  // ── Sin ciudad a proposito. NULL en `city` aqui NO es "sin rellenar": lo
  //    dice `cityMode`.
  { id: "cmub5my8d000432ye0v6pv5ng", que: "Conversations ES latam A0", city: null, mode: "none" },
  { id: "cmu8gjgax0007j8yhcnsrr2wl", que: "Friends ES latam A1 (neutral)", city: null, mode: "none" },
  { id: "cmrdqk484000032r4rt2vw4ej", que: "Friends ES latam C1", city: null, mode: "none" },
];

(async () => {
  const vivos = await p.journey.findMany({
    where: { status: { in: ["active", "draft"] } },
    select: { id: true, name: true, language: true, variant: true, levels: true, city: true, cityMode: true },
  });
  const porId = new Map(vivos.map((j) => [j.id, j]));

  const faltan = vivos.filter((j) => !FILAS.some((f) => f.id === j.id));
  if (faltan.length) {
    console.error(`ciudad: ${faltan.length} journey(s) live/draft sin fila en esta tabla. La auditoria se quedo corta:`);
    faltan.forEach((j) => console.error(`  ${j.id}  ${j.name} ${j.language}/${j.variant} ${j.levels.join(",")}`));
    process.exit(1);
  }

  let escritos = 0, iguales = 0;
  const pisa: string[] = [];
  for (const f of FILAS) {
    const j = porId.get(f.id);
    if (!j) { console.log(`  (no vivo, se salta) ${f.que}`); continue; }
    if (j.city === f.city && j.cityMode === f.mode) { iguales++; continue; }
    if (j.city && j.city !== f.city) { pisa.push(`  ${f.que}: la base dice "${j.city}" y la tabla "${f.city}". NO se pisa.`); continue; }
    console.log(`  ${DRY ? "[dry] " : ""}${f.que}: ${f.city ?? "(sin ciudad)"} · ${f.mode}`);
    if (!DRY) await p.journey.update({ where: { id: f.id }, data: { city: f.city, cityMode: f.mode } });
    escritos++;
  }
  if (pisa.length) { console.log("\nCiudades que alguien cambio y este script NO toca:"); pisa.forEach((l) => console.log(l)); }
  console.log(`\nciudad: ${escritos} escrito(s), ${iguales} ya estaban igual, ${pisa.length} respetado(s)${DRY ? " (DRY, nada escrito)" : ""}`);
  await p.$disconnect();
})();
