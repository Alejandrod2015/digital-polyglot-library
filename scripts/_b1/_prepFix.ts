import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import * as fs from "node:fs";
import { PrismaClient } from "../../src/generated/prisma";

const NUEVOS: Record<string, string[]> = {
  "ya-no-queda-nadie": [
    "Irene vive encima de la panadería de Nerja y la mitad de las contraventanas siguen cerradas. Rocío, la vecina de arriba, se limpia los guantes en el felpudo del umbral. El armario del pasillo huele a pintura vieja y a cerrado.",
    "“Enciende la estufa, hija, que el frío se mete en los muebles y en la manta”. “Y comprueba el interruptor, que está roto desde el otoño”. Cuelga las tres llaves de diciembre detrás de la puerta, se sienta en el sillón, bajo la lámpara, y nota una corriente.",
    "En el techo hay una mancha del tamaño de un plato, blanda al tacto. Pone una cubeta debajo. “Lleva creciendo desde noviembre y yo sin verlo”, dice con prisa.",
    "Sube al terrado y encuentra una cadena, un letrero y un anuncio de la comunidad. Rocío la vigila desde el rellano, sin nombrar el papel que rompió en octubre, y le advierte con un gesto lento. “Eso es obra de los cinco, guapa, con su cuota, su reunión y su voto”.",
  ],
  "el-ano-tiene-dos-mitades": [
    "El camión deja a Nico y Rocío baja con la manta. Nico trabajaba en una empresa de Málaga y acabó su contrato. Irene nota el peso frío de la cesta.",
    "“Aquí en enero no hay empleo ni para los de siempre”. “La plantilla se queda en casa hasta Semana Santa, sin jornada ni descanso”. Ella cobra igual todo el año, con sus clientes, tarifa y factura.",
    "Le cuenta la carga de las seis y el oficio. Álvaro baja del huerto y dice que él vive de la cebolla, no de agosto. “En otoño el campo pide manos para la aceituna, y luego nada”.",
    "“Nosotros no ahorramos, guapa, nosotros estiramos”, suelta Rocío. Suma lo que gasta y apunta la cifra en una lista. La cantidad se parece a lo que gana Nico.",
    "“¿Y tú en qué trabajas?”, pregunta Nico con un gesto lento. Irene explica su tarea, su plazo y su esfuerzo, con otro tono. El año se parte en dos mitades y le queda una envidia rara.",
  ],
  "media-calle-con-manguera": [
    "Después del levante, la limpieza empieza antes de las nueve. Rocío reparte guantes y grita quién friega y quién recoge. El lodo y el barro llegan hasta la puerta de la panadería.",
    "“Tú a la manguera, guapa, que eso no tiene ciencia”, le suelta. “Y del cruce para abajo lo hacemos luego”. Irene abre el grifo y frota lo que puede hacia el desagüe.",
    "Un vecino trae detergente y esponja para las farolas. Otro sacude las cortinas y baja la cesta. La papelera se llena de algas, grava y basura enseguida.",
    "“Esto es cada año, y cada año se junta la misma gente en la rotonda”. Nota el apoyo raro de trabajar sin saber para quién. A media mañana sabe de qué casa es cada cubeta.",
    "“Deja el trapeado, anda, y toma un café que aún quema”. El contenedor está lleno y la calle vuelve a verse. Irene sube con las manos moradas, pone en agua las dos semillas de Álvaro y esa colaboración le dura la tarde.",
  ],
};

(async () => {
  const p = new PrismaClient();
  const ss = await p.journeyStory.findMany({
    where: { journeyId: "cmt5x67ze000l320cpgunu5vi", slug: { in: Object.keys(NUEVOS) } },
    select: { topic: true, slotIndex: true, title: true, slug: true, arcType: true, synopsis: true, vocab: true },
  });
  await p.$disconnect();
  const out = ss.map((s) => {
    const text = NUEVOS[s.slug!].join("\n\n");
    console.log(s.slug, "->", text.trim().split(/\s+/).length, "palabras");
    return { topic: s.topic, slotIndex: s.slotIndex, title: s.title, slug: s.slug, arcType: s.arcType, synopsis: s.synopsis, text, vocab: s.vocab };
  });
  fs.writeFileSync("scripts/_b1/fix/tres.json", JSON.stringify(out, null, 1) + "\n");
  // Comprueba que cada superficie de vocab sigue en el cuerpo.
  for (const s of out) {
    const faltan = (s.vocab as Array<{word:string;surface?:string}>)
      .filter((v) => !new RegExp(`(^|[^\\p{L}])${(v.surface ?? v.word).replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}([^\\p{L}]|$)`, "iu").test(s.text));
    if (faltan.length) console.log("  FALTAN en", s.slug, ":", faltan.map((v) => v.surface ?? v.word).join(", "));
  }
})();
