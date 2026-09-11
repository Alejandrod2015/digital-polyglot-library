import "dotenv/config";
import { PrismaClient } from "@/generated/prisma";
const p = new PrismaClient();
(async () => {
  for (const slug of ["le-torchon-a-la-main", "mille-euros-sans-compter", "des-pas-au-dessus"]) {
    const r = await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle: "french-friends-a0", slug } } });
    const g = r!.glosses as any;
    for (const k of ["cher", "pas", "laisse", "tire"]) if (g[k]) console.log(slug, k, "|", g[k].g, "|", g[k].t, "|", g[k].c?.es);
  }
  await p.$disconnect();
})();
