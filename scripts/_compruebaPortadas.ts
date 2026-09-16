import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const st: any[] = await p.journeyStory.findMany({ where: { journeyId: "cmu0doigc0007j8e292tycths" },
    orderBy: [{topic:"asc"},{slotIndex:"asc"}],
    select: { slug:true, coverUrl:true, coverThumbhash:true, coverDone:true } });
  let ok=0, rotas=0;
  for (const s of st) {
    if (!s.coverUrl) { console.log(`SIN URL   ${s.slug} (coverUrl=${JSON.stringify(s.coverUrl)}, thumbhash=${JSON.stringify(s.coverThumbhash)})`); continue; }
    try {
      const r = await fetch(s.coverUrl, { method: "HEAD" });
      if (r.ok) ok++; else { rotas++; console.log(`HTTP ${r.status}  ${s.slug}`); }
    } catch (e) { rotas++; console.log(`ERROR     ${s.slug}: ${(e as Error).message}`); }
  }
  console.log(`\nportadas que cargan: ${ok}/${st.length} | rotas: ${rotas}`);
  await p.$disconnect();
})();
