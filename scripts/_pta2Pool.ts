/** SOLO LECTURA. El pozo A2: lemas de la lista A1A2 que ningun journey PT
 *  ensena, separados portables/no por heuristica ligera (aqui no hay type;
 *  se cuenta el total y una muestra). */
import * as fs from "fs";
import { PORTUGUESE_A1_A2_LEMMAS } from "../src/lib/cefr/portugueseA1A2";
const ens = new Set<string>(JSON.parse(fs.readFileSync("/tmp/pt-ensenadas.json", "utf8")));
const STOP = new Set("o a os as um uma uns umas do da dos das no na nos nas eu tu você ele ela nós vocês eles elas meu teu seu nosso este esta esse essa aquele aquela isto isso aquilo outro mesmo todo cada e ou mas porém porque quando enquanto se embora como que qual quem em de com para por sem sob sobre entre contra desde até após antes não sim talvez claro certo nunca sempre já ainda também só apenas aqui ali lá cá perto longe dentro fora acima abaixo cima baixo muito pouco mais menos bem mal quase tanto tão igual".split(" "));
const libres = [...PORTUGUESE_A1_A2_LEMMAS].filter(w => !ens.has(w) && !STOP.has(w) && w.length > 2);
console.log("lista A1A2:", PORTUGUESE_A1_A2_LEMMAS.size, "· ensenadas PT:", ens.size, "· LIBRES en nivel:", libres.length);
console.log(libres.sort().join(" "));
