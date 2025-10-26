import Link from "next/link";
import { ArrowLeft } from "lucide-react";

type Props = {
  children: React.ReactNode;
  params: Promise<{ bookSlug: string }>;
};

export default async function StoryLayout({ children, params }: Props) {
  const { bookSlug } = await params;

  return (
    <div className="flex flex-col min-h-full bg-[#0D1B2A] text-foreground">
      {/* Botón de volver (desktop) */}
      <div className="hidden md:block">
        <div className="mx-auto max-w-4xl px-6 pt-6">
          <Link
            href={`/books/${bookSlug}`}
            className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-gray-700"
          >
            <ArrowLeft className="h-5 w-5" />
            <span>Back to book</span>
          </Link>
        </div>
      </div>

      {/* Contenido principal sin overflow ni altura fija */}
      <main className="flex-1">{children}</main>
    </div>
  );
}
