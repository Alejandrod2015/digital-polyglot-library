import StoryBackLink from "@/components/StoryBackLink";
import { ArrowLeft } from "lucide-react";
import { Suspense } from "react";

type Props = {
  children: React.ReactNode;
};

export default function PolyglotStoryLayout({ children }: Props) {
  return (
    <div className="flex flex-col min-h-full text-foreground">
      <div className="block">
        <div className="mx-auto max-w-4xl px-4 pt-4 md:px-6 md:pt-6">
          <Suspense
            fallback={
              <div className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-gray-300/80">
                <ArrowLeft className="h-5 w-5" />
                <span>Back</span>
              </div>
            }
          >
            <StoryBackLink fallbackHref="/explore" fallbackLabel="Back to Explore" />
          </Suspense>
        </div>
      </div>

      <main className="flex-1">{children}</main>
    </div>
  );
}
