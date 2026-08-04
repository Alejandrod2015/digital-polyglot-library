"use client";

import React from "react";
import type { TapGloss } from "@/lib/tapGlosses";

// Tokeniza CUALQUIER cadena suelta (hoy: el título de la historia) igual que
// TapGlossReader hace con el cuerpo, marcando como `.tap-word` las palabras que
// tienen gloss. El listener y la burbuja NO viven aquí: los pone TapGlossLayer,
// que escucha en todo el documento, así que basta con que la capa esté montada
// en alguna parte de la página para que el título responda.
//
// El título se quedaba fuera del diccionario porque se renderiza como nodo de
// texto plano: ni `.tap-word` ni `[data-word-index]` existían sobre él y el
// listener no tenía a qué engancharse.
const WORD_SPLIT = /(\p{L}+(?:-\p{L}+)*)/u;

export default function TapGlossText({
  text,
  glosses,
}: {
  text: string;
  glosses: Record<string, TapGloss>;
}) {
  const parts = text.split(WORD_SPLIT);
  if (parts.length === 1) return <>{text}</>;
  return (
    <>
      {parts.map((part, i) => {
        if (i % 2 === 1) {
          const key = part.toLowerCase();
          if (glosses[key]) {
            return (
              <span key={i} className="tap-word cursor-pointer" data-token={key}>
                {part}
              </span>
            );
          }
        }
        return <React.Fragment key={i}>{part}</React.Fragment>;
      })}
    </>
  );
}
