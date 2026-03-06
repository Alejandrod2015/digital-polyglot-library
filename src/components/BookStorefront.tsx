"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Play, ShoppingBag, Star } from "lucide-react";
import Cover from "@/components/Cover";
import AddToLibraryButton from "@/components/AddToLibraryButton";
import BookStoriesGrid from "@/components/BookStoriesGrid";
import BookHorizontalCard from "@/components/BookHorizontalCard";
import ReleaseCarousel from "@/components/ReleaseCarousel";
import StoryCarousel from "@/components/StoryCarousel";
import StoryVerticalCard from "@/components/StoryVerticalCard";
import { type Book, type Story } from "@/types/books";
import { formatLanguage, formatLevel, formatTopic, toTitleCase } from "@/lib/displayFormat";

type TabKey = "stories" | "vocab" | "reviews" | "about";
type SortKey = "recommended" | "shortest" | "longest" | "title";

type Props = {
  book: Book;
  storyNavSuffix: string;
  replaceStoryNavigation?: boolean;
};

function stripHtml(input: string): string {
  return input.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function estimateReadMinutes(text: string): number {
  const words = stripHtml(text).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 180));
}

function toExternalUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function getStoryTopic(story: Story, book: Book): string {
  const raw = story.topic ?? book.topic ?? "General";
  return formatTopic(raw);
}

function normalizeMatch(value?: string): string {
  return (value ?? "").trim().toLowerCase();
}

