// e1RM formulas from docs/01-domain-knowledge.md section 6. Both are stored;
// Epley is the display default because it stays sane at high rep counts,
// where Brzycki's denominator (37 - reps) approaches zero.

export function estimatedOneRepMaxEpley(weightKg: number, reps: number): number {
  if (weightKg <= 0 || reps <= 0) return 0;
  return weightKg * (1 + reps / 30);
}

export function estimatedOneRepMaxBrzycki(weightKg: number, reps: number): number {
  if (weightKg <= 0 || reps <= 0 || reps >= 37) return 0;
  return (weightKg * 36) / (37 - reps);
}

export function volumeLoad(sets: number, reps: number, loadKg: number): number {
  if (sets <= 0 || reps <= 0 || loadKg <= 0) return 0;
  return sets * reps * loadKg;
}

/**
 * Trailing rolling average over a chronological series that may have gaps
 * (e.g. a day with no weigh-in). Each output point averages whatever
 * non-null values fall inside the trailing window, per docs/01 section 10:
 * "Show a 7 day rolling average as the primary line and raw dots as
 * secondary." Returns null for a point with no data in its window.
 */
export function rollingAverage(values: readonly (number | null)[], windowSize: number): (number | null)[] {
  if (windowSize <= 0) throw new Error("windowSize must be positive");

  return values.map((_, index) => {
    const windowStart = Math.max(0, index - windowSize + 1);
    const window = values.slice(windowStart, index + 1).filter((v): v is number => v !== null);
    if (window.length === 0) return null;
    return window.reduce((sum, v) => sum + v, 0) / window.length;
  });
}

/** sessions completed / sessions prescribed, clamped to [0, 1]. */
export function sessionCompletionRate(completed: number, prescribed: number): number {
  if (prescribed <= 0) return completed > 0 ? 1 : 0;
  return Math.min(1, Math.max(0, completed / prescribed));
}

/** sets completed / sets prescribed, clamped to [0, 1]. */
export function setCompletionRate(setsCompleted: number, setsPrescribed: number): number {
  if (setsPrescribed <= 0) return setsCompleted > 0 ? 1 : 0;
  return Math.min(1, Math.max(0, setsCompleted / setsPrescribed));
}

/** Actual load minus prescribed load, in kg. Positive means the client went heavier than prescribed. */
export function loadDeltaKg(prescribedKg: number, actualKg: number): number {
  return actualKg - prescribedKg;
}

/**
 * Rolling 28-day adherence, the single-source-of-truth definition from
 * docs/05-funnel-and-growth.md section 7: sessions completed / sessions
 * prescribed, rolling 28 days.
 */
export function adherenceRate28d(sessionsCompleted: number, sessionsPrescribed: number): number {
  return sessionCompletionRate(sessionsCompleted, sessionsPrescribed);
}
