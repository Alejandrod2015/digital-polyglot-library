import { Book } from "@/types/books";

export const ssEsArg: Book = {
  id: "ss-es-arg", // 👈 coincide con la carpeta y con el import en index.ts
  slug: "short-stories-argentinian-spanish", // 👈 nuevo slug SEO-friendly
  title: "Short Stories in Argentinian Spanish",
  subtitle: "Experience Buenos Aires through its cafés, tango and traditions",
  description: "A collection of short stories from Argentina.",
  cover: "/covers/ss-es-arg.jpg", // 👈 asegúrate de tener esta portada en /public/covers
  theme: ["Culture", "Buenos Aires", "Tango"],
  level: "intermediate",
  audioFolder: "/audio/ss-es-arg", // 👈 apunta a la carpeta correcta
  stories: [
    {
      id: "1",
      slug: "cafe-en-palermo", // 👈 nuevo
      title: "1. Café en Palermo",
      text: "Buenos Aires despierta con el aroma a café y medialunas en una mañana porteña.",
      dialogue: "Martín: Che, ¿nos juntamos en el café de siempre?",
      audio: "ss-es-arg_1.mp3", // 👈 archivo de audio para Argentina
    },
    {
      id: "2",
      slug: "caminito-en-la-boca", // 👈 nuevo
      title: "2. Caminito en La Boca",
      text: "Los colores vivos de las casas contrastan con los pasos de los bailarines de tango.",
      dialogue: "Guía: Este barrio respira historia y arte.",
      audio: "ss-es-arg_2.mp3", // 👈 asegúrate de tener este archivo
    },
  ],
};
