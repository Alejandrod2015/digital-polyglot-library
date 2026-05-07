import { config } from "dotenv";
import { createClerkClient } from "@clerk/backend";
config({ path: ".env.local" });
async function run() {
  const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });
  // Try with emailAddress filter
  const r1 = await clerk.users.getUserList({ emailAddress: ["delcarpio321@gmail.com"], limit: 50 });
  console.log(`emailAddress filter: ${r1.totalCount} found`);
  for (const u of r1.data) {
    console.log(`  ${u.id} placement=${(u.publicMetadata as any)?.journeyPlacementLevel ?? "(none)"} focus=${(u.publicMetadata as any)?.journeyFocus ?? "(none)"}`);
  }
  // Also list all with limit 100
  const r2 = await clerk.users.getUserList({ limit: 100, orderBy: "-created_at" });
  console.log(`\nAll users (limit 100): ${r2.totalCount}`);
  for (const u of r2.data) {
    const email = u.emailAddresses.map(e => e.emailAddress).join(",");
    console.log(`  ${u.id}  ${email}  placement=${(u.publicMetadata as any)?.journeyPlacementLevel ?? "(none)"}`);
  }
}
run().catch(console.error);
