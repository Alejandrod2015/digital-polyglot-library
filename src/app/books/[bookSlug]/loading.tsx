export default function LoadingBookPage() {
  return (
    <div className="max-w-5xl mx-auto p-8 animate-pulse">
      <div className="h-9 w-28 rounded bg-white/10 mb-6" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="flex justify-center md:justify-end order-1 md:order-2">
          <div className="w-[240px] aspect-[2/3] rounded-2xl bg-white/10" />
        </div>

        <div className="md:col-span-2 order-2 md:order-1">
          <div className="h-10 w-3/4 rounded bg-white/10 mb-4" />
          <div className="h-6 w-1/2 rounded bg-white/10 mb-6" />
          <div className="space-y-3 mb-8">
            <div className="h-4 w-full rounded bg-white/10" />
            <div className="h-4 w-11/12 rounded bg-white/10" />
            <div className="h-4 w-10/12 rounded bg-white/10" />
          </div>
          <div className="h-10 w-56 rounded-xl bg-white/10 mb-10" />

          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-14 rounded-xl bg-white/10" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
