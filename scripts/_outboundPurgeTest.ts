// Borra las filas de prueba de una sesion concreta. Se usa una sola vez, tras
// verificar el registro en local, para que el primer dia real no arranque con
// clics que no hizo nadie.
import { prisma } from "@/lib/prisma";
async function main() {
  const sid = process.argv[2];
  if (!sid) throw new Error("falta el sessionId");
  const { count } = await prisma.outboundClick.deleteMany({ where: { sessionId: sid } });
  console.log(`borradas ${count} filas de la sesion ${sid}`);
  console.log("quedan", await prisma.outboundClick.count());
}
main().finally(() => process.exit(0));
