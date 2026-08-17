export function AmbientBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-background" />
      <div className="animate-mesh-drift absolute -top-48 -left-48 h-[36rem] w-[36rem] rounded-full bg-primary/15 blur-[110px]" />
      <div className="animate-float-slower absolute top-1/4 -right-40 h-[32rem] w-[32rem] rounded-full bg-[oklch(0.72_0.16_65)]/12 blur-[110px]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,var(--foreground)_1px,transparent_0)] opacity-[0.025] [background-size:28px_28px]" />
    </div>
  );
}
