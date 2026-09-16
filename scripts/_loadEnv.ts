/**
 * Carga .env.local y .env ANTES que cualquier otro import.
 *
 * POR QUE (2026-09-17). Casi todos los scripts hacen esto:
 *
 *     import { config } from "dotenv";
 *     config({ path: ".env.local" });
 *     import { generateAndUploadMultiVoiceAudio } from "../src/lib/elevenlabs";
 *
 * y parece que el dotenv corre primero porque esta escrito antes. No corre:
 * los import se izan, asi que TODOS los modulos se cargan y solo despues se
 * ejecuta el config(). Cualquier modulo que lea process.env EN SU SCOPE DE
 * CARGA ve el entorno vacio. En elevenlabs.ts eso es
 * `const openai = process.env.OPENAI_API_KEY ? new OpenAI(...) : null`, o sea
 * que la narracion salia con "[audio-segments] Missing OPENAI_API_KEY" y
 * guardaba la historia con audioSegments vacio, que es de donde sale el
 * informe de ritmo por oracion.
 *
 * Un import de efecto lateral SI conserva el orden, asi que este modulo,
 * puesto el PRIMERO, arregla el problema sin depender de acordarse de
 * -r dotenv/config en la linea de comandos.
 */
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
