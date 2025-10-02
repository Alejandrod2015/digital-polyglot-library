import { Book } from "@/types/books";

export const ssEsEs: Book = {
  id: "ss-es-es", // 👈 ahora coincide con la carpeta /audio/ss-es-es
  title: "Short Stories in Spanish from Spain",
  description: "A collection of short stories from Spain.",
  audioFolder: "/audio/ss-es-es", // 👈 apunta a la carpeta correcta
  stories: [
    {
      id: "1",
      title: "1. Paseo por la Gran Vía",
      text: "Es una tarde luminosa en Madrid. Las terrazas están llenas y el bullicio llena el aire.",
      dialogue: "Lucía: ¡Vamos por unas tapas!",
      audio: "ss-es-es_1.mp3", // 👈 archivo dentro de /audio/ss-es-es
    },
    {
      id: "2",
      title: "2. En el Mercado de Valencia",
      text: "El aroma de naranjas frescas invade el mercado mientras los vendedores gritan sus ofertas.",
      dialogue: "Vendedor: ¡Naranjas recién cortadas!",
      audio: "ss-es-es_2.mp3", // 👈 asegúrate de tener este archivo
    },
  ],
};
