import { Book } from "@/types/books";

export const ssEsMx: Book = {
  id: "ss-es-mx", // 👈 coincide con la carpeta y la convención
  title: "Short Stories in Mexican Spanish",
  description: "A collection of short stories from Mexico.",
  audioFolder: "/audio/ss-es-mx", // 👈 apunta a la carpeta correcta
  stories: [
    {
      id: "1",
      title: "1. El Sabor del Maíz: Un Viaje a través de los Tacos",
      text: `Es una mañana soleada en Ciudad de México. Las calles están llenas de vida, con el bullicio de coches, vendedores y el aroma inconfundible de comida callejera que invade el aire.`,
      dialogue: `Diego: Por fin, ¡el momento ha llegado! Tacos al pastor, los originales, en la mera CDMX.`,
      audio: "ss-es-mx_1.mp3", // 👈 archivo dentro de /audio/ss-es-mx
    },
    {
      id: "2",
      title: "2. El Encuentro en el Zócalo",
      text: `María camina con prisa entre la multitud del Zócalo. Sabe que alguien la espera.`,
      dialogue: `María: ¿Dónde estás? Dijiste a las diez en punto.`,
      audio: "ss-es-mx_2.mp3", // 👈 asegúrate de tener este archivo
    },
    {
      id: "3",
      title: "3. Dulces de Tamarindo",
      text: `Los niños corren por el mercado mientras el aroma de tamarindo llena el aire.`,
      dialogue: `Niño: ¡Mamá, quiero uno de esos dulces!`,
      audio: "ss-es-mx_3.mp3", // 👈 asegúrate de tener este archivo
    },
  ],
};
