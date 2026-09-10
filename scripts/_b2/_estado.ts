import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const j = await p.journey.findUnique({ where: { id: "cmtpls1l20007j8epwgcs6e1h" }, select: { status: true, typeSlug: true, variant: true, levels: true } });
  const s = await p.journeyStory.findMany({ where: { journeyId: "cmtpls1l20007j8epwgcs6e1h" }, select: { text: true, audioUrl: true, coverUrl: true } as any });
  const conTexto = s.filter((x: any) => (x.text ?? "").trim()).length;
  const narradas = s.filter((x: any) => x.audioUrl).length;
  const portadas = s.filter((x: any) => x.coverUrl).length;
  console.log(JSON.stringify({ ...j, historias: s.length, conTexto, narradas, portadas }));
  await p.$disconnect();
})();
