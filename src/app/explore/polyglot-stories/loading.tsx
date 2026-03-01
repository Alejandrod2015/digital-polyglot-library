export default function LoadingExplorePolyglotStories() {
  return (
    <div className="max-w-6xl mx-auto p-8 text-white">
      <div className="mb-8 flex items-center justify-between">
        <div className="h-9 w-72 rounded bg-white/10 animate-pulse" />
        <div className="h-5 w-28 rounded bg-white/10 animate-pulse" />
      </div>

      <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="rounded-2xl overflow-hidden bg-white/5 animate-pulse">
            <div className="h-48 bg-white/10" />
            <div className="p-5 space-y-3">
              <div className="h-6 w-4/5 rounded bg-white/10" />
              <div className="h-4 w-full rounded bg-white/10" />
              <div className="h-4 w-3/4 rounded bg-white/10" />
              <div className="h-4 w-2/5 rounded bg-white/10" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
