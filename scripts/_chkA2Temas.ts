import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const props = [
    ["salvador", "Lessons & Accents"], ["recife", "Pharmacy & Small Aches"],
    ["jericoacoara", "Kitchens & Chores"], ["lencois-maranhenses", "Storms & Changed Plans"],
    ["campo-grande", "Buses & Night Rides"], ["petropolis", "Post & Parcels"],
    ["gramado", "Laundry & Cold Nights"],
  ];
  const all = await p.topic.findMany({ select: { slug: true, label: true } });
  const bySlug = new Map(all.map((t) => [t.slug, t.label]));
  const byLabel = new Map(all.map((t) => [t.label.toLowerCase(), t.slug]));
  for (const [slug, label] of props) {
    const s = bySlug.get(slug); const l = byLabel.get(label.toLowerCase());
    console.log(`${slug} "${label}": slug ${s ? `YA EXISTE con label "${s}"${s === label ? " (identico, ok si es reuso)" : "  <-- CHOQUE"}` : "libre"} · label ${l ? `YA USADO por slug ${l}${l === slug ? "" : "  <-- CHOQUE"}` : "libre"}`);
  }
  const pt = await p.journey.findMany({ where: { language: "portuguese", status: { not: "archived" } }, select: { levels: true, topics: true } });
  for (const j of pt) console.log(`PT ${j.levels.join("/")}: ${j.topics.join(", ")}`);
  await p.$disconnect();
})();
