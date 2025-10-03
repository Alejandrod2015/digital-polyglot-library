import { Book } from "@/types/books";

export const ssEsMx: Book = {
  id: "ss-es-mx", // 👈 coincide con la carpeta y la convención
  slug: "short-stories-mexican-spanish",
  title: "Short Stories in Mexican Spanish",
  subtitle: "Explore Mexico’s streets, flavors and traditions through language",
  description: "A collection of short stories from Mexico.",
  cover: "/covers/ss-es-mx.jpg", // 👈 asegúrate de tener esta portada en /public/covers
  theme: ["Culture", "Food", "Mexico City"],
  level: "basic",
  audioFolder: "/audio/ss-es-mx", // 👈 apunta a la carpeta correcta
  stories: [
    {
      id: "1",
      slug: "el-sabor-del-maiz",
      title: "1. El Sabor del Maíz: Un Viaje a través de los Tacos",
      text: `Es una mañana soleada en Ciudad de México. Las calles están llenas de vida, con el bullicio de coches, vendedores y el aroma inconfundible de comida callejera que invade el aire.`,
      audio: "ss-es-mx_1.mp3", // 👈 archivo dentro de /audio/ss-es-mx
    },
    {
      id: "2",
      slug: "encuentro-en-el-zocalo",
      title: "2. El Encuentro en el Zócalo",
      text: `María camina con prisa entre la multitud del Zócalo. Sabe que alguien la espera.`,
      audio: "ss-es-mx_2.mp3", // 👈 asegúrate de tener este archivo
    },
    {
      id: "3",
      slug: "dulces-de-tamarindo",
      title: "3. Dulces de Tamarindo",
      text: `Los niños corren por el mercado mientras el aroma de tamarindo llena el aire.`,
      audio: "ss-es-mx_3.mp3", // 👈 asegúrate de tener este archivo
    },
  ],
};
