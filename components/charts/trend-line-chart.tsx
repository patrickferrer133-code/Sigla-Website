// Minimal dependency-free SVG line chart. Points with a null value break
// the line into separate segments — per docs/_specs/weekly-checkins-spec.md
// Story 5, a gap in real data must never be bridged or read as a zero.

export interface TrendPoint {
  label: string;
  value: number | null;
  isDeload?: boolean;
}

export function TrendLineChart({
  points,
  height = 160,
  unit = "",
  color = "var(--primary)",
}: {
  points: TrendPoint[];
  height?: number;
  unit?: string;
  color?: string;
}) {
  const width = 600;
  const padding = 24;

  const values = points.map((p) => p.value).filter((v): v is number => v !== null);
  if (values.length < 2) {
    return (
      <div className="flex h-40 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
        Not enough data yet — come back after week 2.
      </div>
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const xStep = points.length > 1 ? (width - padding * 2) / (points.length - 1) : 0;
  const yFor = (v: number) => height - padding - ((v - min) / range) * (height - padding * 2);
  const xFor = (i: number) => padding + i * xStep;

  // Break into contiguous non-null runs so a gap never gets bridged.
  const segments: { x: number; y: number }[][] = [];
  let current: { x: number; y: number }[] = [];
  points.forEach((p, i) => {
    if (p.value === null) {
      if (current.length) segments.push(current);
      current = [];
      return;
    }
    current.push({ x: xFor(i), y: yFor(p.value) });
  });
  if (current.length) segments.push(current);

  const latest = [...points].reverse().find((p) => p.value !== null);

  return (
    <div>
      {latest && (
        <p className="mb-1 text-lg font-semibold">
          {latest.value?.toFixed(1)}
          {unit}
        </p>
      )}
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="Trend chart">
        {segments.map((segment, idx) => (
          <polyline
            key={idx}
            points={segment.map((p) => `${p.x},${p.y}`).join(" ")}
            fill="none"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
        {points.map((p, i) =>
          p.value === null ? null : (
            <circle
              key={i}
              cx={xFor(i)}
              cy={yFor(p.value)}
              r={p.isDeload ? 4 : 3}
              fill={p.isDeload ? "white" : color}
              stroke={color}
              strokeWidth={p.isDeload ? 2 : 0}
            />
          ),
        )}
      </svg>
    </div>
  );
}
