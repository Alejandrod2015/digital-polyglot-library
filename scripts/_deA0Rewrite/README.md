# Reescritura del vocab del Traveler DE A0

Por qué existe: los 21 cuerpos originales sólo llegaban al suelo de la escalera
de recirculación (3,0) porque la misma palabra ocupaba plaza en hasta nueve
historias. Con tope de dos plazas la media caía a 2,34, así que la escalera hay
que sembrarla en el CUERPO. Ver `docs/de-a0-traveler-escalera-brief.md`.

- `textos/h1..h6.txt`: los seis cuerpos reescritos (Dresde y Heidelberg).
- `_tema1v2.ts` / `_tema2v2.ts`: aplican cuerpo y 20 plazas por historia sobre
  el volcado y escriben el JSON para `saveStory.ts --dry`.
- `_chk2.ts <palabra…>`: dice si una palabra la enseña ya el A1 alemán (tope
  cero, mismo tipo) o un journey de otro tipo (tope dos por historia).
- `_cap2real.ts`, `_reparto.ts`, `_techo.ts`: las mediciones que fijaron el
  diseño. `TOPE=n` cambia el tope de plazas por palabra.

Los scripts son de lectura salvo los `_tema*v2.ts`, que sólo escriben un JSON.
Nada de esto toca la base: el vocab entra únicamente por `scripts/saveStory.ts`.

Estado: 6 de 21 historias en `OK` con el validador canónico. Nada guardado
todavía, porque `saveStory` es todo o nada sobre las 21.
