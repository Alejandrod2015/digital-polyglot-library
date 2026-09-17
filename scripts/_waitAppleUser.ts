import { config } from "dotenv"; config({ path: ".env" }); config({ path: ".env.local" });
import { createClerkClient } from "@clerk/backend";
import { PrismaClient } from "../src/generated/prisma";
const KNOWN = new Set(["user_344A1pqLKmmqGdz7aKOydl24YWN", "user_33kvaU2HMuLHS247TzZIAMaMnqv", "user_33kv65uluOGVgWUcp98iEfIEZxW"]);
const SOURCE = "user_33kv65uluOGVgWUcp98iEfIEZxW";
async function main() {
  const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY || "" });
  const prisma = new PrismaClient();
  const started = Date.now();
  while (Date.now() - started < 20 * 60 * 1000) {
    const users = await clerk.users.getUserList({ limit: 100 });
    const fresh = users.data.find((u) => !KNOWN.has(u.id));
    if (fresh) {
      const emails = fresh.emailAddresses.map((e) => e.emailAddress).join(",");
      const providers = fresh.externalAccounts.map((a) => a.provider).join(",") || "-";
      console.log(`${new Date().toISOString().slice(11,19)} usuario nuevo: ${fresh.id} | ${emails} | ${providers}`);
      await clerk.users.updateUserMetadata(fresh.id, { publicMetadata: { ...(fresh.publicMetadata ?? {}), plan: "polyglot" } });
      console.log("plan=polyglot puesto en Clerk dev");
      const favs = await prisma.favorite.findMany({ where: { userId: SOURCE, language: "spanish", storySlug: { startsWith: "journey-" } } });
      const rows = favs.map(({ id: _id, userId: _u, createdAt: _c, ...rest }) => ({ ...rest, userId: fresh.id }));
      const res = await prisma.favorite.createMany({ data: rows, skipDuplicates: true });
      console.log(`favoritos copiados: ${res.count} de ${favs.length} (${favs.map((f) => f.word).join(", ")})`);
      await prisma.$disconnect();
      return;
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
  console.log("tiempo agotado: ningún usuario nuevo en 20 minutos");
  await prisma.$disconnect();
}
main().catch((e) => { console.error("FALLO:", e?.message ?? e); process.exit(1); });
