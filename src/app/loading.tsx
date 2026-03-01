export default function AppLoading() {
  return (
    <div className="min-h-full w-full bg-[var(--bg-content)] animate-pulse px-8 py-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="h-10 w-64 rounded bg-white/10" />
        <div className="h-48 rounded-2xl bg-white/10" />
        <div className="h-8 w-48 rounded bg-white/10" />
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-56 rounded-2xl bg-white/10" />
          ))}
        </div>
      </div>
    </div>
  );
}

