import { config } from "dotenv";
import { createClerkClient } from "@clerk/backend";
config({ path: ".env.local" });
config({ path: ".env" });
async function run() {
  const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });
  const { data } = await clerk.users.getUserList({ limit: 50, orderBy: "-created_at" });
  for (const u of data) {
    const emails = u.emailAddresses.map(e => e.emailAddress).join(", ");
    console.log(`${u.id}  ${emails}`);
  }
}
run().catch(console.error);
