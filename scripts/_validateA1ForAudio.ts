import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { validateGeneratedStory } from "../src/lib/validateGeneratedStory";
import { multiVoiceGuardError } from "../src/lib/multiVoiceGuard";
import { parseDialogueSegments } from "../src/lib/elevenlabs";
const J = "cmqp6hal8000032cb4ywfs0gc";

(async () => {
  const p = new PrismaClient();
  const order = ["food-everyday-life","home-family","meeting-new-people","places-getting-around","community-celebrations","nature-adventure","legends-folklore"];
  const rows = await p.journeyStory.findMany({ where: { journeyId: J }, select: { slug:true, title:true, synopsis:true, arcType:true, text:true, vocab:true, level:true, topic:true, slotIndex:true, dialogueSpec:true } });
  rows.sort((a,b)=>(order.indexOf(a.topic)-order.indexOf(b.topic))||a.slotIndex-b.slotIndex);
  const titles = rows.map(r=>r.title ?? "");
  const voiceSet = new Set<string>();
  let totalFail=0, totalWarn=0, guardFails=0;
  for (const r of rows) {
    const res = await validateGeneratedStory(
      { title:r.title??"", synopsis:r.synopsis??"", arcType:r.arcType??"late-reveal", text:r.text??"", vocab:(r.vocab as any[])??[] },
      { language:"es", level:r.level, topic:r.topic, variant:"latam", journeyTitles:titles }
    );
    const fails = res.checks.filter(c=>c.status==="fail");
    const warns = res.checks.filter(c=>c.status==="warn");
    totalFail+=fails.length; totalWarn+=warns.length;
    const guard = multiVoiceGuardError({ storyText:r.text, dialogueSpec:r.dialogueSpec });
    if (guard) guardFails++;
    // collect voiceIds
    const spec:any = r.dialogueSpec; if (Array.isArray(spec)) for (const s of spec) if (s?.voice) voiceSet.add(s.voice);
    const flag = (fails.length||guard) ? "❌" : warns.length ? "⚠️ " : "✅";
    console.log(`${flag} ${r.title}  [pass ${res.summary.pass}/warn ${res.summary.warn}/fail ${res.summary.fail}]`);
    if (guard) console.log(`     GUARD: ${guard}`);
    for (const f of fails) console.log(`     FAIL ${f.id}: ${f.detail ?? f.label}`);
    for (const w of warns) console.log(`     warn ${w.id}: ${(w.detail ?? w.label).slice(0,140)}`);
  }
  console.log(`\n=== TOTAL: fails ${totalFail} | warns ${totalWarn} | guard-blocked ${guardFails}/21 ===`);
  console.log(`\nvoiceIds únicos a verificar (${voiceSet.size}): ${[...voiceSet].join(",")}`);
  await p.$disconnect();
})().catch(e=>{ console.error(e); process.exit(1); });
