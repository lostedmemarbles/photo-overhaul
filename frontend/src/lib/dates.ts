import type { DateSource } from './types'

export function toIsoDate(date: Date): string {
  const yyyy = date.getFullYear().toString().padStart(4, '0')
  const mm = (date.getMonth() + 1).toString().padStart(2, '0')
  const dd = date.getDate().toString().padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

/**
 * Many real-world uploads (screenshots, and anything downloaded from social
 * media/messaging apps, which strip EXIF on upload) have no capture-date
 * metadata at all. Falling back to the file's last-modified date still lets
 * the app group them, but for a re-downloaded file that's the download date,
 * not when the photo was taken - callers must not present it as exact.
 */
export function resolveDate(
  exifDate: string | null,
  lastModifiedMs: number,
): { date: string; source: DateSource } {
  if (exifDate) return { date: exifDate, source: 'exif' }
  return { date: toIsoDate(new Date(lastModifiedMs)), source: 'file-modified' }
}
