'use client';


import { useState, useMemo } from 'react';
import Link from 'next/link';
import { books } from '@/data/books';
import Cover from '@/components/Cover';
import Carousel from '@/components/Carousel';


const capitalize = (value?: string) =>
 value ? value.charAt(0).toUpperCase() + value.slice(1) : '—';


type UserStory = {
 id: string;
 slug: string;
 title: string;
 language: string;
 level: string;
 text: string;
};


type ExploreClientProps = {
 polyglotStories: UserStory[];
};


export default function ExploreClient({ polyglotStories }: ExploreClientProps) {
 const [selectedLang, setSelectedLang] = useState<string>('All');


 const groupedByLanguage: Record<string, typeof books[keyof typeof books][]> = {};
 Object.values(books).forEach((book) => {
   const lang = book.language || 'Unknown';
   if (!groupedByLanguage[lang]) groupedByLanguage[lang] = [];
   groupedByLanguage[lang].push(book);
 });


 const languages = Object.keys(groupedByLanguage).sort();


 const visibleBooks = useMemo(() => {
   if (selectedLang === 'All') return Object.values(books);
   return groupedByLanguage[selectedLang] ?? [];
 }, [selectedLang]);


 return (
   <div className="max-w-6xl mx-auto p-8 text-white">
     <h1 className="text-3xl font-bold mb-8">Explore</h1>


     {/* 🔹 Filtros por idioma */}
     <div className="flex flex-wrap gap-3 mb-10">
       <button
         onClick={() => setSelectedLang('All')}
         className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
           selectedLang === 'All'
             ? 'bg-blue-600 text-white'
             : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
         }`}
       >
         All
       </button>
       {languages.map((lang) => (
         <button
           key={lang}
           onClick={() => setSelectedLang(lang)}
           className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
             selectedLang === lang
               ? 'bg-blue-600 text-white'
               : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
           }`}
         >
           {lang}
         </button>
       ))}
     </div>


     {/* 🔹 Libros */}
     <h2 className="text-2xl font-semibold mb-6 text-blue-400">Books</h2>
     {visibleBooks.length === 0 ? (
       <p className="text-gray-400">No books available for this language.</p>
     ) : (
       <Carousel
         items={visibleBooks}
         className="mb-16"
         renderItem={(book) => (
           <Link
             key={book.slug}
             href={`/books/${book.slug}?from=explore`}
             className="flex items-center gap-6 bg-white/5 hover:bg-white/10 transition-all duration-200 rounded-2xl overflow-hidden shadow-md w-full h-full p-5"
           >
             <div className="w-[35%] sm:w-[30%] md:w-[120px] flex-shrink-0">
               <Cover src={book.cover} alt={book.title} />
             </div>
             <div className="flex flex-col justify-center text-left flex-1">
               <h3 className="font-semibold text-lg leading-snug mb-2 text-white line-clamp-2">
                 {book.title}
               </h3>
               <p className="text-gray-300 text-sm leading-relaxed line-clamp-3">
                 {book.description}
               </p>
               <div className="space-y-1 text-sm text-white/80 mt-3">
                 {book.language && (
                   <p>
                     <span className="font-medium text-white">Language:</span>{' '}
                     {capitalize(book.language)}
                   </p>
                 )}
                 {book.level && (
                   <p>
                     <span className="font-medium text-white">Level:</span>{' '}
                     {capitalize(book.level)}
                   </p>
                 )}
               </div>
             </div>
           </Link>
         )}
       />
     )}


     {/* 🔹 Historias Polyglot */}
     <div className="mb-16">
       <h2 className="text-2xl font-semibold mb-6 text-emerald-400">
         Polyglot Stories
       </h2>


       {polyglotStories.length === 0 ? (
         <div className="h-[320px] flex items-center justify-center text-gray-400 bg-white/5 rounded-2xl">
           No Polyglot stories have been published yet.
         </div>
       ) : (
         <div className="min-h-[320px]">
           <Carousel
             items={polyglotStories}
             renderItem={(story) => (
               <Link
                 key={story.id}
                 href={`/stories/${story.slug}`}
                 className="flex flex-col bg-white/5 hover:bg-white/10 transition-all duration-200 rounded-2xl overflow-hidden shadow-md h-full"
               >
                 <div className="p-5 flex flex-col justify-between flex-1 text-left">
                   <div>
                     <h3 className="text-xl font-semibold mb-2 text-white">
                       {story.title}
                     </h3>
                     <p className="text-gray-300 text-sm leading-relaxed line-clamp-3">
                       {story.text
                         ?.replace(/<[^>]+>/g, '')
                         .slice(0, 120) ?? ''}
                       ...
                     </p>
                   </div>
                   <div className="mt-3 text-sm text-gray-400 space-y-1">
                     {story.language && (
                       <p>
                         <span className="font-semibold text-gray-300">
                           Language:
                         </span>{' '}
                         {story.language}
                       </p>
                     )}
                     {story.level && (
                       <p>
                         <span className="font-semibold text-gray-300">
                           Level:
                         </span>{' '}
                         {story.level}
                       </p>
                     )}
                   </div>
                 </div>
               </Link>
             )}
           />
         </div>
       )}
     </div>
   </div>
 );
}