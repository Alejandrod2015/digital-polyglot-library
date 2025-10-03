import { Book } from "@/types/books";

export const ssEsEs: Book = {
  id: "ss-es-es", // 👈 coincide con la carpeta /audio/ss-es-es
  slug: "short-stories-castilian-spanish", // 👈 nuevo slug SEO-friendly
  title: "Short Stories in Spanish from Spain",
  subtitle: "Discover Spain’s culture through everyday stories",
  description: "A collection of short stories from Spain.",
  cover: "/covers/ss-es-es.jpg", // 👈 asegúrate de tener esta portada en /public/covers
  theme: ["Culture", "Daily life", "Spain"],
  level: "basic",
  audioFolder: "/audio/ss-es-es", // 👈 apunta a la carpeta correcta
  stories: [
    {
      id: "1",
      slug: "paseo-por-la-gran-via", // 👈 nuevo
      title: "1. Paseo por la Gran Vía",
      text: "Es una tarde luminosa en Madrid. Las terrazas están llenas y el bullicio llena el aire.",
      dialogue: "Lucía: ¡Vamos por unas tapas!",
      audio: "ss-es-es_1.mp3", // 👈 archivo dentro de /audio/ss-es-es
    },
    {
      id: "2",
      slug: "en-el-mercado-de-valencia", // 👈 nuevo
      title: "2. En el Mercado de Valencia",
      text: "El aroma de naranjas frescas invade el mercado mientras los vendedores gritan sus ofertas.",
      dialogue: "Vendedor: ¡Naranjas recién cortadas!",
      audio: "ss-es-es_2.mp3", // 👈 asegúrate de tener este archivo
    },
  ],
};
