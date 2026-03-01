export default function LoadingPolyglotStoryPage() {
  return (
    <div className="relative max-w-5xl mx-auto pt-8 px-8 pb-[8rem] bg-[#0D1B2A] text-white animate-pulse">
      <div className="mb-7 pt-2">
        <div className="h-11 w-3/4 mx-auto rounded bg-white/10" />
      </div>

      <div className="max-w-[65ch] mx-auto space-y-4 mb-12">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="h-5 rounded bg-white/10 w-full" />
        ))}
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#0D1B2A] px-4 py-3">
        <div className="h-16 rounded-xl bg-white/10" />
      </div>
    </div>
  );
}
