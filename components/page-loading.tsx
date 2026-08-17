export function PageLoading() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
      <div className="relative flex size-12 items-center justify-center">
        <div className="absolute inset-0 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
        <div className="animate-pulse text-sm font-semibold text-primary">S</div>
      </div>
      <div className="glass animate-shimmer h-2 w-32 overflow-hidden rounded-full bg-[linear-gradient(90deg,transparent,var(--primary)/20,transparent)]" />
    </div>
  );
}
