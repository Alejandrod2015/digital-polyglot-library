import dotenv from "dotenv";
dotenv.config({ path: ".env" });
import { PrismaClient } from "../src/generated/prisma";

const p = new PrismaClient();

const ES = /\b(que|de|del|la|el|los|las|un|una|en|para|con|por|se|su|es|o|al|como|lugar|persona|algo|manera|acci[oó]n)\b/gi;
const EN = /\b(the|a|an|to|of|or|and|for|with|used|someone|something|person|place|way|who|that|in|on|by)\b/gi;

function classify(def: string): "es" | "en" | "?" {
  const es = (def.match(ES) ?? []).length;
  const en = (def.match(EN) ?? []).length;
  if (es > en) return "es";
  if (en > es) return "en";
  return "?";
}

async function main() {
  const books = await p.catalogBook.findMany({
    where: { published: true },
    orderBy: { slug: "asc" },
    include: { stories: true },
  });
  let TE = 0,
    TS = 0,
    TU = 0;
  console.log("libro | definiciones EN | definiciones ES | ambiguas | % en español");
  for (const b of books) {
    let en = 0,
      es = 0,
      u = 0;
    for (const s of b.stories)
      for (const v of (Array.isArray(s.vocab) ? s.vocab : []) as { definition?: string }[]) {
        const c = classify(v.definition ?? "");
        if (c === "en") en += 1;
        else if (c === "es") es += 1;
        else u += 1;
      }
    TE += en;
    TS += es;
    TU += u;
    const tot = en + es + u;
    console.log(
      `${b.slug.padEnd(52)} EN=${String(en).padStart(3)}  ES=${String(es).padStart(3)}  ?=${String(u).padStart(3)}   ${tot ? Math.round((es / tot) * 100) : 0}% en español`
    );
  }
  console.log(`\nTOTAL publicados: EN=${TE} ES=${TS} ?=${TU}  (${Math.round((TS / (TE + TS + TU)) * 100)}% de las definiciones están en español)`);
  await p.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
