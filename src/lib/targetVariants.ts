/**
 * Las variantes de contenido que ofrece cada idioma, y cómo se llaman a la
 * vista. Vivían dentro del formulario de la beta, que es un componente de
 * cliente, así que el panel de Studio no podía leerlas: la ficha del
 * solicitante enseñaba "Spanish" y se callaba si pedía España o Latinoamérica,
 * que es justo el dato que decide a qué journey se le invita.
 */
export type TargetVariantOption = { value: string; label: string };

// Journeys are variant-scoped, so a Spanish learner aiming at a Mexican
// grandmother and one moving to Madrid want different content. Only languages
// with more than one flavour ask the question; the rest would just be noise.
// The first block is ordered by what people have actually paid for (claim
// tokens, 2026-08): Colombian titles lead by a wide margin, then general LATAM,
// then Puerto Rico, Panama, Argentina and Ecuador. The second block is every
// other major Spanish-speaking country, listed even though none has ever sold a
// book, because you cannot sell what you never wrote: the countries missing
// from the sales data are the ones we have never offered anything for, not the
// ones nobody wants. Someone picking Peru here is the only way we would learn.
//
// "Other" keeps a free-text escape so an unexpected answer is captured rather
// than rounded to the nearest option. No "Not sure yet": la lista lleva todos
// los países del idioma más el texto libre, así que quien no elige no es que
// no pueda, es que se lo salta, y un blanco deja al alumno viendo contenido de
// cualquier variante (2026-08-23).
export const TARGET_VARIANTS: Record<string, TargetVariantOption[]> = {
  Spanish: [
    { value: "colombia", label: "Colombia" },
    { value: "latam", label: "Latin America (general)" },
    { value: "puerto-rico", label: "Puerto Rico" },
    { value: "panama", label: "Panama" },
    { value: "argentina", label: "Argentina" },
    { value: "mexico", label: "Mexico" },
    { value: "spain", label: "Spain" },
    { value: "peru", label: "Peru" },
    { value: "chile", label: "Chile" },
    { value: "ecuador", label: "Ecuador" },
    { value: "dominican-republic", label: "Dominican Republic" },
    { value: "venezuela", label: "Venezuela" },
    { value: "cuba", label: "Cuba" },
    { value: "other", label: "Somewhere else..." },
  ],
  // Every other language we offer needs the question just as much as Spanish
  // does, and for a while none of them asked it: the map held a single key, so
  // Portuguese and French applicants were never shown the field and every one
  // of their rows landed null. Brazil and Portugal are not the same product,
  // and neither are Paris and Montreal. Ordered by where the learners are, not
  // by where the language started.
  Portuguese: [
    { value: "brazil", label: "Brazil" },
    { value: "portugal", label: "Portugal" },
    { value: "other", label: "Somewhere else..." },
  ],
  French: [
    { value: "france", label: "France" },
    { value: "quebec", label: "Canada (Quebec)" },
    { value: "belgium", label: "Belgium" },
    { value: "switzerland", label: "Switzerland" },
    { value: "west-africa", label: "West Africa" },
    { value: "other", label: "Somewhere else..." },
  ],
  German: [
    { value: "germany", label: "Germany" },
    { value: "austria", label: "Austria" },
    { value: "switzerland", label: "Switzerland" },
    { value: "other", label: "Somewhere else..." },
  ],
  Italian: [
    { value: "italy", label: "Italy" },
    { value: "switzerland", label: "Switzerland" },
    { value: "other", label: "Somewhere else..." },
  ],
};

/**
 * Etiqueta de una variante guardada. El valor puede no estar en la lista: quien
 * elige "Somewhere else..." escribe el suyo a mano, y las filas anteriores al
 * 2026-08-11 son null porque nunca se les preguntó, no porque les diera igual.
 */
export function targetVariantLabel(language: string, value: string | null): string | null {
  if (!value) return null;
  // El texto libre admite cualquier cosa, y hay filas con un "/" suelto. Un
  // carácter no nombra una región: vale lo mismo que no haber contestado.
  if (value.trim().length < 2) return null;
  const known = TARGET_VARIANTS[language]?.find((v) => v.value === value);
  if (known && known.value !== "other") return known.label;
  return value
    .split("-")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}
