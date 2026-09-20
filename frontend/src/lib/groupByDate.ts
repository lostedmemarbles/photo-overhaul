import type { ProcessedPhoto } from './types'

export function groupByDate(photos: ProcessedPhoto[]): Array<[string, ProcessedPhoto[]]> {
  const groups = new Map<string, ProcessedPhoto[]>()
  for (const photo of photos) {
    const key = photo.exifDate ?? 'Unknown date'
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(photo)
  }
  return [...groups.entries()].sort(([a], [b]) => (a < b ? 1 : -1))
}
