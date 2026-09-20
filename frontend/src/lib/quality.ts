import type { ProcessingOptions } from './types'

/** The user's quality slider only applies when "reduce quality" is on; otherwise use the given default. */
export function resolveQuality(
  options: Pick<ProcessingOptions, 'reduceQuality' | 'qualityPercent'>,
  fallback: number,
): number {
  if (!options.reduceQuality) return fallback
  return Math.min(1, Math.max(0.01, options.qualityPercent / 100))
}
