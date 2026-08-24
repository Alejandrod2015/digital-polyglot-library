/**
 * Porton de evidencia para los 7 temas del Traveler ES/spain A2.
 * Solo LEE: imprime la tabla y tira si un tema no cita algo que un solicitante
 * de espanol ESCRIBIO. La escritura de la tabla `Topic` vive en createJourney.ts.
 *
 * El corpus de espanol son 31 frases (`scripts/_a2/_corpus.ts`), y de esas solo
 * seis o siete nombran un dominio. El B1 gasto siete; estas son las que quedan
 * sin usar, mas dos que el B1 cito por otra mitad de la misma frase.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { assertTopicsGrounded, type TopicProposal } from "../../src/lib/topicEvidence";

export const A2_TOPICS: TopicProposal[] = [
  // Jaelyn: su novio traduce cada vez que la abuela pide algo. El dominio son
  // los objetos que se piden, se alcanzan y se pasan de mano en mano.
  { label: "Fetching & Handing Over", slug: "fetching-and-handing-over",
    evidence: ["that I can’t seem to understand, reached for or fixed"] },
  // Sascha quiere estar liquido en espanol con un amigo: la tarde larga en la
  // que no pasa nada y hay que sostener la conversacion igual.
  { label: "Company & Long Afternoons", slug: "company-and-long-afternoons",
    evidence: ["Liquido en español con mis amigo Alexandros"] },
  // Ty tira de traduccion en cuanto no entiende. Lo que se usa antes de eso
  // es la mano: senalar, tocar el hombro, contar con los dedos.
  { label: "Hands & Gestures", slug: "hands-and-gestures",
    evidence: ["instantly check translations that I don’t understand"] },
  // Geraldine viaja a Espana. Fuera de temporada el pueblo se sale al monte y
  // a la huerta, que es donde el vocabulario deja de ser de bar.
  { label: "Orchards & Baskets", slug: "orchards-and-baskets",
    evidence: ["when travelling to Spain"] },
  // Jaelyn otra vez, y por otra cosa: la abuela con la que vive su novio no
  // tiene otro idioma al que cambiarse. La mesa de esa casa es el tema.
  //
  // El tema que estaba aqui era "Teasing & Being Funny", con la frase de
  // Jaelyn sobre ser mas graciosa que su novio. Se cayo al medir la pool, no
  // al escribir: la lista A1+A2 casi no tiene humor, y lo poco que tiene
  // (broma, chiste, reirse, sonriente) ya lo ensenan el A1 y el B1 de Espana.
  // Un tema cuyo dominio lexico esta entero fuera de alcance no es un tema.
  { label: "Pots & Home Cooking", slug: "pots-and-home-cooking",
    evidence: ["He lives with his grandmother who only speaks Spanish"] },
  // Christoph aprende por su pareja nueva y quiere probar todo lo que haya:
  // el tema del que se atreve y del que se queda callado.
  { label: "Nerves & Courage", slug: "nerves-and-courage",
    evidence: ["want to try all the chances which are available"] },
  // Vincent tiene casa en Espana y quiere hablar con los vecinos: las llaves,
  // el recibo y la firma que convierten a una veraneante en propietaria.
  { label: "Keys & Signatures", slug: "keys-and-signatures",
    evidence: ["Holiday home in Spain and I wish to talk to neighbours"] },
];

/** Lo que ya cubren los otros journeys de espanol de Espana. */
export const A2_EXISTING_LABELS = [
  // Traveler ES/spain A1
  "Neighbours & Favours", "Timetables & Meal Times", "Bars & Tapas",
  "Family & Relatives", "Plans & Invitations", "Health & Symptoms",
  "Festivals & Traditions",
  // Traveler ES/spain B1
  "Winter & Empty Houses", "Jobs & Wages", "Storms & The Sea",
  "Repeating & Rephrasing", "Sayings & Nicknames", "Deals & Estimates",
  "Trust & Rumours",
];

if (require.main === module) {
  assertTopicsGrounded({ language: "spanish", proposals: A2_TOPICS, existingLabels: A2_EXISTING_LABELS })
    .then(() => console.log("PORTON OK"))
    .catch((e) => { console.error(String(e.message ?? e)); process.exit(1); })
    .finally(() => process.exit(0));
}
