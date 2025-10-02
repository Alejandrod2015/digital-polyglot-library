import { Book } from "@/types/books";

export const ssDeDe: Book = {
  id: "ss-de-de", // 👈 coincide con la carpeta y con el import en index.ts
  title: "Short Stories in German from Hamburg",
  subtitle: "Discover Hamburg’s vibrant nightlife through language",
  description: "A relaxed Friday night turns into an unforgettable experience when three friends, a local from Hamburg, a newcomer to the city, and a curious visitor from Spain, dive into the nightlife of the famous Reeperbahn. Between bars, clubs, music, and late-night currywurst, they not only discover the city but also each other. The story is told in the first person by one of the friends, a local from Hamburg, offering a personal and down-to-earth perspective on the night and what his friends might be feeling or thinking.", // sinopsis
  cover: "/covers/ss-de-de.jpg", // 👈 asegúrate de tener esta portada en /public/covers
  theme: ["Culture", "Urban life", "Hamburg"],
  level: "intermediate",
  audioFolder: "/audio/ss-de-de", // 👈 carpeta real en /public/audio
  stories: [
    {
      id: "1",
      title: "1. Hamburger Nachtleben",





      text: `
<p>Ein ruhiger Abend wird zu einem kleinen Abenteuer, als Laura, eine junge Hamburgerin, mit ihrem Freund Niko und Lea, einer Spanierin, die gerade neu in der Stadt ist, loszieht. Zwischen Bars, Musik und Currywurst führt uns Laura durch eine Nacht voller erster Eindrücke, Lachen und der besonderen Energie des bekanntesten Viertels der Stadt.</p>

<p>Es war Freitagabend und ich hatte einfach Bock, rauszugehen. Die Woche war lang, das Wetter halbwegs okay – typisch Hamburg eben – und mein Kumpel Niko hatte 'ne Idee:</p>
<blockquote>„Ey, lass mal auf die Reeperbahn! Lea ist auch dabei.“</blockquote>

<p>Lea war neu in der Stadt – erst seit zwei Wochen hier, aus Spanien. Super nett, bisschen schüchtern vielleicht, aber sie wollte das echte Hamburg erleben. Und wo geht das besser als auf’m Kiez?</p>

<p>Also: Jacke an, Bier aus’m Kiosk in die Hand – vorglühen, aber gemütlich. Wir haben uns an der U-Bahn getroffen und sind zusammen los.</p>
<blockquote>„Na, was geht?“, fragt Niko, als er mich sieht.</blockquote>
<blockquote>„Nicht viel, Bro. Endlich Wochenende“, sag ich und geb ihm 'nen Check.</blockquote>

<p>Lea steht daneben, lächelt, bisschen verloren vielleicht, aber neugierig. Sie versteht schon einiges, aber der Hamburger Slang ist hart.</p>

<p>Als wir ankommen, ist schon richtig was los. Lichter, Musik, Leute in allen möglichen Outfits. Manche elegant, andere... naja, eher Festival-Style. Niko grinst:</p>
<blockquote>„Alter, heute geht’s ab. Ich spür’s.“</blockquote>

<p>Wir gehen erst in 'ne kleine Bar, ein bisschen chilliger. Cocktails, laute Musik, viel Gelaber. Lea bestellt auf Deutsch – bisschen holprig, aber sie schlägt sich gut:</p>
<blockquote>„Ähm... ich möchte einen... Caipi?“</blockquote>
<blockquote>Der Barkeeper nickt. „Klar, kommt sofort!“</blockquote>
<blockquote>Niko prostet ihr zu. „Du passt hier gut rein, Lea. In ein paar Wochen sprichst du wie 'ne Hamburgerin.“</blockquote>
<blockquote>Sie lacht. „Mit so viel Bier? Kein Problem.“</blockquote>

<p>Später ziehen wir weiter.</p>
<blockquote>„Lass mal 'ne Runde machen“, schlag ich vor.</blockquote>

<p>Wir laufen durch die Reeperbahn, hören Musik von überall – Techno, Rock, Schlager. An einer Ecke steht 'ne Gruppe Typen und singt laut „Atemlos“. Keine Ahnung warum.</p>
<blockquote>„Das ist so bescheuert – ich lieb's!“, sagt Niko.</blockquote>

<p>In einem Club mit rotem Licht bleiben wir hängen. Kein Eintritt, gute Musik, und die Leute tanzen schon. Drinnen ist es voll, aber nicht unangenehm. Ich spür, wie sich die Stimmung ändert. Wir sind jetzt mittendrin.</p>

<p>Lea tanzt, als wäre sie nie woanders gewesen. Niko auch. Ich steh kurz an der Bar, beobachte die beiden. Sie lachen, reden nah – vielleicht ein kleiner Crush? Wer weiß.</p>

<p>Gegen drei Uhr sind wir draußen. Müde, verschwitzt, aber gut drauf.</p>
<blockquote>„Leute... Wurst?“, fragt Niko.</blockquote>
<blockquote>„Wurst klingt mega“, sagt Lea.</blockquote>

<p>Wir holen uns Currywurst mit Pommes an einem kleinen Imbiss. Typisch Hamburg: fettig, warm, perfekt nach dem Tanzen.</p>

<p>Ich schau die beiden an – meine Leute, mein Kiez, meine Nacht. So einfach und doch so besonders.</p>
<blockquote>„War 'ne gute Entscheidung, rauszugehen, oder?“, sag ich.</blockquote>
<blockquote>Lea nickt mit vollem Mund. „Beste Idee!“</blockquote>
`,








      dialogue: "A relaxed Friday night turns into an unforgettable experience when three friends — a local from Hamburg, a newcomer to the city, and a curious visitor from Spain — dive into the nightlife of the famous Reeperbahn. Between bars, clubs, music, and late-night currywurst, they not only discover the city but also each other.",
      audio: "ss-de-de_1.mp3", // 👈 sin "/" para concatenar bien
    },
  ],
};
