import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

async function main() {
  const secret = process.env.CRON_SECRET;
  if (!secret) { console.error("sin CRON_SECRET"); process.exit(1); }
  const res = await fetch("https://reader.digitalpolyglot.com/api/studio/journeys/status", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
    body: "{}",
  });
  const d = (await res.json()) as {
    served?: Array<{ language: string; label: string; variant: string | null; stories: number }>;
    missingFromReader?: string[];
  };
  console.log("HTTP", res.status);
  console.log("\nLO QUE EL LECTOR SIRVE (pasando por la caché):");
  for (const s of d.served ?? []) console.log(`  ${s.language} · ${s.variant} · ${s.label} → ${s.stories} historias`);
  console.log("\nmissingFromReader:", JSON.stringify(d.missingFromReader ?? "campo ausente"));
}
main();
