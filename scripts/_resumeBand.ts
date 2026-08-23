import { runResumeStoryPush } from "../src/lib/resumeStoryPush";
(async () => {
  const r = await runResumeStoryPush({ dryRun: true });
  const oob = r.candidates.filter(c => c.skip === "out_of_band");
  const bajo = oob.filter(c => c.ratio < 0.2), alto = oob.filter(c => c.ratio > 0.85);
  console.log("out_of_band:", oob.length, "| por debajo del 20%:", bajo.length, "| por encima del 85%:", alto.length);
  console.log("ratios <20%:", bajo.map(c => Math.round(c.ratio*100)+"%").join(" "));
  console.log("ratios >85%:", alto.map(c => Math.round(c.ratio*100)+"%").join(" "));
  const horas = r.candidates.map(c => Math.round(c.hoursSince)).sort((a,b)=>a-b);
  console.log("horas desde la ultima escucha (todas):", horas.join(" "));
})().finally(() => process.exit(0));
