// Ejecuta de verdad softenPunctuationForTts sobre las lineas afectadas.
// `server-only` revienta bajo tsx (el modulo existe para prohibir el bundle en
// cliente), asi que se neutraliza antes de importar. No toca nada mas.
import Module from "module";
const origLoad = (Module as unknown as { _load: (...a: unknown[]) => unknown })._load;
(Module as unknown as { _load: unknown })._load = function (request: string, ...rest: unknown[]) {
  if (request === "server-only") return {};
  return (origLoad as (...a: unknown[]) => unknown).call(this, request, ...rest);
};

async function main() {
  const { softenPunctuationForTts } = await import("../src/lib/elevenlabs");
  const casos = [
    "Ich freue mich sehr, du...",
    "...dass SIE sich Zeit nehmen.",
    "Espera... ¿en serio?",
    "¡Qué bien! Vamos.",
    "Sala B244, tercera puerta.",
    "Un momento.. ya voy",
    "Basta......",
  ];
  for (const c of casos) console.log(JSON.stringify(c), "->", JSON.stringify(softenPunctuationForTts(c)));
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
