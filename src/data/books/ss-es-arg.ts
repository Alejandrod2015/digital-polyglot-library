import { Book } from "@/types/books";

export const ssEsArg: Book = {
  id: "ss-es-arg", // 👈 ahora coincide con la carpeta y con el import en index.ts
  title: "Short Stories in Argentinian Spanish",
  description: "A collection of short stories from Argentina.",
  audioFolder: "/audio/ss-es-arg", // 👈 apunta a la carpeta correcta
  stories: [
    {
      id: "1",
      title: "1. Café en Palermo",
      text: "Buenos Aires despierta con el aroma a café y medialunas en una mañana porteña.",
      dialogue: "Martín: Che, ¿nos juntamos en el café de siempre?",
      audio: "ss-es-arg_1.mp3", // 👈 archivo de audio para Argentina
    },
    {
      id: "2",
      title: "2. Caminito en La Boca",
      text: "Los colores vivos de las casas contrastan con los pasos de los bailarines de tango.",
      dialogue: "Guía: Este barrio respira historia y arte.",
      audio: "ss-es-arg_2.mp3", // 👈 asegúrate de tener este archivo
    },
  ],
};
