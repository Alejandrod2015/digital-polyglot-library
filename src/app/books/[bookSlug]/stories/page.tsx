'use client';


import { useState, useEffect } from 'react';
import { useParams, notFound } from 'next/navigation';
import { books } from '@/data/books';
import type { Story } from '@/types/books';
import Player from "@/components/Player";
import StoryContent from "@/components/StoryContent";




const stripPunct = (s: string) => s.replace(/[.,!?;:()"'«»¿¡]/g, '');


const highlightWord = (text: string, word: string) => {
 if (!word) return text;
 const regex = new RegExp(`(${word})`, 'i');
 const parts = text.split(regex);
 return parts.map((part, i) =>
   regex.test(part) ? (
     <span key={i} className="bg-yellow-400 text-black px-1 rounded">{part}</span>
   ) : (
     part
   )
 );
};


type NoteStatus = 'idle' | 'loading' | 'ready' | 'none' | 'error';


export default function ReaderPage() {
 const { bookId } = useParams();
//  const { setCurrentAudio } = useAudio();


 const [selectedStoryId, setSelectedStoryId] = useState('1');


 const [selectedWord, setSelectedWord] = useState<string | null>(null);
 const [contextTranslation, setContextTranslation] = useState<string | null>(null);
 const [wordTranslations, setWordTranslations] = useState<string[]>([]);
 const [culturalNote, setCulturalNote] = useState<string | null>(null);
 const [noteStatus, setNoteStatus] = useState<NoteStatus>('idle');
 const [saved, setSaved] = useState(false);
 const [errorMessage, setErrorMessage] = useState<string | null>(null);


 const [isMobile, setIsMobile] = useState(false);


 // Detectar mobile
 useEffect(() => {
   const checkMobile = () => setIsMobile(window.innerWidth < 768);
   checkMobile();
   window.addEventListener('resize', checkMobile);
   return () => window.removeEventListener('resize', checkMobile);
 }, []);


 const book = books[bookId as string];
 const story = book?.stories.find((s) => s.id === selectedStoryId);




 // Returns condicionales después de los hooks
 if (!book) {
   notFound();
   return null;
 }


 if (!story) {
   return <div className="p-8 text-center">No se encontró la historia seleccionada.</div>;
 }


 const handleStorySelect = (id: string) => {
   setSelectedStoryId(id);
 };


 const buildSnippet = (paragraphText: string, word: string) => {
   const words = paragraphText.split(/\s+/);
   const idx = words.findIndex((w) => stripPunct(w).toLowerCase().includes(word));
   if (idx === -1) return word;
   const start = Math.max(0, idx - 3);
   const end = Math.min(words.length, idx + 5);
   return words.slice(start, end).join(' ');
 };


 const processWord = async (raw: string, paragraphText: string) => {
   const word = stripPunct(raw).toLowerCase();
   if (!word) return;


   setSelectedWord(word);
   setSaved(false);
   setContextTranslation(null);
   setWordTranslations([]);
   setCulturalNote(null);
   setNoteStatus('loading');


   const snippet = buildSnippet(paragraphText, word);


   try {
     const res = await fetch('/api/translate', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ word, snippet }),
     });


     if (res.ok) {
       const data = await res.json();
       setContextTranslation(data.contextTranslation || '(no context translation)');
       setWordTranslations(data.wordTranslations || []);
     } else {
       setContextTranslation('(translation service unavailable)');
       setWordTranslations([]);
     }
   } catch {
     setContextTranslation('(translation service unavailable)');
     setWordTranslations([]);
   }


   fetch('/api/cultural-note', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
   word,
   snippet,
   bookId,
   storyId: selectedStoryId,
 }),
})


     .then(async (noteRes) => {
       if (!noteRes.ok) throw new Error('cultural-note error');
       const noteData = await noteRes.json();
       const rawNote = (noteData?.culturalNote || '').trim();


       if (rawNote) {
         setCulturalNote(rawNote);
         setNoteStatus('ready');
       } else {
         setCulturalNote(null);
         setNoteStatus('none');
       }
     })
     .catch(() => {
       setCulturalNote(null);
       setNoteStatus('error');
     });
 };


 const handleParagraphSelection = async (e: React.MouseEvent<HTMLParagraphElement>) => {
   const sel = window.getSelection();
   const raw = sel?.toString().trim();
   if (!raw) return;


   const words = raw.split(/\s+/);
   if (words.length > 5) {
     setErrorMessage('Please select a maximum of 5 words.');
     return;
   }


   setErrorMessage(null);
   await processWord(raw, e.currentTarget.textContent || raw);
 };


 const handleWordTap = (word: string, paragraphText: string) => {
   processWord(word, paragraphText);
 };


 const renderSelectableText = (text: string) => {
   if (isMobile) {
     return text.split(/\s+/).map((word, i, arr) => {
       const clean = stripPunct(word).toLowerCase();
       const isSelected = selectedWord === clean;
       return (
         <span
           key={i}
           onClick={() => handleWordTap(word, arr.join(' '))}
           className={`cursor-pointer px-1 rounded ${isSelected ? 'bg-yellow-400 text-black' : 'hover:bg-yellow-300 hover:text-black'}`}
         >
           {word}{' '}
         </span>
       );
     });
   }
   return selectedWord ? highlightWord(text, selectedWord) : text;
 };


 const saveToFavorites = () => {
   if (!selectedWord) return;
   const favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
   favorites.push({ word: selectedWord });
   localStorage.setItem('favorites', JSON.stringify(favorites));
   setSaved(true);
 };


 return (
   <div className="p-8 max-w-2xl mx-auto space-y-6 text-foreground">
     <h1 className="text-3xl font-bold text-center">{book.title}</h1>


     <div className="space-y-2">
       <h2 className="text-lg font-semibold">Select a story:</h2>
       {book.stories.map((s: Story) => (
         <button
           key={s.id}
           onClick={() => handleStorySelect(s.id)}
           className={`w-full text-left px-4 py-2 rounded ${s.id === selectedStoryId ? 'bg-blue-700 text-foreground' : 'bg-gray-800 hover:bg-gray-700'}`}
         >
           {s.title}
         </button>
       ))}
     </div>


     <h2 className="text-2xl font-bold mt-6">{story.title}</h2>


     <StoryContent
       text={story.text}
       sentencesPerParagraph={3}
       onParagraphSelect={!isMobile ? handleParagraphSelection : undefined}
       renderWord={(t) => renderSelectableText(t)}
     />


     {/* diálogo aún lo dejas abajo (luego lo estilizamos en el siguiente paso) */}
     <p
       className="italic mt-2 select-text"
       onMouseUp={!isMobile ? handleParagraphSelection : undefined}
     >


     </p>


     <div className="fixed bottom-0 left-0 right-0 z-50 md:ml-64">
 <Player
   src={`${book.audioFolder}/${story.audio}`}
   bookSlug={book.slug}
   storySlug={story.slug}
 />
</div>
    




     {(selectedWord || contextTranslation || noteStatus !== 'idle' || errorMessage) && (
       <div className="mt-6 p-4 bg-[#1b263b] rounded-xl shadow-md space-y-2">
         {errorMessage && (
           <p className="text-red-400 text-sm flex items-center gap-2">⚠️ {errorMessage}</p>
         )}


         {!errorMessage && (
           <>
             {selectedWord && (
               <p className="font-bold">
                 Selected word: <span className="text-yellow-400">{selectedWord}</span>
               </p>
             )}


             {wordTranslations.length > 0 && (
               <p className="text-blue-400">Word translations → {wordTranslations.join(', ')}</p>
             )}


             {contextTranslation && (
               <p className={contextTranslation.startsWith('Please') ? 'text-yellow-400' : 'text-green-400'}>
                 {contextTranslation.startsWith('Please') ? contextTranslation : <>Context → {contextTranslation}</>}
               </p>
             )}


             <div className="mt-3">
               {noteStatus === 'loading' && <div className="h-5 w-3/4 rounded bg-white/10 animate-pulse" />}
               {noteStatus === 'ready' && culturalNote && <p className="text-purple-300">Cultural note → {culturalNote}</p>}
               {noteStatus === 'none' && (
                 <span className="inline-flex items-center gap-2 text-xs text-gray-400 bg-white/5 px-2 py-1 rounded-full">
                   <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                   No cultural note
                 </span>
               )}
               {noteStatus === 'error' && (
                 <span className="inline-flex items-center gap-2 text-xs text-red-300 bg-red-500/10 px-2 py-1 rounded-full">
                   <span className="w-1.5 h-1.5 rounded-full bg-red-300" />
                   Cultural note unavailable
                 </span>
               )}
             </div>


             {selectedWord && !contextTranslation?.startsWith('Please') && (
               <button
                 onClick={saveToFavorites}
                 className={`px-4 py-2 rounded mt-2 transition-colors ${saved ? 'bg-green-600 text-foreground' : 'bg-[#e8b632] text-black hover:bg-yellow-500'}`}
               >
                 {saved ? 'Saved!' : 'Add to Favorites'}
               </button>
             )}
           </>
         )}
       </div>
     )}
   </div>
 );
}
