/**
 * MODO EN SECO del orden de narracion: para cada historia del perfil, la voz con
 * la que se narraria y el paso del orden en que esta. No sintetiza nada.
 *
 * Es un script aparte y no un flag del runner porque el guard de audio mira el
 * CONTENIDO del script invocado, y el runner contiene la llamada de sintesis:
 * un --seco dentro de _narraUnaA2.ts quedaria bloqueado igual. Lo que decide
 * voz y paso no esta duplicado: son las mismas funciones de _narraPerfiles.ts
 * que usan la muestra y el runner, con las mismas asserts de voz aprobada y
 * de narrador no vetado.
 *
 *   npx tsx scripts/_narraSeco.ts --journey b2-latam
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

import { PrismaClient } from "../src/generated/prisma";
import {
  perfilDeArgs, vozDe, pasoDelOrden, muestrasRegistradas, muestraDelJourney, vozYaAprobada,
} from "./_narraPerfiles";

const NOMBRE: Record<string, string> = {
  JW8DGEuLp9WxIS5IdxMM: "Andreti MX",
  ulJB4yAMefhHYn0FWgGy: "Terry PE",
  yytxkT3pNVMWDHn3KXrY: "Rodrigo CL",
  MjtZn5tagxL1RO6w9ER5: "Lionel AR",
  yHD4CsKkghm19ToGLJEC: "Hernando CO",
};

const PERFIL = perfilDeArgs(process.argv);
const prisma = new PrismaClient();

(async () => {
  const j = await prisma.journey.findUnique({ where: { id: PERFIL.journey }, select: { topics: true } });
  const orden = ((j?.topics ?? []) as any[]).map((t) => (typeof t === "string" ? t : t.slug ?? t.id));
  const hs = await prisma.journeyStory.findMany({
    where: { journeyId: PERFIL.journey },
    select: { slug: true, topic: true, slotIndex: true, voiceId: true, audioUrl: true },
  });
  hs.sort((a, b) => orden.indexOf(a.topic) - orden.indexOf(b.topic) || a.slotIndex - b.slotIndex);
  const muestras = muestrasRegistradas();
  // La muestra es UNA POR JOURNEY desde el 2026-09-23, asi que se resuelve una
  // vez para toda la tabla y no historia a historia.
  const muestra = muestraDelJourney(muestras, PERFIL.journey, hs.map((x) => x.slug));
  const aprobada = vozYaAprobada(muestra, hs.filter((x) => x.audioUrl).length);

  let coinciden = 0;
  console.log("| slug | tema | voz | paso |\n|---|---|---|---|");
  for (const s of hs) {
    const voz = vozDe(PERFIL, s);
    if (voz === PERFIL.voces[s.topic]) coinciden++;
    const o = pasoDelOrden(s, aprobada);
    console.log(`| ${s.slug} | ${s.topic} | ${NOMBRE[voz] ?? voz} (${voz}) | ${o.paso}${o.bloqueo ? `: espera, ${o.bloqueo}` : ""} |`);
  }
  console.log(
    `\nvoz = mapa del perfil: ${coinciden}/${hs.length} · muestra del journey: ${muestra ?? "ninguna"}` +
    ` · voz aprobada de oido: ${aprobada ? "si" : "NO"} · sin sintesis`
  );
})().finally(() => prisma.$disconnect());
