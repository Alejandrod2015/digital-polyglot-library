// Punto de corte seguro para partir un master de audio: dado un punto
// ESTIMADO donde debería caer un limite de fragmento y la lista de huecos de
// silencio reales del master (de ffmpeg silencedetect), decide donde cortar.
//
// Historia (2026-09-15, la-tournee-jamais-offerte, Friends FR B1):
//   1. La version original de `alSilencio()` solo miraba huecos que TERMINAN
//      antes del punto (`b <= t+0.02`). Cuando el punto caia DENTRO de un
//      hueco ANCHO (la pausa real entre fragmentos, que por el margen de
//      error del STT puede medir hasta 0.86s), ese hueco correcto se
//      descartaba por tener `b > t`, y la funcion snapeaba a una pausa
//      INTERNA de la frase (una coma) mas cercana por distancia pero
//      incorrecta: el corte caia a mitad de oracion y el empalme duplicaba
//      o perdia contenido. Arreglado en bbf20063 ("contenedor"): si el punto
//      cae dentro de un hueco, usar ESE.
//   2. Ese arreglo trae un problema distinto: SIEMPRE recentra al punto medio
//      del hueco que contiene el estimado, incluso cuando el estimado YA es
//      preciso (viene de un timestamp de palabra real o del punto medio
//      entre dos oraciones medidas). Un hueco ancho y mal medido (el
//      detector de silencio de ffmpeg no es perfecto: una frase susurrada o
//      un final de palabra suave puede caer bajo el umbral de -35dB sin ser
//      silencio real) puede entonces arrastrar un estimado BUENO hacia un
//      punto PEOR. Pasó con "Elodie, une mecanicienne de velos, est arrivee
//      la boule au ventre.": el estimado (20.67s, punto medio real entre el
//      fin de esa oracion y el inicio de la siguiente) caia dentro de un
//      hueco detectado como [19.80,20.71], y recentrar al medio de ESE hueco
//      (20.25s) cortaba antes de que "la boule au ventre" terminara de
//      sonar, perdiendo la frase entera del master reconstruido.
//
// Arreglo (este archivo): PREFERIR el estimado tal cual si ya cae dentro de
// la tolerancia de algun hueco real (no hace falta recentrar algo que ya
// esta bien). Solo cuando el estimado NO esta cerca de ningun hueco, buscar
// el hueco real MAS CERCANO por distancia absoluta (sin la restriccion
// direccional del bug original: no importa si el hueco termina antes o
// despues del estimado) y usar su centro.
export type Gap = [number, number];

export function boundaryFor(estimate: number, gaps: readonly Gap[], tol = 0.08): number {
  const dentro = gaps.some(([a, b]) => estimate >= a - tol && estimate <= b + tol);
  if (dentro) return estimate;
  let mejor = estimate;
  let dist = Infinity;
  for (const [a, b] of gaps) {
    const centro = (a + b) / 2;
    const d = Math.abs(estimate - centro);
    if (d < dist) { dist = d; mejor = centro; }
  }
  // Sin ningun hueco en absoluto: un margen fijo antes del punto es mejor
  // que cortar justo encima de el.
  return gaps.length ? mejor : Math.max(0, estimate - 0.06);
}
