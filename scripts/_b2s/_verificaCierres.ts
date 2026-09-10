/** Recalcula el hash de cada cierre del journey desde la base y lo compara con el registro. Solo lee. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
import { hashTema, leerRegistro } from "../temaCierres";
const p = new PrismaClient();
(async () => {
  const J = process.argv[2];
  const reg = leerRegistro();
  let mal = 0;
  for (const [k, c] of Object.entries(reg)) {
    if (!k.startsWith(`${J}#`)) continue;
    const topic = k.split("#")[1];
    const rows = await p.journeyStory.findMany({ where: { journeyId: J, topic }, select: { slotIndex: true, title: true, text: true, vocab: true } });
    const h = hashTema(rows.map((r) => ({ ...r, slotIndex: Number(r.slotIndex) })) as any);
    const ok = h === c.hash;
    if (!ok) mal++;
    console.log(`${ok ? "OK " : "MAL"} ${topic.padEnd(24)} registro ${c.hash} · base ${h} · ${rows.length} historias`);
  }
  console.log(mal ? `${mal} cierre(s) desfasados` : "todos los cierres cuadran con el texto guardado");
  await p.$disconnect();
})();
