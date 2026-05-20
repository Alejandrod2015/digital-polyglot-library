export default function LoadingJourneyTopicPage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-4 pb-14 pt-4 sm:px-6 animate-pulse">
      <div className="h-9 w-32 rounded bg-white/10" />
      <div className="rounded-[1.35rem] border border-white/10 bg-[linear-gradient(180deg,#0a2b56_0%,#071f43_100%)] p-5">
        <div className="mb-3 h-4 w-40 rounded bg-white/10" />
        <div className="h-9 w-2/3 rounded bg-white/10" />
        <div className="mt-3 h-3 w-1/2 rounded bg-white/10" />
        <div className="mt-5 h-2 w-full rounded-full bg-white/10" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-20 rounded-2xl bg-white/8" />
        ))}
      </div>
    </div>
  );
}
