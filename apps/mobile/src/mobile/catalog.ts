import type { Book } from "@digital-polyglot/domain";

export const mobileCatalog: Book[] = [
  {
    id: "colombian-spanish-stories-preview",
    slug: "colombian-spanish-stories-for-beginners",
    title: "Colombian Spanish Stories for Beginners",
    subtitle: "Conversational stories for everyday Colombian Spanish.",
    description:
      "A mobile-friendly preview of beginner stories set in Colombia, with cultural context, light vocabulary support, and audio-ready lessons.",
    language: "spanish",
    variant: "latam",
    region: "colombia",
    level: "beginner",
    cefrLevel: "a1",
    topic: "Culture & Traditions",
    formality: "neutral",
    cover: "https://cdn.sanity.io/images/9u7ilulp/production/0577a9b9deba611ca2af702a12ac07aa3aa64e9f-6740x9505.jpg",
    audioFolder: "",
    published: true,
    stories: [
      {
        id: "el-mercado-de-medellin",
        slug: "el-mercado-de-medellin",
        title: "El mercado de Medellin",
        text:
          "El bullicio del mercado de Medellin es envolvente. Los vendedores gritan sus ofertas mientras el aroma de frutas frescas llena el aire. Mateo camina entre puestos coloridos y prueba productos locales por primera vez. Entre jugos, hierbas y conversaciones amables, descubre que un mercado tambien puede ser una leccion viva de cultura y lenguaje.",
        audio: "https://cdn.sanity.io/files/9u7ilulp/production/3dc8adb3f689467cf519c3ac59eae3f8ebbf88ad.mp3",
        cover: "https://cdn.sanity.io/images/9u7ilulp/production/10213341d64be80e7ec78bfb621c92f6f091e183-1536x1024.png",
        language: "spanish",
        region: "colombia",
        level: "beginner",
        topic: "Money & Shopping",
        vocab: [
          { word: "parcero", definition: "close friend" },
          { word: "lulo", definition: "a sour tropical fruit often used in juice" },
          { word: "ajiaco", definition: "a traditional Colombian soup" },
        ],
      },
      {
        id: "el-baile-en-la-plaza",
        slug: "el-baile-en-la-plaza",
        title: "El baile en la plaza",
        text:
          "La plaza del pueblo se llena de musica, luces y risas. Laura y Esteban llegan curiosos a una fiesta costeña y terminan aprendiendo a bailar cumbia con Dona Maria. Mientras siguen el ritmo de tambores y gaitas, entienden que bailar tambien es una forma de contar la historia de una comunidad.",
        audio: "https://cdn.sanity.io/files/9u7ilulp/production/403266f861d8079eb87087f0608500b9ec0488a1.mp3",
        cover: "https://cdn.sanity.io/images/9u7ilulp/production/9d9debe54c9efb43587130da0924017f02b1c051-1536x1024.png",
        language: "spanish",
        region: "colombia",
        level: "beginner",
        topic: "Culture & Traditions",
        vocab: [
          { word: "cumbia", definition: "traditional Colombian music and dance" },
          { word: "gaita", definition: "traditional wind instrument" },
          { word: "sombrero vueltiao", definition: "iconic woven Colombian hat" },
        ],
      },
    ],
  },
];
