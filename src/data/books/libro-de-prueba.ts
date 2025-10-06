import { Book } from "@/types/books";

export const librodeprueba: Book = {
  id: "libro-de-prueba",
  slug: "libro-de-prueba",
  title: "Libro de prueba",
  description: "Descripción de prueba",
  cover: "/covers/default.jpg",
  theme: [],
  level: "beginner",
  audioFolder: "public/audio/ss-de-de",
  stories: [
  {
    "id": "story-de-prueba",
    "slug": "story-de-prueba",
    "title": "Historia de prueba",
    "text":  `

<p><span class="vocab-word" data-word="Lina war nervös">Lina war nervös</span>, als sie in den Schanzenpark ging. Sie hatte Max vor zwei Wochen auf einer Party kennengelernt. Er war witzig, ein bisschen chaotisch, und hatte diesen <span class="vocab-word" data-word="Blick, der gleichzeitig neugierig und freundlich war">Blick, der gleichzeitig neugierig und freundlich war</span>. Jetzt würden sie sich zum ersten Mal <span class="vocab-word" data-word="nur zu zweit">nur zu zweit</span> treffen.</p>

<p>Der Park war voll. Kinder spielten Fußball, Jugendliche lachten laut, und überall roch es <span class="vocab-word" data-word="nach Gras und Pizza">nach Gras und Pizza</span>. Lina setzte sich auf eine Decke unter einem großen Baum und wartete. Sie hatte Kekse in einer kleinen Dose, <span class="vocab-word" data-word="selbst gebacken">selbst gebacken</span> am Abend davor. „<span class="vocab-word" data-word="Bitte schmecken sie ihm">Bitte schmecken sie ihm</span>“, murmelte sie.</p>

<blockquote>„<span class="vocab-word" data-word="Na, schon lange hier?">Na, schon lange hier?</span>“ Max stand vor ihr, leicht verschwitzt, mit zwei Kaffeebechern in der Hand.</blockquote>
<blockquote>„<span class="vocab-word" data-word="Nur ein bisschen">Nur ein bisschen</span>“, antwortete Lina und lächelte.</blockquote>
<blockquote>„Gut! Ich hab Kaffee vom besten Kiosk im Viertel. <span class="vocab-word" data-word="Total überteuert">Total überteuert</span>, aber angeblich fairtrade.“</blockquote>
<blockquote>Lina lachte. „Dann ist er bestimmt <span class="vocab-word" data-word="doppelt so gut">doppelt so gut</span>.“</blockquote>

<p>Sie setzten sich. Max erzählte von seinem Studium und von seinem Mitbewohner, der Gitarre spielte, aber nie aufräumte. Lina erzählte von ihrem Job im Café und von den <span class="vocab-word" data-word="verrückten Kunden">verrückten Kunden</span>, die Latte Art bewerteten, als wäre es Kunst. Sie lachten viel, und manchmal <span class="vocab-word" data-word="schwieg einer, während der andere einfach in die Sonne blinzelte">schwieg einer, während der andere einfach in die Sonne blinzelte</span>.</p>

<p>Ein kleiner Hund kam angerannt und legte sich auf ihre Decke.</p>
<blockquote>„<span class="vocab-word" data-word="Oh, guck mal">Oh, guck mal</span>, er mag dich“, sagte Max.</blockquote>
<blockquote>„Oder meine Kekse“, grinste Lina und gab dem Hund ein Stück.</blockquote>
<blockquote>„Dann mag ich dich <span class="vocab-word" data-word="wie der Hund">wie der Hund</span>“, antwortete Max.</blockquote>
<p>Lina wurde rot. Sie sah ihn kurz an, dann wieder weg. „Vielleicht mag ich dich auch ein bisschen.“</p>

<p>Später, als die Sonne langsam unterging, <span class="vocab-word" data-word="gingen sie ein Stück durch den Park">gingen sie ein Stück durch den Park</span>. Musik kam von einer Gruppe junger Leute mit Gitarren. Max <span class="vocab-word" data-word="nahm Linas Hand">nahm Linas Hand</span>. Es fühlte sich seltsam und schön an, gleichzeitig leicht und warm.</p>

<blockquote>„<span class="vocab-word" data-word="Weißt du">Weißt du</span>“, sagte Lina, „ich dachte, es wird peinlich. Aber eigentlich ist es <span class="vocab-word" data-word="einfach nett">einfach nett</span>.“</blockquote>
<blockquote>Max grinste. „Dann <span class="vocab-word" data-word="machen wir’s nochmal">machen wir’s nochmal</span>. <span class="vocab-word" data-word="Gleicher Ort, gleiche Kekse">Gleicher Ort, gleiche Kekse</span>?“</blockquote>
<blockquote>„Vielleicht“, sagte Lina. „Aber <span class="vocab-word" data-word="nächstes Mal bring ich den Kaffee">nächstes Mal bring ich den Kaffee</span>.“</blockquote>

<p>Sie lachten, und der Abend roch <span class="vocab-word" data-word="nach Sommer, Zucker und neuen Geschichten">nach Sommer, Zucker und neuen Geschichten</span>.</p>
`,
    "audio": "Yumbambé.mp3",
    "vocab": [ 
          { word: "Lina war nervös", definition: "Lina was nervous." },
          { word: "Blick, der gleichzeitig neugierig und freundlich war", definition: "Look that was both curious and friendly." },
          { word: "nur zu zweit", definition: "only the two of them; just the two together." },
          { word: "nach Gras und Pizza", definition: "smelling like grass and pizza." },
          { word: "selbst gebacken", definition: "homemade; baked by oneself." },
          { word: "Bitte schmecken sie ihm", definition: "Please let him like them (referring to cookies)." },
          { word: "Na, schon lange hier?", definition: "So, have you been here long? (casual greeting)." },
          { word: "Nur ein bisschen", definition: "Just a little." },
          { word: "Total überteuert", definition: "Way too expensive." },
          { word: "doppelt so gut", definition: "twice as good." },
          { word: "verrückten Kunden", definition: "crazy or eccentric customers." },
          { word: "schwieg einer, während der andere einfach in die Sonne blinzelte", definition: "one stayed silent while the other squinted into the sun." },
          { word: "Oh, guck mal", definition: "Hey, look." },
          { word: "wie der Hund", definition: "like the dog (used to compare affection)." },
          { word: "gingen sie ein Stück durch den Park", definition: "they walked a bit through the park." },
          { word: "nahm Linas Hand", definition: "took Lina’s hand." },
          { word: "Weißt du", definition: "You know (used in casual speech)." },
          { word: "einfach nett", definition: "simply nice; pleasantly easygoing." },
          { word: "machen wir’s nochmal", definition: "let’s do it again." },
          { word: "Gleicher Ort, gleiche Kekse", definition: "same place, same cookies." },
          { word: "nächstes Mal bring ich den Kaffee", definition: "next time I’ll bring the coffee." },
          { word: "nach Sommer, Zucker und neuen Geschichten", definition: "smelling like summer, sugar, and new stories." },
     ],
    "isFree": true
  }
]
};
