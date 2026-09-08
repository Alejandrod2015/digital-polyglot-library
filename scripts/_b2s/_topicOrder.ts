import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  for (const jid of ["cmt5x67ze000l320cpgunu5vi", "cmtplpfum0007j8c6piegwt31"]) {
    const j = await p.journey.findUnique({ where: { id: jid } });
    const any = j as any;
    console.log(jid, JSON.stringify(any.topics ?? any.topicOrder ?? "SIN CAMPO topics"));
  }
  await p.$disconnect();
})();
