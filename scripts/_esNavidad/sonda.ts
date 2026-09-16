import { config } from "dotenv"
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true })
import { createRequire } from "module"
const __req = createRequire(__filename)
try { const p = __req.resolve("server-only"); (__req as any).cache[p] = { id: p, filename: p, loaded: true, exports: {} } } catch {}
import * as fs from "fs"
import { validateGeneratedStory } from "@/lib/validateGeneratedStory"
async function main() {
  const data = JSON.parse(fs.readFileSync(process.argv[2], "utf8"))
  for (const d of data) {
    const r: any = await validateGeneratedStory(JSON.stringify(d), {
      language: "ES", level: "b1", variant: "LATAM", topic: d.topic, journeyName: "Cultural",
    } as any)
    console.log(`\n=== ${d.title} · ok=${r.ok}`)
    for (const c of r.checks ?? []) {
      if (c.status === "pass") continue
      console.log(`  [${c.status.toUpperCase()}] ${c.id}: ${(c.detail ?? c.label ?? "").slice(0, 400)}`)
    }
    const freq = (r.checks ?? []).filter((c: any) => c.id === "vocab-level-frequency" || c.id === "body-level-frequency")
    console.log("  --- los dos que me interesan ---")
    freq.forEach((c: any) => console.log(`  [${c.status.toUpperCase()}] ${c.id}: ${(c.detail ?? "(sin detalle)").slice(0, 600)}`))
  }
}
main()
