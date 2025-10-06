import { books } from "@/data/books";
import Player from "@/components/Player";
import VocabPanel from "@/components/VocabPanel";


type StoryPageProps = {
 params: Promise<{ bookSlug: string; storySlug: string }>;
};


export default async function StoryPage({ params }: StoryPageProps) {
 // 👇 Ahora usamos await porque params es una Promise en Next.js 15
 const { bookSlug, storySlug } = await params;


 // Buscar el libro por slug
 const book = Object.values(books).find((b) => b.slug === bookSlug);
 if (!book) {
   return <div className="p-8 text-center">Book not found.</div>;
 }


 // Buscar la historia por slug
 const story = book.stories.find((s) => s.slug === storySlug);
 if (!story) {
   return <div className="p-8 text-center">Story not found.</div>;
 }


 return (
   <div className="max-w-3xl mx-auto p-8 text-gray-100 pb-40">
     {/* 👆 padding-bottom para que no tape el player */}
     <h1 className="text-3xl font-bold mb-4">{story.title}</h1>


     {/* Renderiza el HTML de la historia */}
     <div
       className="max-w-none mb-8
       [&>p]:mb-6 [&>p]:text-gray-300 [&>p]:text-lg [&>p]:leading-relaxed
       [&>blockquote]:mb-6 [&>blockquote]:text-gray-300 [&>blockquote]:text-lg [&>blockquote]:leading-relaxed [&>blockquote]:not-italic [&>blockquote]:font-normal [&>blockquote]:border-none
       [&_.vocab-word]:bg-yellow-400/60 [&_.vocab-word]:px-0.5 [&_.vocab-word]:rounded [&_.vocab-word]:cursor-pointer"
       dangerouslySetInnerHTML={{ __html: story.text }}
     />


     {/* 📚 Panel de vocabulario (client-only) */}
     <VocabPanel story={story} />


     {/* 🎧 Player fijo */}
     {/* 🎧 Player fijo en la parte inferior */}
<div className="fixed bottom-0 left-0 right-0 z-50 md:ml-64">
 <Player
   src={`${book.audioFolder}/${story.audio}`}
   bookSlug={book.slug}
   storySlug={story.slug}
 />
</div>




   </div>
 );
}


// ✅ Genera rutas estáticas para todas las historias
export function generateStaticParams() {
 const params: { bookSlug: string; storySlug: string }[] = [];


 Object.values(books).forEach((book) => {
   book.stories.forEach((story) => {
     params.push({
       bookSlug: book.slug,
       storySlug: story.slug,
     });
   });
 });


 return params;
}


