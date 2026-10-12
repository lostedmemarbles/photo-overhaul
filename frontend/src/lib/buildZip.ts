import JSZip from 'jszip'
import type { DateGranularity, ProcessedPhoto } from './types'

export const PASSTHROUGH_FOLDER = 'other-files'
export const FAILED_FOLDER = 'failed-to-process'

/**
 * Folder path when sorting by date, else just filename at the zip root.
 * Granularity controls folder depth: 'year' -> YYYY/, 'month' -> YYYY/YYYY-MM/,
 * 'day' -> YYYY/YYYY-MM/YYYY-MM-DD/. A photo with no determined date always
 * goes under unknown/, regardless of granularity - there's nothing to subdivide.
 */
export function archivePathFor(
  photo: Pick<ProcessedPhoto, 'exifDate' | 'outputFilename'>,
  sortByDate: boolean,
  dateGranularity: DateGranularity = 'day',
): string {
  if (!sortByDate) return photo.outputFilename
  if (!photo.exifDate) return `unknown/${photo.outputFilename}`

  const year = photo.exifDate.slice(0, 4)
  const month = photo.exifDate.slice(0, 7)
  const day = photo.exifDate
  const folder =
    dateGranularity === 'year' ? year : dateGranularity === 'month' ? `${year}/${month}` : `${year}/${month}/${day}`

  return `${folder}/${photo.outputFilename}`
}

/** Appends " (2)", " (3)", ... before the extension if the path is already taken. */
function uniquePath(path: string, usedPaths: Set<string>): string {
  if (!usedPaths.has(path)) {
    usedPaths.add(path)
    return path
  }
  const dot = path.lastIndexOf('.')
  const base = dot === -1 ? path : path.slice(0, dot)
  const ext = dot === -1 ? '' : path.slice(dot)
  let n = 2
  let candidate = `${base} (${n})${ext}`
  while (usedPaths.has(candidate)) {
    n++
    candidate = `${base} (${n})${ext}`
  }
  usedPaths.add(candidate)
  return candidate
}

export interface BuildZipResult {
  blob: Blob
  // Archive paths that couldn't be read and were left out of the zip - e.g.
  // Chromium can evict a Blob's backing data under memory pressure (large
  // batches, long sessions) before it's actually read, throwing a
  // "could not be read... permission problems" error. Previously any single
  // unreadable file aborted the whole zip (nothing downloaded at all); now
  // it's just left out and reported, so everything else still comes through.
  skipped: string[]
}

/**
 * Builds the download zip.
 * - `passthroughFiles` are files that weren't recognized photo types (loose,
 *   or found inside an uploaded zip) - unchanged under other-files/.
 * - `failedOriginals` are photos that WERE recognized but errored during
 *   processing (a corrupt file, an unsupported HEIC variant, etc.) - their
 *   original untouched bytes go under failed-to-process/ rather than being
 *   dropped, so a processing failure never means losing the file outright.
 */
export async function buildOrganizedZip(
  photos: ProcessedPhoto[],
  sortByDate: boolean,
  passthroughFiles: File[] = [],
  failedOriginals: File[] = [],
  dateGranularity: DateGranularity = 'day',
): Promise<BuildZipResult> {
  const zip = new JSZip()
  const usedPaths = new Set<string>()
  const skipped: string[] = []

  async function addSafely(path: string, blob: Blob): Promise<void> {
    try {
      zip.file(path, await blob.arrayBuffer())
    } catch {
      skipped.push(path)
    }
  }

  for (const photo of photos) {
    if (photo.status !== 'done' || !photo.outputBlob || photo.excluded) continue
    await addSafely(uniquePath(archivePathFor(photo, sortByDate, dateGranularity), usedPaths), photo.outputBlob)
  }

  for (const file of passthroughFiles) {
    await addSafely(uniquePath(`${PASSTHROUGH_FOLDER}/${file.name}`, usedPaths), file)
  }

  for (const file of failedOriginals) {
    await addSafely(uniquePath(`${FAILED_FOLDER}/${file.name}`, usedPaths), file)
  }

  const blob = await zip.generateAsync({ type: 'blob' })
  return { blob, skipped }
}
