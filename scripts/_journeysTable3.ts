import { config } from "dotenv";
config({ path: ".env.local" }); config({ path: ".env" });
import { PrismaClient } from "../src/generated/prisma";
import { APPROVED_VOICES } from "../src/lib/approvedVoices";
const p = new PrismaClient();
const vname = (id?: string | null) => {
  if (!id) return "-";
  const note = (APPROVED_VOICES as any)[id]?.note as string | undefined;
  return note ? note.split(/[(—]/)[0].trim() : id.slice(0, 8);
};
async function main() {
  const js = await p.journey.findMany({
    where: { status: { in: ["active", "draft"] } },
    select: {
      name: true, language: true, variant: true, status: true, levels: true,
      stories: { select: { status: true, cast: true, dialogueSpec: true,
        voiceId: true, practiceVoiceId: true, ambientTag: true } },
    },
    orderBy: [{ status: "asc" }, { language: "asc" }, { name: "asc" }],
  });
  console.log("estado|journey|idioma/var|nivel|estilo|narrador(voz)|voz práctica|ambient");
  for (const j of js) {
    const S = j.stories;
    const multi = S.filter((s) => (s.cast && Object.keys(s.cast as any).length) || s.dialogueSpec).length;
    const estilo = S.length === 0 ? "-" : multi === 0 ? "narrador" : multi === S.length ? "multivoz" : `mixto(${multi}/${S.length})`;
    // voz narrador/práctica más común
    const mode = (arr: (string | null)[]) => {
      const m = new Map<string, number>();
      arr.filter(Boolean).forEach((v) => m.set(v!, (m.get(v!) ?? 0) + 1));
      return [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    };
    const narr = vname(mode(S.map((s) => s.voiceId)));
    const prac = vname(mode(S.map((s) => s.practiceVoiceId)));
    const amb = S.filter((s) => (s.ambientTag ?? "").trim()).length;
    const est = j.status === "active" ? "LIVE" : "DRAFT";
    console.log(`${est}|${j.name}|${j.language}/${j.variant}|${j.levels.join("/")}|${estilo}|${narr}|${prac}|${amb}/${S.length}`);
  }
  await p.$disconnect();
}
main().catch(async (e) => { console.error(e); await p.$disconnect(); process.exit(1); });
