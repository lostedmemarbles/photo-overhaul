import JSZip from 'jszip'
import type { ProcessedPhoto } from './types'

/** YYYY/YYYY-MM-DD/filename when sorting by date, else just filename at the zip root. */
export function archivePathFor(
  photo: Pick<ProcessedPhoto, 'exifDate' | 'outputFilename'>,
  sortByDate: boolean,
): string {
  if (!sortByDate) return photo.outputFilename
  const folder = photo.exifDate ? `${photo.exifDate.slice(0, 4)}/${photo.exifDate}` : 'unknown'
  return `${folder}/${photo.outputFilename}`
}

export async function buildOrganizedZip(photos: ProcessedPhoto[], sortByDate: boolean): Promise<Blob> {
  const zip = new JSZip()
  for (const photo of photos) {
    if (photo.status !== 'done' || !photo.outputBlob || photo.excluded) continue
    zip.file(archivePathFor(photo, sortByDate), photo.outputBlob)
  }
  return zip.generateAsync({ type: 'blob' })
}
