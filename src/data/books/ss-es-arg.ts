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
      audio: "ss-es-arg_1.mp3", // 👈 archivo de audio para Argentina
    },
  ],
};
