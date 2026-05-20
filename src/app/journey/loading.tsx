export default function LoadingJourneyPage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 pb-14 pt-4 sm:gap-4 sm:px-6 lg:px-8 animate-pulse">
      <div className="rounded-[1.35rem] border border-white/10 bg-[linear-gradient(180deg,rgba(19,50,83,0.84),rgba(11,31,61,0.96))] px-4 py-3 sm:px-5">
        <div className="mb-2 h-3 w-24 rounded bg-white/10" />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 rounded-[1.1rem] bg-white/8" />
          ))}
        </div>
      </div>
      <div className="rounded-[1.35rem] border border-white/10 bg-[linear-gradient(180deg,#0a2b56_0%,#08264d_56%,#071f43_100%)] px-4 py-3 sm:px-5">
        <div className="mb-3 h-4 w-32 rounded bg-white/10" />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-8 w-20 rounded-full bg-white/10" />
          ))}
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <div className="h-44 rounded-[1.35rem] bg-white/8" />
        <div className="h-44 rounded-[1.35rem] bg-white/8" />
      </div>
      <div className="rounded-[1.35rem] border border-white/10 bg-[linear-gradient(180deg,#0a2b56_0%,#08264d_56%,#071f43_100%)] p-5">
        <div className="space-y-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-2">
              <div className="h-3 w-16 rounded-full bg-white/10" />
              <div className="h-[4.7rem] w-[4.7rem] rounded-[1.05rem] bg-white/10" />
              <div className="h-3 w-20 rounded bg-white/10" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
