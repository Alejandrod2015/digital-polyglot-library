/**
 * Audit del catálogo de voces:
 *  1. Lista voces aprobadas/candidate sin `accentTags` o con `unverified`
 *     (necesitan oído humano para promover).
 *  2. Reporta cobertura por (idioma, accent) — flagea buckets vacíos
 *     ("español no tiene ninguna voz `mexican`") que limitan la calidad
 *     del casting cuando una historia se ambienta en ese país.
 *  3. Sugiere acciones: voces a auditar, buckets a llenar.
 *
 * Sin DB: lee solo `src/lib/voiceCatalog.ts`. Corre con
 *   `npx tsx scripts/auditVoiceCoverage.ts`
 */

import {
  VOICE_CATALOG,
  type AccentTag,
  type VoiceEntry,
} from "../src/lib/voiceCatalog";

// Set objetivo por idioma: tags que la app DEBERÍA tener cubiertos
// para que el casting tenga opciones realistas. Faltar uno no rompe
// nada — sólo significa que el casting recurre a `neutral-latam` u
// otra aproximación, lo que el usuario notó como "Don Felipe suena
// argentino".
const TARGET_COVERAGE: Record<string, AccentTag[]> = {
  spanish: [
    "mexican",
    "argentine",
    "colombian",
    "chilean",
    "caribbean",
    "peninsular-castilian",
    "peninsular-andalusian",
    "neutral-latam",
  ],
  portuguese: ["brazilian-paulista", "brazilian-carioca", "brazilian-ne", "portuguese-lisbon"],
  italian: ["italian-roman", "italian-milanese", "italian-neapolitan", "italian-florentine", "italian-neutral"],
  german: ["german-hochdeutsch", "german-austrian"],
  english: ["english-gen-am", "english-rp", "english-australian"],
};

function summarizeVoice(v: VoiceEntry): string {
  const tags = v.accentTags?.length ? v.accentTags.join(",") : "(none)";
  return `  ${v.id}  [${v.language}/${v.region ?? "?"}/${v.gender}]  tags=${tags}  status=${v.status}`;
}

function main() {
  const totals: Record<string, { approved: number; candidate: number; discarded: number }> = {};
  const needsAudit: VoiceEntry[] = [];
  const noTags: VoiceEntry[] = [];

  for (const v of VOICE_CATALOG) {
    const lang = v.language;
    const t = (totals[lang] ??= { approved: 0, candidate: 0, discarded: 0 });
    t[v.status] += 1;

    if (v.status === "discarded") continue;
    if (!v.accentTags || v.accentTags.length === 0) {
      noTags.push(v);
    } else if (v.accentTags.includes("unverified")) {
      needsAudit.push(v);
    }
  }

  console.log("== TOTALS BY LANGUAGE ==");
  for (const [lang, t] of Object.entries(totals)) {
    console.log(
      `  ${lang.padEnd(12)} approved=${t.approved}  candidate=${t.candidate}  discarded=${t.discarded}`
    );
  }

  console.log("\n== VOICES NEEDING AUDIT (unverified) ==");
  if (needsAudit.length === 0) {
    console.log("  (none — every approved/candidate voice has a confirmed accentTag)");
  } else {
    for (const v of needsAudit) console.log(summarizeVoice(v));
  }

  console.log("\n== APPROVED/CANDIDATE VOICES MISSING accentTags FIELD ==");
  if (noTags.length === 0) {
    console.log("  (none — every entry has accentTags populated, even if unverified)");
  } else {
    for (const v of noTags) console.log(summarizeVoice(v));
  }

  console.log("\n== COVERAGE BY (language, accent) — APPROVED ONLY ==");
  for (const [lang, target] of Object.entries(TARGET_COVERAGE)) {
    console.log(`\n  ${lang}:`);
    const counts: Record<string, number> = {};
    for (const v of VOICE_CATALOG) {
      if (v.status !== "approved") continue;
      if (v.language !== lang) continue;
      if (!v.accentTags) continue;
      // No contamos `unverified` como cobertura — sólo confirmados.
      if (v.accentTags.includes("unverified")) continue;
      for (const tag of v.accentTags) counts[tag] = (counts[tag] ?? 0) + 1;
    }
    for (const tag of target) {
      const c = counts[tag] ?? 0;
      const flag = c === 0 ? "🔴 EMPTY" : c === 1 ? "🟡 single" : "🟢";
      console.log(`    ${tag.padEnd(28)} ${String(c).padStart(2)} ${flag}`);
    }
    // Tags presentes pero NO en el target (no es error, sólo informativo).
    const extras = Object.keys(counts).filter((t) => !target.includes(t as AccentTag));
    if (extras.length > 0) {
      console.log(`    (extras not in target: ${extras.join(", ")})`);
    }
  }
}

main();
