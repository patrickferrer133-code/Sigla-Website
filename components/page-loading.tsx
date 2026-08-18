export function PageLoading() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3">
      <video autoPlay loop muted playsInline className="h-16 w-auto">
        <source src="/sigla-intro.webm" type="video/webm" />
        <source src="/sigla-intro.mp4" type="video/mp4" />
      </video>
      <div className="glass animate-shimmer h-2 w-32 overflow-hidden rounded-full bg-[linear-gradient(90deg,transparent,var(--primary)/20,transparent)]" />
    </div>
  );
}
