export default function LoadingExploreBooks() {
  return (
    <div className="max-w-6xl mx-auto p-8 text-white">
      <div className="mb-8 flex items-center justify-between">
        <div className="h-9 w-52 rounded bg-white/10 animate-pulse" />
        <div className="h-5 w-28 rounded bg-white/10 animate-pulse" />
      </div>

      <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="rounded-2xl overflow-hidden bg-white/5 animate-pulse">
            <div className="h-52 bg-white/10" />
            <div className="p-4 space-y-3">
              <div className="h-5 w-4/5 rounded bg-white/10" />
              <div className="h-4 w-2/3 rounded bg-white/10" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
