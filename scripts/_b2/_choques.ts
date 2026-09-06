import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
const slugs = ["jokes-and-double-meanings","negotiations-and-courtesies","secrets-and-silences","news-and-headlines","fluency-and-forgetting","partners-and-in-laws","books-and-storytellers"];
const labels = ["Jokes & Double Meanings","Negotiations & Courtesies","Secrets & Silences","News & Headlines","Fluency & Forgetting","Partners & In-Laws","Books & Storytellers"];
(async () => {
  const bySlug = await p.topic.findMany({ where: { slug: { in: slugs } } });
  const byLabel = await p.topic.findMany({ where: { label: { in: labels } } });
  console.log("choque slug:", bySlug.map(t=>t.slug).join(", ") || "ninguno");
  console.log("choque label:", byLabel.map(t=>t.label).join(", ") || "ninguno");
  await p.$disconnect();
})();
