import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";

// Los scripts que SINTETIZAN audio tienen que cargar el entorno antes que
// nada. Si vuelve el patron `import { config } from "dotenv"` seguido de
// `config(...)`, el dotenv corre DESPUES de cargarse elevenlabs.ts (los import
// se izan), el cliente de OpenAI se queda a null y la historia se guarda con
// audioSegments vacio, que es de donde sale el informe de ritmo por oracion.
// El sintoma es una linea "[audio-segments] Missing OPENAI_API_KEY" que no
// para nada y que es facil tomar por un aviso inofensivo.
const SCRIPTS = ["_narraUnaA2.ts", "_muestraA2Titulo.ts"];

describe("carga del entorno en los scripts de narracion", () => {
  for (const f of SCRIPTS) {
    it(`${f} importa _loadEnv antes que cualquier otro modulo`, () => {
      const src = readFileSync(path.join(__dirname, "..", f), "utf8");
      const imports = src.split(/\r?\n/).filter((l) => /^import\s/.test(l));
      expect(imports[0]).toBe('import "./_loadEnv";');
      expect(src).not.toMatch(/import \{ config \} from "dotenv"/);
    });
  }
});