export default function BookStorefront({
  book,
  storyNavSuffix,
  replaceStoryNavigation = false,
}: Props) {
  const [tab, setTab] = useState<TabKey>("stories");
  const [query, setQuery] = useState("");
  const [topicFilter, setTopicFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("recommended");
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const firstStoryHref = book.stories[0]?.slug
    ? `/books/${book.slug}/${book.stories[0].slug}${storyNavSuffix}`
    : null;
  const cleanDescription = (book.description ?? "").trim();
  const DESCRIPTION_LIMIT = 230;
  const shouldShowDescriptionToggle = cleanDescription.length > DESCRIPTION_LIMIT;
  const visibleDescription =
    shouldShowDescriptionToggle && !descriptionExpanded
      ? `${cleanDescription.slice(0, DESCRIPTION_LIMIT).trimEnd()}...`
      : cleanDescription;

  const topics = useMemo(() => {
    const set = new Set<string>();
    for (const story of book.stories) {
      set.add(getStoryTopic(story, book));
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [book]);

  const filteredStories = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = book.stories.filter((story) => {
      const matchesQuery =
        q.length === 0 ||
        story.title.toLowerCase().includes(q) ||
        stripHtml(story.text).toLowerCase().includes(q);
      const matchesTopic =
        topicFilter === "all" || getStoryTopic(story, book).toLowerCase() === topicFilter;
      return matchesQuery && matchesTopic;
    });

    const withIndex = base.map((story, index) => ({ story, index }));
    withIndex.sort((a, b) => {
      if (sortKey === "title") return a.story.title.localeCompare(b.story.title);
      if (sortKey === "shortest") return estimateReadMinutes(a.story.text) - estimateReadMinutes(b.story.text);
      if (sortKey === "longest") return estimateReadMinutes(b.story.text) - estimateReadMinutes(a.story.text);
      return a.index - b.index;
    });

    return withIndex.map((row) => row.story);
  }, [book, query, sortKey, topicFilter]);

  const vocabList = useMemo(() => {
    const map = new Map<string, { word: string; count: number; definition: string }>();
    for (const story of book.stories) {
      for (const item of story.vocab ?? []) {
        const key = item.word.trim().toLowerCase();
        if (!key) continue;
        const prev = map.get(key);
        if (prev) {
          prev.count += 1;
          if (!prev.definition && item.definition) prev.definition = item.definition;
        } else {
          map.set(key, { word: item.word, count: 1, definition: item.definition ?? "" });
        }
      }
    }
    return Array.from(map.values())
      .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word))
      .slice(0, 40);
  }, [book]);

  const relatedBooks = useMemo<BookCarouselItem[]>(() => {
    const currentLanguage = normalizeMatch(book.language);
    const currentLevel = normalizeMatch(book.level);
    const currentRegion = normalizeMatch(book.region);
    const currentTopic = normalizeMatch(formatTopic(book.topic));

    return allBooks
      .filter((candidate) => candidate.slug !== book.slug)
      .map((candidate) => {
        let score = 0;
        if (normalizeMatch(candidate.language) === currentLanguage) score += 4;
        if (normalizeMatch(candidate.level) === currentLevel) score += 2;
        if (normalizeMatch(candidate.region) === currentRegion && currentRegion) score += 1;
        if (normalizeMatch(formatTopic(candidate.topic)) === currentTopic && currentTopic) score += 3;

        return {
          score,
          item: {
            slug: candidate.slug,
            title: candidate.title,
            language:
              typeof candidate.language === "string" ? formatLanguage(candidate.language) : undefined,
            region: typeof candidate.region === "string" ? candidate.region : undefined,
            level:
              typeof candidate.level === "string" ? formatLevel(candidate.level) : undefined,
            cover: candidate.cover,
            description:
              typeof candidate.description === "string" ? candidate.description : undefined,
            statsLine: getBookCardMeta(candidate).statsLine,
            topicsLine: getBookCardMeta(candidate).topicsLine,
            bookId: candidate.id,
          },
        };
      })
      .filter((entry) => entry.score >= 4)
      .sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title))
      .slice(0, 4)
      .map((entry) => entry.item);
  }, [book]);

  const suggestedStories = useMemo(() => {
    const currentLanguage = normalizeMatch(book.language);
    const currentLevel = normalizeMatch(book.level);
    const currentTopic = normalizeMatch(formatTopic(book.topic));

    return allBooks
      .filter((candidate) => candidate.slug !== book.slug)
      .flatMap((candidate) =>
        candidate.stories.map((story) => {
          let score = 0;
          const storyLanguage = normalizeMatch(story.language ?? candidate.language);
          const storyLevel = normalizeMatch(story.level ?? candidate.level);
          const storyTopic = normalizeMatch(formatTopic(story.topic ?? candidate.topic));

          if (storyLanguage === currentLanguage) score += 4;
          if (storyLevel === currentLevel) score += 2;
          if (storyTopic === currentTopic && currentTopic) score += 3;

          return {
            score,
            story,
            candidate,
          };
        })
      )
      .filter((entry) => entry.score >= 5)
      .sort((a, b) => b.score - a.score || a.story.title.localeCompare(b.story.title))
      .slice(0, 6);
  }, [book]);

  const tabs: Array<{ key: TabKey; label: string }> = [
    { key: "stories", label: "Stories" },
    { key: "vocab", label: "Vocab" },
    { key: "reviews", label: "Reviews" },
    { key: "about", label: "About" },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 pb-24 md:pb-8">
      <section className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6">
        <div className="mx-auto lg:mx-0 w-[180px] sm:w-[220px] aspect-[2/3]">
          <Cover src={book.cover} alt={`Cover of ${book.title}`} />
        </div>

        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-white leading-tight">{book.title}</h1>
          {book.subtitle ? <p className="mt-2 text-lg text-gray-200">{book.subtitle}</p> : null}
          <p className="mt-3 text-base md:text-lg text-gray-200 leading-relaxed">{visibleDescription}</p>
          {shouldShowDescriptionToggle ? (
            <button
              type="button"
              onClick={() => setDescriptionExpanded((prev) => !prev)}
              className="mt-1 text-sm font-medium text-white/85 hover:text-white"
            >
              {descriptionExpanded ? "Read less" : "Read more"}
            </button>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-gray-700/80 text-gray-100 text-xs">{formatLanguage(book.language)}</span>
            <span className="px-2.5 py-0.5 rounded-full bg-gray-700/80 text-gray-100 text-xs">{formatLevel(book.level)}</span>
            {book.region ? (
              <span className="px-2.5 py-0.5 rounded-full bg-gray-700/80 text-gray-100 text-xs">
                {toTitleCase(book.region)}
              </span>
            ) : null}
            {book.topic ? (
              <span className="px-2.5 py-0.5 rounded-full bg-gray-700/80 text-gray-100 text-xs">
                {formatTopic(book.topic)}
              </span>
            ) : null}
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="text-xs text-gray-400">Stories</p>
              <p className="text-lg font-semibold text-white">{book.stories.length}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="text-xs text-gray-400">Avg length</p>
              <p className="text-lg font-semibold text-white">
                {Math.max(
                  1,
                  Math.round(
                    book.stories.reduce((acc, s) => acc + estimateReadMinutes(s.text ?? ""), 0) /
                      Math.max(1, book.stories.length)
                  )
                )}m
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="text-xs text-gray-400">Learner score</p>
              <p className="text-lg font-semibold text-white inline-flex items-center gap-1">
                <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                4.8
              </p>
            </div>
          </div>

          <div className="mt-5 hidden md:flex flex-wrap gap-3">
            {firstStoryHref ? (
              <Link
                href={firstStoryHref}
                replace={replaceStoryNavigation}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors"
              >
                <Play className="h-5 w-5" />
                Start reading
              </Link>
            ) : (
              <button
                disabled
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl font-medium bg-gray-700 text-gray-300 cursor-not-allowed"
              >
                <Play className="h-5 w-5" />
                No stories yet
              </button>
            )}
            <AddToLibraryButton
              bookId={book.slug}
              title={book.title}
              coverUrl={
                typeof book.cover === "string" && book.cover.length > 0 ? book.cover : "/covers/default.jpg"
              }
            />
            {book.storeUrl ? (
              <a
                href={toExternalUrl(book.storeUrl)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl font-medium bg-amber-500 hover:bg-amber-600 text-white transition-colors"
              >
                <ShoppingBag className="h-5 w-5" />
                Buy physical book
              </a>
            ) : null}
          </div>
        </div>
      </section>

      <section className="mt-6">
        <div className="flex flex-wrap gap-2 border-b border-white/10 pb-3">
          {tabs.map((item) => (
            <button
              key={item.key}
              onClick={() => setTab(item.key)}
              className={`rounded-full px-3 py-1.5 text-sm transition ${
                tab === item.key
                  ? "bg-blue-600 text-white"
                  : "bg-white/5 text-gray-200 hover:bg-white/10"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {tab === "stories" ? (
          <div className="mt-4 space-y-4">
            <div className="grid gap-3 md:grid-cols-[1fr_220px_220px]">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search a story"
                className="h-10 rounded-lg border border-white/15 bg-white/5 px-3 text-sm text-white placeholder:text-gray-400"
              />
              <select
                value={topicFilter}
                onChange={(e) => setTopicFilter(e.target.value)}
                className="h-10 rounded-lg border border-white/15 bg-[#0f1728] px-3 text-sm text-white"
              >
                <option value="all">All topics</option>
                {topics.map((topic) => (
                  <option key={topic} value={topic.toLowerCase()}>
                    {topic}
                  </option>
                ))}
              </select>
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
                className="h-10 rounded-lg border border-white/15 bg-[#0f1728] px-3 text-sm text-white"
              >
                <option value="recommended">Sort: Recommended</option>
                <option value="shortest">Sort: Shortest</option>
                <option value="longest">Sort: Longest</option>
                <option value="title">Sort: A-Z</option>
              </select>
            </div>

            <p className="text-xs text-gray-400">
              Showing {filteredStories.length} of {book.stories.length} stories
            </p>

            <BookStoriesGrid
              book={book}
              stories={filteredStories}
              hrefSuffix={storyNavSuffix}
              replaceNavigation={replaceStoryNavigation}
              dense
            />
          </div>
        ) : null}

        {tab === "vocab" ? (
          <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
            <h3 className="text-lg font-semibold text-white">Top vocabulary in this book</h3>
            <p className="text-sm text-gray-400 mt-1">High-frequency words for quick practice.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {vocabList.map((item) => (
                <span key={item.word} className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-sm text-gray-100">
                  {item.word}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {tab === "reviews" ? (
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-sm text-gray-300">“Perfect length for daily practice.”</p>
              <p className="mt-2 text-xs text-gray-500">Intermediate learner</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-sm text-gray-300">“Great vocabulary and natural dialogues.”</p>
              <p className="mt-2 text-xs text-gray-500">Spanish learner</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-sm text-gray-300">“Easy to binge 3-4 stories in one session.”</p>
              <p className="mt-2 text-xs text-gray-500">Polyglot reader</p>
            </div>
          </div>
        ) : null}

        {tab === "about" ? (
          <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
            <h3 className="text-lg font-semibold text-white">About this book</h3>
            <p className="mt-2 text-sm text-gray-300">{book.description}</p>
          </div>
        ) : null}
      </section>

      {tab === "stories" && (relatedBooks.length > 0 || suggestedStories.length > 0) ? (
        <section className="mt-8 space-y-8">
          {suggestedStories.length > 0 ? (
            <div>
              <div className="mb-4">
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--primary)] mb-2">
                  Suggested Stories
                </p>
                <h3 className="text-2xl font-semibold text-[var(--foreground)]">
                  More stories in your lane
                </h3>
              </div>
              <StoryCarousel
                items={suggestedStories}
                renderItem={({ story, candidate }) => (
                  <StoryVerticalCard
                    href={`/books/${candidate.slug}/${story.slug}${storyNavSuffix}`}
                    title={story.title}
                    coverUrl={story.cover ?? candidate.cover ?? "/covers/default.jpg"}
                    subtitle={candidate.title}
                    level={formatLevel(story.level ?? candidate.level)}
                    language={formatLanguage(story.language ?? candidate.language)}
                    region={story.region ?? candidate.region}
                    metaSecondary={formatTopic(story.topic ?? candidate.topic)}
                  />
                )}
              />
            </div>
          ) : null}

          {relatedBooks.length > 0 ? (
            <div>
              <div className="mb-4">
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--primary)] mb-2">
                  Suggested Books
                </p>
                <h3 className="text-2xl font-semibold text-[var(--foreground)]">
                  Similar books to explore next
                </h3>
              </div>
              <ReleaseCarousel
                items={relatedBooks}
                itemClassName="md:flex-[0_0_46%] lg:flex-[0_0_46%] xl:flex-[0_0_46%]"
                renderItem={(relatedBook) => (
                  <BookHorizontalCard
                    href={`/books/${relatedBook.slug}`}
                    title={relatedBook.title}
                    cover={relatedBook.cover}
                    level={relatedBook.level}
                    language={relatedBook.language}
                    region={relatedBook.region}
                    statsLine={relatedBook.statsLine}
                    topicsLine={relatedBook.topicsLine}
                    description={relatedBook.description}
                  />
                )}
              />
            </div>
          ) : null}
        </section>
      ) : null}

      {firstStoryHref ? (
        <div className="fixed md:hidden inset-x-0 bottom-0 z-30 border-t border-white/10 bg-[#0b1325]/95 backdrop-blur p-3">
          <Link
            href={firstStoryHref}
            replace={replaceStoryNavigation}
            className="w-full inline-flex justify-center items-center gap-2 px-4 py-3 rounded-xl font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors"
          >
            <Play className="h-5 w-5" />
            Start reading
          </Link>
        </div>
      ) : null}
    </div>
  );
}
