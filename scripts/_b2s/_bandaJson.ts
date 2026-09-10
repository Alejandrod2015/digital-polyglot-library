import { readFileSync } from "fs";
import { mide } from "../_gramProbe";
const st = JSON.parse(readFileSync(process.argv[2], "utf8"));
const { oraciones, usos, tokens } = mide(st.map((s: any) => s.text).join("\n"));
console.log(`(${oraciones} or.) ` + Object.entries(usos).map(([k, v]) => `${k} ${v}`).join(" · "));
for (const n of ["subj. imperfecto", "condicional", "estilo indirecto"]) console.log(`   ${n}: ${tokens[n].join(" | ")}`);
