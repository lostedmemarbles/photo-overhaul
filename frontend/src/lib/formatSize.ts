export function formatBytes(bytes: number): string {
  const safeBytes = Number.isFinite(bytes) ? bytes : 0
  if (safeBytes < 1024) return `${safeBytes} B`
  const units = ['KB', 'MB', 'GB']
  let value = safeBytes / 1024
  let i = 0
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024
    i++
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[i]}`
}

export interface SizeComparison {
  originalBytes: number
  outputBytes: number
  percentChange: number // negative = smaller, positive = larger
}

// Guards against NaN/undefined creeping in from stale or partial photo state
// (e.g. an entry missing a field) - this is display code, it should never
// render "NaN" no matter what it's handed.
export function compareSizes(originalBytes: number, outputBytes: number): SizeComparison {
  const safeOriginal = Number.isFinite(originalBytes) ? originalBytes : 0
  const safeOutput = Number.isFinite(outputBytes) ? outputBytes : 0
  const percentChange = safeOriginal > 0 ? ((safeOutput - safeOriginal) / safeOriginal) * 100 : 0
  return { originalBytes: safeOriginal, outputBytes: safeOutput, percentChange }
}

export function formatSizeComparison({ originalBytes, outputBytes, percentChange }: SizeComparison): string {
  const direction = percentChange <= 0 ? 'smaller' : 'larger'
  return `${formatBytes(originalBytes)} → ${formatBytes(outputBytes)} (${Math.abs(percentChange).toFixed(0)}% ${direction})`
}
