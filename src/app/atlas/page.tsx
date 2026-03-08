import AtlasClient, { type AtlasZone } from "./AtlasClient";
import { books } from "@/data/books";
import type { Book } from "@/types/books";

export const metadata = {
  title: "Atlas | Digital Polyglot",
  description: "Explore language through regions, voices, and real cultural contexts.",
};

function stripHtml(input?: string) {
  return (input ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function excerpt(text?: string, max = 150) {
  const clean = stripHtml(text);
  if (!clean) return "";
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max).trimEnd()}...`;
}

function topicLine(book: Book) {
  const theme = Array.isArray(book.theme) ? book.theme : book.theme ? [book.theme] : [];
  return theme.slice(0, 3).join(" • ");
}

function buildZone(
  book: Book,
  config: Pick<AtlasZone, "id" | "label" | "country" | "register" | "focus" | "description" | "x" | "y" | "accents">
) {
  const stories = book.stories.slice(0, 4).map((story) => ({
    id: story.id,
    title: story.title,
    href: `/books/${book.slug}/${story.slug}`,
    coverUrl: story.cover ?? book.cover,
    subtitle: book.title,
    excerpt: excerpt(story.text, 150),
    level: story.level ?? book.level,
    language: story.language ?? book.language,
    region: story.region ?? book.region,
    meta: story.topic ?? book.topic ?? undefined,
    metaSecondary: `${config.country} · ${config.register}`,
  }));

  const contexts = Array.from(
    new Set(
      [book.topic, ...book.stories.map((story) => story.topic), ...(Array.isArray(book.theme) ? book.theme : book.theme ? [book.theme] : [])].filter(
        (value): value is string => typeof value === "string" && value.trim().length > 0
      )
    )
  ).slice(0, 4);

  return {
    ...config,
    language: book.language.charAt(0).toUpperCase() + book.language.slice(1),
    region: book.region ?? config.country,
    contexts,
    collection: {
      title: book.title,
      href: `/books/${book.slug}`,
      cover: book.cover,
      language: book.language,
      region: book.region,
      level: book.level,
      description: book.description,
      meta: config.focus,
      statsLine: `${book.stories.length} stories`,
      topicsLine: topicLine(book),
    },
    stories,
  } satisfies AtlasZone;
}

export default function AtlasPage() {
  const allBooks = Object.values(books);
  const beginnerColombia = allBooks.find((book) => book.slug === "colombian-spanish-stories-for-beginners");
  const communityColombia = allBooks.find((book) => book.slug === "short-stories-in-colombian-spanish");
  const mexico = allBooks.find((book) => book.slug === "spanish-short-stories-on-20-mexican-wonders");
  const germany = allBooks.find((book) => book.slug === "colloquial-german-stories");

  const zones = [
    beginnerColombia
      ? buildZone(beginnerColombia, {
          id: "colombia-beginner",
          label: "Colombia for beginners",
          country: "Colombia",
          register: "Neutral everyday Spanish",
          focus: "Markets, travel, traditions, and accessible real-life dialogue.",
          description:
            "This zone is a softer entry into Colombian Spanish. The stories stay readable, but the language still belongs to real places, real habits, and real social situations.",
          x: 27,
          y: 52,
          accents: ["Medellín", "Bogotá", "Guatavita"],
        })
      : null,
    communityColombia
      ? buildZone(communityColombia, {
          id: "colombia-community",
          label: "Colombian community voices",
          country: "Colombia",
          register: "Informal regional Spanish",
          focus: "Community life, work, family, and colloquial local rhythm.",
          description:
            "This region leans further into lived Colombian speech. The stories carry stronger local texture, more social context, and a clearer sense of how language changes across daily life.",
          x: 31,
          y: 59,
          accents: ["Popayán", "Valle del Cauca", "La Guajira"],
        })
      : null,
    mexico
      ? buildZone(mexico, {
          id: "mexico-culture",
          label: "Mexico cultural routes",
          country: "Mexico",
          register: "Neutral to expressive Mexican Spanish",
          focus: "Food, history, family, and place-based cultural identity.",
          description:
            "This atlas zone treats Mexican Spanish as something rooted in food, celebration, memory, and geography. The point is not only to follow dialogue, but to understand what the dialogue belongs to.",
          x: 18,
          y: 42,
          accents: ["CDMX", "Puebla", "Oaxaca"],
        })
      : null,
    germany
      ? buildZone(germany, {
          id: "germany-colloquial",
          label: "German city voices",
          country: "Germany",
          register: "Colloquial urban German",
          focus: "Transit, cafes, modern relationships, and real conversational rhythm.",
          description:
            "This is not textbook German. It is designed around city life, everyday friction, and the cadence of informal speech that learners need if they want to understand people outside scripted classroom dialogue.",
          x: 76,
          y: 26,
          accents: ["Berlin", "Urban colloquial", "Everyday speech"],
        })
      : null,
  ].filter(Boolean) as AtlasZone[];

  return <AtlasClient zones={zones} />;
}
