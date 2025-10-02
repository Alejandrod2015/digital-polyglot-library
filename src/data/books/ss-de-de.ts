import { Book } from "@/types/books";

export const ssDeDe: Book = {
  id: "ss-de-de", // 👈 coincide con la carpeta y con el import en index.ts
  title: "Short Stories in German from Hamburg",
  description: "A short story set in the vibrant nightlife of Hamburg.",
  audioFolder: "/audio/ss-de-de", // 👈 carpeta real en /public/audio
  stories: [
    {
      id: "1",
      title: "1. Hamburger Nachtleben",
      text: `Emma zeigt Jonas das Hamburger Nachtleben. Ein spontaner Abend im Schanzenviertel bringt Musik, Döner und kleine Chaos-Momente.

Die Luft roch nach Regen und Frittierfett, als Emma Jonas durch die Schulterstraße zog. Überall flackernde Lichter, Gelächter, Musik. Es war laut, eng, lebendig.
„Das ist die Schanze“, sagte Emma und grinste. „Besser als jeder Club.“
Jonas sah sich um. „Das ist… wild. Und was essen wir zuerst? Ich hab alles gelesen – Falafel, Fischbrötchen, Currywurst?“
„Currywurst bei Schmitti. Aber erst ein Astra. Ohne Bier zählt der Abend nicht.“
Sie quetschten sich in einen Kiosk. Drinnen roch es nach Zigaretten und Gummibärchen.
„Zwei Astra, bitte“, sagte Emma.
Draußen, mit den Flaschen in der Hand, setzte der Regen ein. Schnell, warm, typisch Hamburg.
„Mist! Mein Handy!“ Jonas tastete hektisch seine Taschen ab.
Emma lachte. „Willkommen in Hamburg. Alles geht verloren, außer dem Spaß.“`,
      dialogue: "Emma: Willkommen in Hamburg. Alles geht verloren, außer dem Spaß.",
      audio: "ss-de-de_1.mp3", // 👈 sin "/" para concatenar bien
    },
  ],
};
