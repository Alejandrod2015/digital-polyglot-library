import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { readFileSync } from "node:fs";
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[«»"¿¡!?.,:;]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
const A1A2 = "sabado-de-mercado no-hay-cafe mateo-trae-pan-dulce se-fue-la-luz una-caja-vieja por-fin-se-abre-la-puerta cafe-para-dos quien-escribio-este-libro las-nueve-y-cinco buscando-el-mar el-micro-junto-al-mar una-fiesta-sin-aviso el-barrio-se-prepara por-fin-empieza-la-fiesta alguien-toca-el-porton lo-que-hay-tras-la-subida cuando-llega-la-tormenta nadie-quiere-dormir-todavia la-luz-en-el-cerro el-animal-de-madera-se-mueve la-tia-lo-confiesa-todo la-isla-del-lago un-perro-bajo-la-lluvia una-caja-y-una-maleta aprender-la-cumbia la-vigilancia el-chofer-que-conoce-a-todos el-kayak-se-va del-mismo-pueblo esconder-al-perro el-micro-del-domingo el-rescate-en-la-isla la-fiesta-vuelve-a-la-calle el-ladron-de-mangos vuelve-la-carpeta mama-conoce-al-perro".split(" ");
(async () => {
  let pending = 0, turnExact = 0;
  for (const slug of A1A2) {
    const exs = JSON.parse(readFileSync(`scripts/_sets/${slug}.json`, "utf8"));
    const st = await prisma.journeyStory.findFirst({ where: { slug }, select: { dialogueSpec: true } });
    const turns = new Set((((st?.dialogueSpec as any[]) || [])).map((t) => norm(String(t.text))));
    for (const e of exs) {
      const ac = e?.payload?.audioClip;
      if (!ac?.sentence || e.type === "listen_choose" || ac.clipUrl) continue;
      pending++;
      if (turns.has(norm(ac.sentence))) turnExact++;
    }
  }
  console.log(`pendientes A1+A2: ${pending} | coinciden con un TURNO completo cacheado: ${turnExact}`);
})().finally(() => prisma.$disconnect());
