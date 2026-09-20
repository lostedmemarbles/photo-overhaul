import JSZip from 'jszip'
import type { ProcessedPhoto } from './types'

export const PASSTHROUGH_FOLDER = 'other-files'

/** YYYY/YYYY-MM-DD/filename when sorting by date, else just filename at the zip root. */
export function archivePathFor(
  photo: Pick<ProcessedPhoto, 'exifDate' | 'outputFilename'>,
  sortByDate: boolean,
): string {
  if (!sortByDate) return photo.outputFilename
  const folder = photo.exifDate ? `${photo.exifDate.slice(0, 4)}/${photo.exifDate}` : 'unknown'
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

/**
 * Builds the download zip. `passthroughFiles` are files that weren't
 * recognized photo types (loose, or found inside an uploaded zip) - they
 * ride along unchanged under other-files/ so nothing the user uploaded goes
 * missing, rather than being silently dropped.
 */
export async function buildOrganizedZip(
  photos: ProcessedPhoto[],
  sortByDate: boolean,
  passthroughFiles: File[] = [],
): Promise<Blob> {
  const zip = new JSZip()
  const usedPaths = new Set<string>()

  for (const photo of photos) {
    if (photo.status !== 'done' || !photo.outputBlob || photo.excluded) continue
    zip.file(uniquePath(archivePathFor(photo, sortByDate), usedPaths), photo.outputBlob)
  }

  for (const file of passthroughFiles) {
    zip.file(uniquePath(`${PASSTHROUGH_FOLDER}/${file.name}`, usedPaths), file)
  }

  return zip.generateAsync({ type: 'blob' })
}
