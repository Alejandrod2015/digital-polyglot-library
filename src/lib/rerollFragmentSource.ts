/**
 * Que texto narra un re-tirado de UN fragmento (scripts/_rerollSection.ts).
 *
 * POR QUE (2026-09-13). El script narraba `frag.text`, la copia congelada en
 * `audioFragments` al renderizar, salvo en el fragmento 0, que ya tomaba
 * `story.title`. Tras corregir un parrafo con saveStory.ts, re-tirar su tramo
 * volvia a narrar el parrafo VIEJO y dejaba el fragmento sin sincronizar: la
 * herramienta servia para arreglar entonacion, no cambios de texto. Salto con
 * el FR A1 Friends, donde ocho historias ya narradas recibian una presentacion
 * de personaje o un final nuevo y el usuario decidio narrar solo esos tramos.
 *
 * La fuente de verdad del cuerpo es `story.text`: fragmento i (i >= 1) es el
 * parrafo i. Solo se casa por posicion cuando no hay ambiguedad; si no, TIRA:
 *   - el numero de parrafos no coincide con el de fragmentos del cuerpo
 *     (el texto se partio o se junto de otra forma que al renderizar);
 *   - los indices del cuerpo no son 1..N seguidos;
 *   - cambian mas de la mitad de los parrafos (eso ya no es una correccion,
 *     es otro texto, y el orden de los tramos no esta garantizado).
 */
export type FragmentLike = { index: number; text: string };

export type FragmentSource = {
  /** Texto a narrar. */
  source: string;
  /** Texto guardado en el fragmento. */
  stored: string;
  /** true si difiere del guardado: hay que pasar `newText` al empalme. */
  changed: boolean;
};

export function splitParagraphs(text: string): string[] {
  return String(text)
    .trim()
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

export function rerollFragmentSource(args: {
  title: string;
  text: string;
  fragments: FragmentLike[];
  index: number;
}): FragmentSource {
  const { title, text, fragments, index } = args;
  const frag = fragments.find((f) => f.index === index);
  if (!frag) throw new Error(`fragmento ${index} no existe (hay ${fragments.length})`);
  const stored = String(frag.text).trim();

  if (index === 0) {
    const source = String(title).trim();
    return { source, stored, changed: source !== stored };
  }

  const body = fragments.filter((f) => f.index > 0).sort((a, b) => a.index - b.index);
  const paras = splitParagraphs(text);
  if (body.length !== paras.length) {
    throw new Error(
      `NO CASA: story.text tiene ${paras.length} parrafos y audioFragments ${body.length} fragmentos de cuerpo. ` +
      `No se adivina que parrafo corresponde al fragmento ${index}.`
    );
  }
  body.forEach((f, i) => {
    if (f.index !== i + 1) {
      throw new Error(`NO CASA: los fragmentos del cuerpo no son 1..${body.length} seguidos (encontrado ${f.index} en la posicion ${i + 1}).`);
    }
  });
  const distintos = body.filter((f, i) => String(f.text).trim() !== paras[i]).length;
  if (distintos > paras.length / 2) {
    throw new Error(
      `NO CASA: ${distintos}/${paras.length} parrafos difieren de sus fragmentos. Eso es otro texto, no una correccion; ` +
      `narra la historia entera.`
    );
  }
  const source = paras[index - 1];
  return { source, stored, changed: source !== stored };
}
