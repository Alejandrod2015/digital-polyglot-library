"use client";
import { useEffect, useMemo, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { books } from "@/data/books";
import StoryCarousel from "@/components/StoryCarousel";
import ReleaseCarousel from "@/components/ReleaseCarousel";
import BookHorizontalCard from "@/components/BookHorizontalCard";
import StoryVerticalCard from "@/components/StoryVerticalCard";
import { formatLanguage, formatLevel, formatTopic } from "@/lib/displayFormat";
import { getBookCardMeta } from "@/lib/bookCardMeta";
import { canUseOfflineAccess, type Plan } from "@/lib/access";
import {
  listOfflineBooks,
  listOfflineStories,
  removeOfflineBook,
  removeOfflineStory,
  saveOfflineBook,
  saveOfflineStory,
} from "@/lib/offlineLibrary";
import { warmOfflineUrls } from "@/lib/offlineWarm";


type LibraryBook = {
 id: string;
 bookId: string;
 title: string;
 coverUrl: string;
};


type LibraryStory = {
 id: string;
 storyId: string;
 bookId: string;
 title: string;
 coverUrl: string;
 storySlug?: string;
 bookSlug?: string;
 language?: string;
 region?: string;
 level?: string;
 topic?: string;
 audioUrl?: string | null;
};


type BookCarouselItem = {
 slug: string;
 title: string;
 language?: string;
 region?: string;
 level?: string;
 cover?: string;
 description?: string;
 statsLine?: string;
 topicsLine?: string;
 bookId: string;
};


type StoryItem = {
 id: string;
 storyId: string;
 bookSlug: string;
 storySlug: string;
 title: string;
 bookTitle: string;
 language: string;
 region?: string;
 level: string;
 topic?: string;
 coverUrl?: string;
 audioUrl?: string | null;
};
function normalizeMatch(value?: string | null): string {
 return value?.trim().toLowerCase() ?? "";
}


export default function MyLibraryClient() {
 const { user, isLoaded } = useUser();
 const plan: Plan = (user?.publicMetadata?.plan as Plan | undefined) ?? "free";
 const hasOfflineAccess = canUseOfflineAccess(plan);
 const [booksList, setBooksList] = useState<LibraryBook[]>([]);
 const [stories, setStories] = useState<LibraryStory[]>([]);
 const [loading, setLoading] = useState(true);
 const allBooks = useMemo(() => Object.values(books), []);


 // ------------------------------
 // LOAD LIBRARY
 // ------------------------------
 useEffect(() => {
   if (!isLoaded) return;


   const load = async () => {
     if (!user) {
       setBooksList([]);
       setStories([]);
       setLoading(false);
       return;
     }

     const offlineBooks = hasOfflineAccess ? await listOfflineBooks(user.id) : [];
     const offlineStories = hasOfflineAccess ? await listOfflineStories(user.id) : [];

     if (offlineBooks.length > 0) {
       setBooksList(
         offlineBooks.map((item, index) => ({
           id: `offline-book-${item.bookId}-${index}`,
           bookId: item.bookId,
           title: item.title,
           coverUrl: item.coverUrl,
         }))
       );
     }

     if (offlineStories.length > 0) {
       setStories(
         offlineStories.map((item, index) => ({
           id: `offline-story-${item.storyId}-${index}`,
           storyId: item.storyId,
           bookId: item.bookId,
           title: item.title,
           coverUrl: item.coverUrl,
           storySlug: item.storySlug,
           bookSlug: item.bookSlug,
           language: item.language,
           region: item.region,
           level: item.level,
           topic: item.topic,
           audioUrl: item.audioUrl,
         }))
       );
     }


     try {
       const [booksRes, storiesRes] = await Promise.all([
         fetch("/api/library?type=book", { cache: "no-store" }),
         fetch("/api/library?type=story", { cache: "no-store" }),
       ]);


       const rawBooks: unknown = booksRes.ok ? await booksRes.json() : [];
       const rawStories: unknown = storiesRes.ok ? await storiesRes.json() : [];


       if (Array.isArray(rawBooks)) {
         const normalizedBooks = rawBooks.filter(
             (b): b is LibraryBook =>
               typeof b === "object" &&
               b !== null &&
               typeof (b as LibraryBook).id === "string" &&
               typeof (b as LibraryBook).bookId === "string" &&
               typeof (b as LibraryBook).title === "string" &&
               typeof (b as LibraryBook).coverUrl === "string"
           );
         setBooksList(normalizedBooks);
         if (hasOfflineAccess) {
           await Promise.all(
             normalizedBooks.map(async (item) => {
               const bookMeta = allBooks.find((book) => book.id === item.bookId);
               await saveOfflineBook(user.id, {
                 bookId: item.bookId,
                 title: item.title,
                 coverUrl: item.coverUrl,
                 bookData: bookMeta,
               });
               await warmOfflineUrls([
                 bookMeta?.slug ? `/books/${bookMeta.slug}` : null,
                 bookMeta?.slug ? `/books/${bookMeta.slug}?from=my-library` : null,
                 item.coverUrl,
                 ...(bookMeta?.stories.flatMap((story) => [
                   story.slug ? `/books/${bookMeta.slug}/${story.slug}` : null,
                   story.slug
                     ? `/books/${bookMeta.slug}/${story.slug}?returnTo=/my-library&returnLabel=My%20Library&from=my-library`
                     : null,
                   story.slug ? `/stories/${story.slug}` : null,
                   story.slug
                     ? `/stories/${story.slug}?returnTo=/my-library&returnLabel=My%20Library&from=my-library`
                     : null,
                   typeof story.cover === "string" ? story.cover : null,
                   typeof story.audio === "string" ? story.audio : null,
                 ]) ?? []),
               ]);
             })
           );
         }
       }


       if (Array.isArray(rawStories)) {
         const normalizedStories = rawStories.filter(
             (s): s is LibraryStory =>
               typeof s === "object" &&
               s !== null &&
               typeof (s as LibraryStory).id === "string" &&
               typeof (s as LibraryStory).storyId === "string" &&
               typeof (s as LibraryStory).bookId === "string" &&
               typeof (s as LibraryStory).title === "string" &&
               typeof (s as LibraryStory).coverUrl === "string"
           );
         setStories(normalizedStories);
         if (hasOfflineAccess) {
           await Promise.all(
             normalizedStories.map(async (item) => {
                const bookMeta = allBooks.find((book) => book.id === item.bookId);
                const storyMeta = bookMeta?.stories.find((story) => story.id === item.storyId);
                await saveOfflineStory(user.id, {
                 storyId: item.storyId,
                 bookId: item.bookId,
                 title: item.title,
                 coverUrl: item.coverUrl,
                 storySlug: item.storySlug ?? storyMeta?.slug,
                 bookSlug: bookMeta?.slug,
                 language: item.language ?? storyMeta?.language ?? bookMeta?.language,
                 region: item.region ?? storyMeta?.region ?? bookMeta?.region,
                 level: item.level ?? storyMeta?.level ?? bookMeta?.level,
                 topic:
                   item.topic ??
                   storyMeta?.topic ??
                   (typeof bookMeta?.topic === "string" ? bookMeta.topic : undefined),
                 audioUrl:
                   item.audioUrl ??
                   (typeof storyMeta?.audio === "string" ? storyMeta.audio : null),
                 storyData: storyMeta,
               });
               const bookSlug = item.bookSlug ?? bookMeta?.slug;
               const storySlug = item.storySlug ?? storyMeta?.slug;
               await warmOfflineUrls([
                 bookSlug && storySlug ? `/books/${bookSlug}/${storySlug}` : null,
                 bookSlug && storySlug
                   ? `/books/${bookSlug}/${storySlug}?returnTo=/my-library&returnLabel=My%20Library&from=my-library`
                   : null,
                 storySlug ? `/stories/${storySlug}` : null,
                 storySlug
                   ? `/stories/${storySlug}?returnTo=/my-library&returnLabel=My%20Library&from=my-library`
                   : null,
                 item.coverUrl,
                 item.audioUrl ??
                   (typeof storyMeta?.audio === "string" ? storyMeta.audio : null),
               ]);
             })
           );
         }
       }
     } catch {
       if (offlineBooks.length === 0) setBooksList([]);
       if (offlineStories.length === 0) setStories([]);
     } finally {
       setTimeout(() => setLoading(false), 150);
     }
   };


   void load();
 }, [user, isLoaded, allBooks, hasOfflineAccess]);


 // ------------------------------
 // REMOVE ITEM
 // ------------------------------
 const removeItem = async (type: "books" | "stories", id: string) => {
   if (type === "books") {
     setBooksList((prev) => prev.filter((b) => b.bookId !== id));
     if (user?.id) {
       await removeOfflineBook(user.id, id);
     }
     await fetch("/api/library", {
       method: "DELETE",
       headers: { "Content-Type": "application/json" },
       body: JSON.stringify({ type: "book", bookId: id }),
     });
   } else {
     setStories((prev) => prev.filter((s) => s.storyId !== id));
     if (user?.id) {
       await removeOfflineStory(user.id, id);
     }
     await fetch("/api/library", {
       method: "DELETE",
       headers: { "Content-Type": "application/json" },
       body: JSON.stringify({ type: "story", storyId: id }),
     });
   }
 };
 const targetLanguages = useMemo(
   () =>
     Array.isArray(user?.publicMetadata?.targetLanguages)
       ? (user?.publicMetadata?.targetLanguages as unknown[])
           .filter((value): value is string => typeof value === "string")
           .map((value) => normalizeMatch(value))
       : [],
   [user]
 );


 // ------------------------------
 // MAP BOOKS → CAROUSEL ITEMS
 // ------------------------------
 const bookCarouselItems = useMemo<BookCarouselItem[]>(() => {
   const arr: BookCarouselItem[] = [];


   for (const item of booksList) {
     const meta = allBooks.find((b) => b.id === item.bookId);
     if (!meta) continue;


     arr.push({
       slug: meta.slug,
       title: meta.title,
       language:
         typeof meta.language === "string" ? formatLanguage(meta.language) : undefined,
       region: typeof meta.region === "string" ? meta.region : undefined,
       level:
         typeof meta.level === "string" ? formatLevel(meta.level) : undefined,
       cover: meta.cover,
       description: typeof meta.description === "string" ? meta.description : undefined,
       statsLine: getBookCardMeta(meta).statsLine,
       topicsLine: getBookCardMeta(meta).topicsLine,
       bookId: item.bookId,
     });
   }


   return arr;
 }, [booksList, allBooks]);


 // ------------------------------
 // MAP STORIES
 // ------------------------------
 const storyItems = useMemo<StoryItem[]>(() => {
   const arr: StoryItem[] = [];


   for (const item of stories) {
     const bookMeta = allBooks.find((b) => b.id === item.bookId);
     if (!bookMeta) {
       if ((item.bookId !== "polyglot" && item.bookId !== "standalone") || !item.storySlug) continue;
       arr.push({
         id: item.id,
         storyId: item.storyId,
         bookSlug: item.bookId,
         storySlug: item.storySlug,
         title: item.title,
         bookTitle: item.bookId === "standalone" ? "Individual Stories" : "Polyglot Stories",
         language: formatLanguage(item.language),
         region: item.region,
         level: formatLevel(item.level),
         topic: item.topic,
         coverUrl:
           typeof item.coverUrl === "string" && item.coverUrl.trim() !== ""
             ? item.coverUrl
             : "/covers/default.jpg",
         audioUrl: item.audioUrl ?? null,
       });
       continue;
     }


     const storyMeta = bookMeta.stories.find((s) => s.id === item.storyId);
     if (!storyMeta) continue;


     const storyCover =
       typeof storyMeta.cover === "string" && storyMeta.cover.trim() !== ""
         ? storyMeta.cover
         : undefined;


     const savedCover =
       typeof item.coverUrl === "string" && item.coverUrl.trim() !== ""
         ? item.coverUrl
         : undefined;


     const bookCover =
       typeof bookMeta.cover === "string" && bookMeta.cover.trim() !== ""
         ? bookMeta.cover
         : "/covers/default.jpg";


     arr.push({
       id: item.id,
       storyId: item.storyId,
       bookSlug: bookMeta.slug,
       storySlug: storyMeta.slug,
       title: item.title || storyMeta.title,
       bookTitle: bookMeta.title,
       language:
         typeof storyMeta.language === "string"
           ? formatLanguage(storyMeta.language)
           : formatLanguage(bookMeta.language),
       region:
         typeof storyMeta.region === "string" && storyMeta.region.trim() !== ""
           ? storyMeta.region
           : bookMeta.region,
       level:
         typeof storyMeta.level === "string"
           ? formatLevel(storyMeta.level)
           : formatLevel(bookMeta.level),
       topic:
         typeof storyMeta.topic === "string"
           ? storyMeta.topic
           : typeof bookMeta.topic === "string"
             ? bookMeta.topic
             : undefined,
       coverUrl: storyCover ?? savedCover ?? bookCover,
       audioUrl: typeof storyMeta.audio === "string" ? storyMeta.audio : null,
     });
   }


   return arr;
 }, [stories, allBooks]);

 const suggestedBooks = useMemo<BookCarouselItem[]>(() => {
   const savedBookIds = new Set(booksList.map((item) => item.bookId));

   return allBooks
     .map((bookMeta) => {
       const languageScore = targetLanguages.includes(normalizeMatch(bookMeta.language)) ? 2 : 0;
       return {
         item: {
           slug: bookMeta.slug,
           title: bookMeta.title,
           language:
             typeof bookMeta.language === "string" ? formatLanguage(bookMeta.language) : undefined,
           region: typeof bookMeta.region === "string" ? bookMeta.region : undefined,
           level: typeof bookMeta.level === "string" ? formatLevel(bookMeta.level) : undefined,
           cover: bookMeta.cover,
           description:
             typeof bookMeta.description === "string" ? bookMeta.description : undefined,
           statsLine: getBookCardMeta(bookMeta).statsLine,
           topicsLine: getBookCardMeta(bookMeta).topicsLine,
           bookId: bookMeta.id,
         },
         score: languageScore,
       };
     })
     .filter(({ item }) => !savedBookIds.has(item.bookId))
     .sort((a, b) => b.score - a.score)
     .slice(0, 4)
     .map(({ item }) => item);
 }, [allBooks, booksList, targetLanguages]);

 const suggestedStories = useMemo<StoryItem[]>(() => {
   const savedStoryIds = new Set(stories.map((item) => item.storyId));

   return allBooks
     .flatMap((bookMeta) =>
       bookMeta.stories.map((storyMeta) => {
         const languageValue =
           typeof storyMeta.language === "string" ? storyMeta.language : bookMeta.language;
         const languageScore = targetLanguages.includes(normalizeMatch(languageValue)) ? 2 : 0;
         return {
           item: {
             id: `${bookMeta.id}:${storyMeta.id}`,
             storyId: storyMeta.id,
             bookSlug: bookMeta.slug,
             storySlug: storyMeta.slug,
             title: storyMeta.title,
             bookTitle: bookMeta.title,
             language: formatLanguage(languageValue),
             region:
               typeof storyMeta.region === "string" && storyMeta.region.trim() !== ""
                 ? storyMeta.region
                 : bookMeta.region,
             level: formatLevel(
               typeof storyMeta.level === "string" ? storyMeta.level : bookMeta.level
             ),
             topic:
               typeof storyMeta.topic === "string"
                 ? storyMeta.topic
                 : typeof bookMeta.topic === "string"
                   ? bookMeta.topic
                   : undefined,
             coverUrl:
               typeof storyMeta.cover === "string" && storyMeta.cover.trim() !== ""
                 ? storyMeta.cover
                 : typeof bookMeta.cover === "string" && bookMeta.cover.trim() !== ""
                   ? bookMeta.cover
                   : "/covers/default.jpg",
             audioUrl: typeof storyMeta.audio === "string" ? storyMeta.audio : null,
           },
           score: languageScore,
         };
       })
     )
     .filter(({ item }) => !savedStoryIds.has(item.storyId))
     .sort((a, b) => b.score - a.score)
     .slice(0, 8)
     .map(({ item }) => item);
 }, [allBooks, stories, targetLanguages]);

 // ------------------------------
 // UI
 // ------------------------------
 return (
   <div className="w-full mx-auto px-3 sm:px-4 lg:px-6 py-8 text-[var(--foreground)]">
     <h1 className="text-3xl font-bold mb-6">My Library</h1>


     {/* SKELETON */}
     {loading && (
       <div className="space-y-6">
         <div className="h-8 w-44 rounded bg-[var(--card-bg)] animate-pulse" />
         <div className="flex gap-4 overflow-x-auto pb-2">
           {Array.from({ length: 4 }).map((_, i) => (
             <div
               key={`library-skeleton-${i}`}
               className="min-w-[240px] max-w-[320px] w-[72vw] sm:w-[42vw] md:w-[280px] rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-3 animate-pulse"
             >
               <div className="aspect-[3/4] w-full rounded-xl bg-[var(--card-bg-hover)] mb-3" />
               <div className="h-5 w-4/5 rounded bg-[var(--card-bg-hover)] mb-2" />
               <div className="h-4 w-2/3 rounded bg-[var(--card-bg-hover)] mb-3" />
               <div className="h-4 w-full rounded bg-[var(--card-bg-hover)] mb-2" />
               <div className="h-4 w-5/6 rounded bg-[var(--card-bg-hover)] mb-3" />
               <div className="h-9 w-full rounded-lg bg-[var(--card-bg-hover)]" />
             </div>
           ))}
         </div>
       </div>
     )}


     {/* CONTENT */}
     {!loading && (
       <>
         {/* BOOKS */}
         <section className="mb-10 md:mb-12">
           <h2 className="text-2xl font-semibold mb-6 text-[var(--foreground)]">
             Saved Books
           </h2>


           {bookCarouselItems.length === 0 ? (
             <div className="space-y-5">
               <p className="text-[var(--muted)]">You haven’t saved any books yet.</p>
               {suggestedBooks.length > 0 ? (
                 <div>
                   <p className="mb-3 text-sm font-medium text-[var(--foreground)]/90">
                     Suggested books
                   </p>
                   <div className="md:hidden">
                     <StoryCarousel
                       items={suggestedBooks}
                       mobileItemClassName="w-[82%] sm:w-[62%]"
                       renderItem={(book) => (
                         <BookHorizontalCard
                           href={`/books/${book.slug}?from=my-library`}
                           title={book.title}
                           cover={book.cover}
                           level={book.level}
                           language={book.language}
                           region={book.region}
                           statsLine={book.statsLine}
                           topicsLine={book.topicsLine}
                           description={book.description}
                         />
                       )}
                     />
                   </div>
                   <div className="hidden md:block">
                     <ReleaseCarousel
                       items={suggestedBooks}
                       itemClassName="md:flex-[0_0_46%] lg:flex-[0_0_46%] xl:flex-[0_0_46%]"
                       renderItem={(book) => (
                         <BookHorizontalCard
                           href={`/books/${book.slug}?from=my-library`}
                           title={book.title}
                           cover={book.cover}
                           level={book.level}
                           language={book.language}
                           region={book.region}
                           statsLine={book.statsLine}
                           topicsLine={book.topicsLine}
                           description={book.description}
                         />
                       )}
                     />
                   </div>
                 </div>
               ) : null}
             </div>
           ) : (
             <>
               <div className="md:hidden">
                 <StoryCarousel
                   items={bookCarouselItems}
                   mobileItemClassName="w-[82%] sm:w-[62%]"
                   renderItem={(book) => (
                     <BookHorizontalCard
                       href={`/books/${book.slug}?from=my-library`}
                       title={book.title}
                       cover={book.cover}
                       level={book.level}
                       language={book.language}
                       region={book.region}
                       statsLine={book.statsLine}
                       topicsLine={book.topicsLine}
                       description={book.description}
                       footer={
                         <button
                           type="button"
                           onClick={() => removeItem("books", book.bookId)}
                           className="w-full flex items-center justify-center gap-2 text-[var(--muted)] hover:text-red-500 transition-colors text-sm font-medium"
                         >
                           Remove
                         </button>
                       }
                     />
                   )}
                 />
               </div>

               <div className="hidden md:block">
                 <ReleaseCarousel
                   items={bookCarouselItems}
                   itemClassName="md:flex-[0_0_46%] lg:flex-[0_0_46%] xl:flex-[0_0_46%]"
                   renderItem={(book) => (
                     <BookHorizontalCard
                       href={`/books/${book.slug}?from=my-library`}
                       title={book.title}
                       cover={book.cover}
                       level={book.level}
                       language={book.language}
                       region={book.region}
                       statsLine={book.statsLine}
                       topicsLine={book.topicsLine}
                       description={book.description}
                       footer={
                         <button
                           type="button"
                           onClick={() => removeItem("books", book.bookId)}
                           className="w-full flex items-center justify-center gap-2 text-[var(--muted)] hover:text-red-500 transition-colors text-sm font-medium"
                         >
                           Remove
                         </button>
                       }
                     />
                   )}
                 />
               </div>
             </>
           )}
         </section>


         {/* STORIES */}
         <section className="mb-10 md:mb-12">
           <h2 className="text-2xl font-semibold mb-6 text-[var(--foreground)]">
             Saved Stories
           </h2>


           {storyItems.length === 0 ? (
             <div className="space-y-5">
               <p className="text-[var(--muted)]">
                 You haven’t saved any stories yet.
               </p>
               {suggestedStories.length > 0 ? (
                 <div>
                   <p className="mb-3 text-sm font-medium text-[var(--foreground)]/90">
                     Suggested stories
                   </p>
                   <StoryCarousel<StoryItem>
                     items={suggestedStories}
                     renderItem={(story) => (
                       <StoryVerticalCard
                         href={`/books/${story.bookSlug}/${story.storySlug}?returnTo=/my-library&returnLabel=My%20Library&from=my-library`}
                         title={story.title}
                         coverUrl={story.coverUrl || "/covers/default.png"}
                         subtitle={story.bookTitle}
                         level={story.level}
                         language={story.language}
                         region={story.region}
                         metaSecondary={formatTopic(story.topic)}
                       />
                     )}
                   />
                 </div>
               ) : null}
             </div>
           ) : (
               <StoryCarousel<StoryItem>
               items={storyItems}
               renderItem={(story) => (
                 <StoryVerticalCard
                   href={
                     story.bookSlug === "polyglot" || story.bookSlug === "standalone"
                       ? `/stories/${story.storySlug}?returnTo=/my-library&returnLabel=My%20Library&from=my-library`
                       : `/books/${story.bookSlug}/${story.storySlug}?returnTo=/my-library&returnLabel=My%20Library&from=my-library`
                   }
                   title={story.title}
                   coverUrl={story.coverUrl || "/covers/default.png"}
                   subtitle={story.bookTitle}
                   level={story.level}
                   language={story.language}
                   region={story.region}
                   metaSecondary={formatTopic(story.topic)}
                   footer={
                     <button
                       type="button"
                       onClick={() => removeItem("stories", story.storyId)}
                       className="w-full flex items-center justify-center gap-2 text-[var(--muted)] hover:text-red-500 transition-colors text-sm font-medium"
                     >
                       Remove
                     </button>
                   }
                 />
               )}
             />
           )}
         </section>
       </>
     )}
   </div>
 );
}
