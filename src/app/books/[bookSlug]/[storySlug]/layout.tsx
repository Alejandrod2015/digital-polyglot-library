import Link from "next/link";
import { ArrowLeft } from "lucide-react";

type Props = {
  children: React.ReactNode;
  params: Promise<{ bookSlug: string; storySlug: string }>;
};

export default async function StoryLayout({ children, params }: Props) {
  const { bookSlug } = await params;

  return (
    <div className="relative flex min-h-screen flex-col">
      {/* Desktop: back button aligned with content */}
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

      {/* Main content */}
      <main className="flex-1">{children}</main>
    </div>
  );
}
