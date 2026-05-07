import { config } from "dotenv";
import { createClerkClient } from "@clerk/backend";
config({ path: ".env.local" });
async function run() {
  const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });
  const userId = process.argv[2];
  try {
    const u = await clerk.users.getUser(userId);
    const emails = u.emailAddresses.map(e => e.emailAddress).join(", ");
    console.log(`${u.id}  ${emails}`);
  } catch (err: any) {
    console.error(`Lookup failed: ${err.message ?? err}`);
  }
}
run().catch(console.error);
