"use client";


import { useEffect, useMemo, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { books } from "@/data/books";
import Skeleton from "@/components/Skeleton";
import StoryCarousel from "@/components/StoryCarousel";
import ReleaseCarousel from "@/components/ReleaseCarousel";
import BookHorizontalCard from "@/components/BookHorizontalCard";
import StoryVerticalCard from "@/components/StoryVerticalCard";
import { formatLanguage, formatLevel, formatTopic } from "@/lib/displayFormat";


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
};


type BookCarouselItem = {
 slug: string;
 title: string;
 language?: string;
 level?: string;
 cover?: string;
 description?: string;
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
 level: string;
 topic?: string;
 coverUrl?: string;
};


const formatAudioDuration = (totalSeconds?: number) => {
 if (!totalSeconds || !Number.isFinite(totalSeconds) || totalSeconds <= 0) return "--:--";
 const rounded = Math.floor(totalSeconds);
 const minutes = Math.floor(rounded / 60);
 const seconds = rounded % 60;
 return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};


export default function MyLibraryClient() {
 const { user, isLoaded } = useUser();
 const [booksList, setBooksList] = useState<LibraryBook[]>([]);
 const [stories, setStories] = useState<LibraryStory[]>([]);
 const [loading, setLoading] = useState(true);
 const [storyDurations, setStoryDurations] = useState<Record<string, number>>({});


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


     try {
       const [booksRes, storiesRes] = await Promise.all([
         fetch("/api/library?type=book", { cache: "no-store" }),
         fetch("/api/library?type=story", { cache: "no-store" }),
       ]);


       const rawBooks: unknown = booksRes.ok ? await booksRes.json() : [];
       const rawStories: unknown = storiesRes.ok ? await storiesRes.json() : [];


       if (Array.isArray(rawBooks)) {
         setBooksList(
           rawBooks.filter(
             (b): b is LibraryBook =>
               typeof b === "object" &&
               b !== null &&
               typeof (b as LibraryBook).id === "string" &&
               typeof (b as LibraryBook).bookId === "string" &&
               typeof (b as LibraryBook).title === "string" &&
               typeof (b as LibraryBook).coverUrl === "string"
           )
         );
       }


       if (Array.isArray(rawStories)) {
         setStories(
           rawStories.filter(
             (s): s is LibraryStory =>
               typeof s === "object" &&
               s !== null &&
               typeof (s as LibraryStory).id === "string" &&
               typeof (s as LibraryStory).storyId === "string" &&
               typeof (s as LibraryStory).bookId === "string" &&
               typeof (s as LibraryStory).title === "string" &&
               typeof (s as LibraryStory).coverUrl === "string"
           )
         );
       }
     } catch {
       setBooksList([]);
       setStories([]);
     } finally {
       setTimeout(() => setLoading(false), 150);
     }
   };


   void load();
 }, [user, isLoaded]);


 // ------------------------------
 // REMOVE ITEM
 // ------------------------------
 const removeItem = async (type: "books" | "stories", id: string) => {
   if (type === "books") {
     setBooksList((prev) => prev.filter((b) => b.bookId !== id));
     await fetch("/api/library", {
       method: "DELETE",
       headers: { "Content-Type": "application/json" },
       body: JSON.stringify({ type: "book", bookId: id }),
     });
   } else {
     setStories((prev) => prev.filter((s) => s.storyId !== id));
     await fetch("/api/library", {
       method: "DELETE",
       headers: { "Content-Type": "application/json" },
       body: JSON.stringify({ type: "story", storyId: id }),
     });
   }
 };


 const allBooks = useMemo(() => Object.values(books), []);


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
       level:
         typeof meta.level === "string" ? formatLevel(meta.level) : undefined,
       cover: meta.cover,
       description: typeof meta.description === "string" ? meta.description : undefined,
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
     if (!bookMeta) continue;


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
     });
   }


   return arr;
 }, [stories, allBooks]);

 useEffect(() => {
   if (storyItems.length === 0) return;

   const unresolved = storyItems.filter((story) => {
     const key = `${story.bookSlug}:${story.storySlug}`;
     const bookMeta = allBooks.find((b) => b.slug === story.bookSlug);
     const storyMeta = bookMeta?.stories.find((s) => s.slug === story.storySlug);
     const hasAudio = typeof storyMeta?.audio === "string" && storyMeta.audio.trim() !== "";
     return !(typeof storyDurations[key] === "number" && storyDurations[key] > 0) && hasAudio;
   });
   if (unresolved.length === 0) return;

   let cancelled = false;

   const loadDuration = (story: StoryItem) =>
     new Promise<{ key: string; durationSec?: number }>((resolve) => {
       const key = `${story.bookSlug}:${story.storySlug}`;
       const bookMeta = allBooks.find((b) => b.slug === story.bookSlug);
       const storyMeta = bookMeta?.stories.find((s) => s.slug === story.storySlug);
       const rawSrc = storyMeta?.audio;
       if (!rawSrc || typeof rawSrc !== "string") {
         resolve({ key });
         return;
       }

       const src = rawSrc.startsWith("http")
         ? rawSrc
         : `https://cdn.sanity.io/files/9u7ilulp/production/${rawSrc}.mp3`;

       const audio = new Audio();
       audio.preload = "metadata";

       const done = (durationSec?: number) => {
         audio.removeAttribute("src");
         audio.load();
         resolve({ key, durationSec });
       };

       const timeout = window.setTimeout(() => done(undefined), 6000);
       audio.onloadedmetadata = () => {
         window.clearTimeout(timeout);
         const duration =
           Number.isFinite(audio.duration) && audio.duration > 0
             ? Math.round(audio.duration)
             : undefined;
         done(duration);
       };
       audio.onerror = () => {
         window.clearTimeout(timeout);
         done(undefined);
       };

       audio.src = src;
     });

   Promise.all(unresolved.map(loadDuration)).then((resolved) => {
     if (cancelled || resolved.length === 0) return;
     setStoryDurations((prev) => {
       let changed = false;
       const next = { ...prev };
       for (const result of resolved) {
         if (result.durationSec && result.durationSec > 0 && next[result.key] !== result.durationSec) {
           next[result.key] = result.durationSec;
           changed = true;
         }
       }
       return changed ? next : prev;
     });
   });

   return () => {
     cancelled = true;
   };
 }, [storyItems, storyDurations, allBooks]);


 // ------------------------------
 // UI
 // ------------------------------
 return (
   <div className="w-full mx-auto px-3 sm:px-4 lg:px-6 py-8 text-white">
     <h1 className="text-3xl font-bold mb-6">My Library</h1>


     {/* SKELETON */}
     {loading && (
       <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 place-items-center">
         {Array.from({ length: 6 }).map((_, i) => (
           <div
             key={i}
             className="bg-white/5 p-4 rounded-2xl shadow animate-pulse w-full max-w-[240px]"
           >
             <div className="w-full h-48 bg-white/10 rounded-xl mb-3" />
             <Skeleton lines={2} />
           </div>
         ))}
       </div>
     )}


     {/* CONTENT */}
     {!loading && (
       <>
         {/* BOOKS */}
         <section className="mb-16">
           <h2 className="text-2xl font-semibold mb-6 text-blue-400">
             Your Books
           </h2>


           {bookCarouselItems.length === 0 ? (
             <p className="text-gray-400">You don’t have any saved books right now.</p>
           ) : (
             <>
               <div className="md:hidden min-h-[240px]">
                 <StoryCarousel
                   items={bookCarouselItems}
                   renderItem={(book) => (
                     <BookHorizontalCard
                       href={`/books/${book.slug}?from=my-library`}
                       title={book.title}
                       cover={book.cover}
                       meta={`${book.language ?? "—"} · ${book.level ?? "—"}`}
                       description={book.description}
                       footer={
                         <button
                           type="button"
                           onClick={() => removeItem("books", book.bookId)}
                           className="w-full flex items-center justify-center gap-2 text-gray-400 hover:text-red-500 transition-colors text-sm font-medium"
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
                       meta={`${book.language ?? "—"} · ${book.level ?? "—"}`}
                       description={book.description}
                       footer={
                         <button
                           type="button"
                           onClick={() => removeItem("books", book.bookId)}
                           className="w-full flex items-center justify-center gap-2 text-gray-400 hover:text-red-500 transition-colors text-sm font-medium"
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
         <section className="mb-16">
           <h2 className="text-2xl font-semibold mb-6 text-white">
             Your Saved Stories
           </h2>


           {storyItems.length === 0 ? (
             <p className="text-gray-400">
               You don’t have any saved stories right now.
             </p>
           ) : (
             <StoryCarousel<StoryItem>
               items={storyItems}
               renderItem={(story) => (
                 <StoryVerticalCard
                   href={`/books/${story.bookSlug}/${story.storySlug}?returnTo=/my-library&returnLabel=My%20Library&from=my-library`}
                   title={story.title}
                   coverUrl={story.coverUrl || "/covers/default.png"}
                   subtitle={story.bookTitle}
                   meta={`${formatLanguage(story.language)} · ${formatLevel(story.level)}`}
                   metaSecondary={`${formatAudioDuration(
                     storyDurations[`${story.bookSlug}:${story.storySlug}`]
                   )} · ${formatTopic(story.topic)}`}
                   footer={
                     <button
                       type="button"
                       onClick={() => removeItem("stories", story.storyId)}
                       className="w-full flex items-center justify-center gap-2 text-gray-400 hover:text-red-500 transition-colors text-sm font-medium"
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
