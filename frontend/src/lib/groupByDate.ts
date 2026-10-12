import type { DateGranularity, ProcessedPhoto } from './types'

/** Groups by year, year-month, or the full exact date, matching whatever
 *  folder depth the zip download will use - so the on-screen preview lines
 *  up with the actual output instead of always showing day-by-day groups. */
export function groupByDate(
  photos: ProcessedPhoto[],
  granularity: DateGranularity = 'day',
): Array<[string, ProcessedPhoto[]]> {
  const groups = new Map<string, ProcessedPhoto[]>()
  for (const photo of photos) {
    let key: string
    if (!photo.exifDate) key = 'Unknown date'
    else if (granularity === 'year') key = photo.exifDate.slice(0, 4)
    else if (granularity === 'month') key = photo.exifDate.slice(0, 7)
    else key = photo.exifDate

    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(photo)
  }
  return [...groups.entries()].sort(([a], [b]) => (a < b ? 1 : -1))
}
