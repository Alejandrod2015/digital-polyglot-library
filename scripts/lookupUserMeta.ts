import { config } from "dotenv";
import { createClerkClient } from "@clerk/backend";
config({ path: ".env.local" });
async function run() {
  const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });
  const userId = process.argv[2];
  const u = await clerk.users.getUser(userId);
  console.log(`Email: ${u.emailAddresses.map(e => e.emailAddress).join(", ")}`);
  console.log(`publicMetadata:`, JSON.stringify(u.publicMetadata, null, 2));
  console.log(`unsafeMetadata:`, JSON.stringify(u.unsafeMetadata, null, 2));
  console.log(`privateMetadata:`, JSON.stringify(u.privateMetadata, null, 2));
}
run().catch(console.error);
