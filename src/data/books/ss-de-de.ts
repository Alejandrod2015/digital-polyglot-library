import { Book } from "@/types/books";

export const ssDeDe: Book = {
  id: "ss-de-de", // 👈 coincide con la carpeta y con el import en index.ts
  slug: "short-stories-german-hamburg", // 👈 nuevo slug SEO-friendly
  title: "Short Stories in German from Hamburg",
  subtitle: "Discover Hamburg’s vibrant nightlife through language",
  description:
    "A relaxed Friday night turns into an unforgettable experience when three friends, a local from Hamburg, a newcomer to the city, and a curious visitor from Spain, dive into the nightlife of the famous Reeperbahn. Between bars, clubs, music, and late-night currywurst, they not only discover the city but also each other. The story is told in the first person by one of the friends, a local from Hamburg, offering a personal and down-to-earth perspective on the night and what his friends might be feeling or thinking.",
  cover: "/covers/ss-de-de.jpg", // 👈 asegúrate de tener esta portada en /public/covers
  theme: ["Culture", "Urban life", "Hamburg"],
  level: "intermediate",
  audioFolder: "/audio/ss-de-de", // 👈 carpeta real en /public/audio
  stories: [
    {
      id: "1",
      slug: "hamburger-nachtleben", // 👈 nuevo
      title: "1. Hamburger Nachtleben",


text: `
<p>Ein ruhiger Abend wird zu einem kleinen Abenteuer, als Laura, eine junge Hamburgerin, mit ihrem Freund Niko und Lea, einer Spanierin, die gerade neu in der Stadt ist, loszieht. Zwischen Bars, Musik und Currywurst führt uns Laura durch eine Nacht voller erster Eindrücke, Lachen und der besonderen Energie des bekanntesten Viertels der Stadt.</p>

<p>Es war Freitagabend und ich hatte einfach <span class="vocab-word" data-word="Bock">Bock</span>, rauszugehen. Die Woche war lang, das Wetter halbwegs okay – typisch Hamburg eben – und mein Kumpel Niko hatte 'ne Idee:</p>

<blockquote>„Ey, <span class="vocab-word" data-word="lass mal">lass mal</span> auf die Reeperbahn! Lea ist auch dabei.“</blockquote>

<p>Lea war neu in der Stadt – erst seit zwei Wochen hier, aus Spanien. Super nett, bisschen schüchtern vielleicht, aber sie wollte das <span class="vocab-word" data-word="echte Hamburg">echte Hamburg</span> erleben. Und wo geht das besser als <span class="vocab-word" data-word="auf’m Kiez">auf’m Kiez</span>?</p>

<p>Also: Jacke an, Bier <span class="vocab-word" data-word="aus’m Kiosk">aus’m Kiosk</span> in die Hand – <span class="vocab-word" data-word="vorglühen">vorglühen</span>, aber gemütlich. Wir haben uns an der U-Bahn getroffen und sind zusammen los.</p>

<blockquote>„Na, <span class="vocab-word" data-word="was geht">was geht</span>?“, fragt Niko, als er mich sieht.</blockquote>

<blockquote>„Nicht viel, Bro. Endlich Wochenende“, sag ich und <span class="vocab-word" data-word="geb ihm 'nen Check">geb ihm 'nen Check</span>.</blockquote>

<p>Lea steht daneben, lächelt, bisschen verloren vielleicht, aber neugierig. Sie versteht schon einiges, aber der <span class="vocab-word" data-word="Hamburger Slang">Hamburger Slang</span> ist hart.</p>

<p>Als wir ankommen, ist schon richtig was los. Lichter, Musik, Leute in allen möglichen Outfits. Manche elegant, andere... naja, eher <span class="vocab-word" data-word="Festival-Style">Festival-Style</span>. Niko grinst:</p>

<blockquote>„Alter, heute <span class="vocab-word" data-word="geht’s ab">geht’s ab</span>. Ich spür’s.“</blockquote>

<p>Wir gehen erst in 'ne kleine Bar, ein bisschen chilliger. Cocktails, laute Musik, viel <span class="vocab-word" data-word="Gelaber">Gelaber</span>. Lea bestellt auf Deutsch – bisschen holprig, aber sie schlägt sich gut:</p>

<blockquote>„Ähm... ich möchte einen... Caipi?“</blockquote>

<p>Der Barkeeper nickt. „Klar, kommt sofort!“</p>

<p>Niko prostet ihr zu. „Du passt hier gut rein, Lea. In ein paar Wochen sprichst du wie 'ne Hamburgerin.“</p>

<p>Sie lacht. „Mit so viel Bier? Kein Problem.“</p>

<p>Später ziehen wir weiter.</p>

<blockquote>„<span class="vocab-word" data-word="Lass mal 'ne Runde machen">Lass mal 'ne Runde machen</span>“, schlag ich vor.</blockquote>

<p>Wir laufen durch die Reeperbahn, hören Musik von überall – Techno, Rock, Schlager. An einer Ecke steht 'ne Gruppe Typen und singt laut „Atemlos“. Keine Ahnung warum.</p>

<blockquote>„Das ist so <span class="vocab-word" data-word="bescheuert">bescheuert</span> – ich lieb's!“, sagt Niko.</blockquote>

<p>In einem Club mit rotem Licht bleiben wir hängen. Kein Eintritt, gute Musik, und die Leute tanzen schon. Drinnen ist es voll, aber nicht unangenehm. Ich spür, wie sich die Stimmung ändert. Wir sind jetzt mittendrin.</p>

<p>Lea tanzt, als wäre sie nie woanders gewesen. Niko auch. Ich steh kurz an der Bar, beobachte die beiden. Sie lachen, reden nah – vielleicht ein kleiner <span class="vocab-word" data-word="Crush">Crush</span>? Wer weiß.</p>

<p>Gegen drei Uhr sind wir draußen. Müde, verschwitzt, aber <span class="vocab-word" data-word="gut drauf">gut drauf</span>.</p>

<blockquote>„Leute... Wurst?“, fragt Niko.</blockquote>

<blockquote>„Wurst klingt <span class="vocab-word" data-word="mega">mega</span>“, sagt Lea.</blockquote>

<p>Wir holen uns Currywurst mit Pommes an einem kleinen <span class="vocab-word" data-word="Imbiss">Imbiss</span>. Typisch Hamburg: fettig, warm, perfekt nach dem Tanzen.</p>

<p>Ich schau die beiden an – meine Leute, mein Kiez, meine Nacht. So einfach und doch so besonders.</p>

<blockquote>„War 'ne gute Entscheidung, rauszugehen, oder?“, sag ich.</blockquote>

<p>Lea nickt mit vollem Mund. „Beste Idee!“</p>
`,

vocab: [
  { word: "Bock", definition: "to feel like doing something" },
  { word: "lass mal", definition: "let's do something" },
  { word: "echte Hamburg", definition: "the real Hamburg experience" },
  { word: "auf’m Kiez", definition: "in the famous party district of Hamburg" },
  { word: "aus’m Kiosk", definition: "from the kiosk" },
  { word: "vorglühen", definition: "to drink alcohol before going out" },
  { word: "was geht", definition: "what's up" },
  { word: "geb ihm 'nen Check", definition: "to give him a fist bump or handshake" },
  { word: "Hamburger Slang", definition: "local dialect or style of speaking in Hamburg" },
  { word: "Festival-Style", definition: "a style of clothing like at music festivals" },
  { word: "geht’s ab", definition: "it's going to be wild or exciting" },
  { word: "Gelaber", definition: "chatter or casual talk" },
  { word: "Lass mal 'ne Runde machen", definition: "let's walk around" },
  { word: "bescheuert", definition: "silly or crazy" },
  { word: "Crush", definition: "a romantic attraction" },
  { word: "gut drauf", definition: "in a good mood" },
  { word: "mega", definition: "really great" },
  { word: "Imbiss", definition: "snack stand or small fast-food place" },
  { word: "Kiez", definition: "local word for neighborhood, often the nightlife area" },
  { word: "prostet", definition: "to toast with drinks" },
],


      audio: "ss-de-de_1.mp3",
    },
  ],
};
