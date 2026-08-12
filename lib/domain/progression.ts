// Progression models from docs/01-domain-knowledge.md section 6. Each
// function resolves "what load should the client use this week" for one
// progression style, matching the resolveLoad() output shape in
// docs/04-architecture.md section 3.2: { kg | pct | rpe_target | 'client_choice' }.

/** Linear progression: add a fixed increment each session or week. */
export function linearProgression(currentLoadKg: number, incrementKg: number): number {
  return currentLoadKg + incrementKg;
}

/**
 * Double progression: hold load while reps climb to the top of the range,
 * then add load and drop back to the bottom of the range. The increment is
 * only applied once the client hits repsMax on the last logged top set.
 */
export function doubleProgression(params: {
  currentLoadKg: number;
  repsMax: number;
  lastTopSetReps: number;
  incrementKg: number;
}): number {
  const { currentLoadKg, repsMax, lastTopSetReps, incrementKg } = params;
  if (lastTopSetReps >= repsMax) {
    return currentLoadKg + incrementKg;
  }
  return currentLoadKg;
}

/** Percentage-based: load prescribed off a tested or estimated 1RM. */
export function percentageBasedLoad(oneRepMaxKg: number, percentageOfOneRepMax: number): number {
  if (oneRepMaxKg <= 0) return 0;
  if (percentageOfOneRepMax <= 0) return 0;
  return oneRepMaxKg * percentageOfOneRepMax;
}

/**
 * RPE anchored: the client picks the load to hit the target RPE, so the
 * system never computes a kg figure for this model — it passes the target
 * through for the logger to display (docs/01 section 6: "self-regulating,
 * needs an educated client").
 */
export function rpeAnchoredTarget(targetRpe: number): { mode: "client_choice"; targetRpe: number } {
  if (targetRpe < 1 || targetRpe > 10) {
    throw new Error("targetRpe must be between 1 and 10");
  }
  return { mode: "client_choice", targetRpe };
}

/** A planned lighter week: reduce load by a fraction, defaulting to 40% off. */
export function deloadLoad(currentLoadKg: number, reductionFraction = 0.4): number {
  if (reductionFraction < 0 || reductionFraction > 1) {
    throw new Error("reductionFraction must be between 0 and 1");
  }
  return currentLoadKg * (1 - reductionFraction);
}
