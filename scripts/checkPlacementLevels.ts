import { config } from "dotenv";
import { createClerkClient } from "@clerk/backend";
config({ path: ".env.local" });

async function run() {
  const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });
  const { data } = await clerk.users.getUserList({ limit: 50, orderBy: "-created_at" });
  for (const u of data) {
    const email = u.emailAddresses.map(e => e.emailAddress).join(", ");
    const meta = u.publicMetadata as Record<string, unknown>;
    console.log(`${u.id}  ${email}`);
    console.log(`  journeyPlacementLevel: ${JSON.stringify(meta?.journeyPlacementLevel ?? null)}`);
    console.log(`  preferredLevel: ${JSON.stringify(meta?.preferredLevel ?? null)}`);
    console.log(`  preferredVariant: ${JSON.stringify(meta?.preferredVariant ?? null)}`);
    console.log(`  journeyFocus: ${JSON.stringify(meta?.journeyFocus ?? null)}`);
    console.log(`  targetLanguages: ${JSON.stringify(meta?.targetLanguages ?? null)}`);
  }
}
run().catch(console.error);
