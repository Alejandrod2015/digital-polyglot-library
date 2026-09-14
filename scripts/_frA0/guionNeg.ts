// Prueba negativa: "là-haut" no puede contar un "là" suelto como encuentro.
import { validateJourneyStories } from "@/lib/validateJourneyStories";
const mk = (slug: string, text: string, vocab: any[]) => ({ slug, title: slug, text, vocab, language: "FR", level: "a0", topic: "t" });
const v = (w: string, anchor = false) => ({ word: w, surface: w, type: "adverb", definition: "x x x x", ...(anchor ? { anchor: true } : {}) });
const stories = [
  mk("a", "Il monte là-haut. “Oui”, dit Léa.", [v("là-haut"), v("oui", true)]),
  mk("b", "Il est là. Il reste là. “Non”, dit Léa.", [v("non")]),
  mk("c", "Aujourd'hui, il est là-haut. “Bon”, dit Léa.", [v("aujourd'hui")]),
  mk("d", "Aujourd’hui, il pleut. “Bon”, dit Léa.", [v("pluie")]),
];
const c: any = validateJourneyStories(stories as never, { language: "FR", level: "a0", conjuntoCompleto: true }).find((c: any) => c.id === "journey-vocab-recirculation");
console.log(c?.status, "·", c?.detail);
console.log("esperado: là-haut con 2 encuentros (a y c; el 'là' de b no cuenta), aujourd'hui con 2 (c y d, apostrofo curvo normalizado), non y pluie sueltos");
