'use client';

export default function Loading() {
  return (
    <div className="max-w-5xl mx-auto p-8 text-white">
      <div className="h-10 w-40 rounded bg-white/10 animate-pulse mb-8" />

      <section className="mb-10">
        <div className="h-7 w-36 rounded bg-white/10 animate-pulse mb-4" />
        <div className="flex gap-4 overflow-x-auto pb-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={`book-${i}`}
              className="min-w-[320px] max-w-[380px] w-[88vw] md:w-[46%] rounded-2xl border border-white/10 bg-white/5 p-3 animate-pulse"
            >
              <div className="flex gap-3">
                <div className="h-28 w-24 rounded-xl bg-white/10 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-5 w-3/4 rounded bg-white/10" />
                  <div className="h-4 w-1/2 rounded bg-white/10" />
                  <div className="h-4 w-full rounded bg-white/10" />
                  <div className="h-4 w-5/6 rounded bg-white/10" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="h-7 w-40 rounded bg-white/10 animate-pulse mb-4" />
        <div className="flex gap-4 overflow-x-auto pb-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={`story-${i}`}
              className="min-w-[220px] max-w-[240px] w-[58vw] sm:w-[42vw] md:w-[220px] rounded-2xl border border-white/10 bg-white/5 p-3 animate-pulse"
            >
              <div className="aspect-[3/4] w-full rounded-xl bg-white/10 mb-3" />
              <div className="h-5 w-4/5 rounded bg-white/10 mb-2" />
              <div className="h-4 w-2/3 rounded bg-white/10 mb-2" />
              <div className="h-4 w-full rounded bg-white/10 mb-2" />
              <div className="h-4 w-5/6 rounded bg-white/10" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
