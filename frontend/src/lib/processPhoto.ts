import exifr from 'exifr'
import heic2any from 'heic2any'
import { resolveDate, toIsoDate } from './dates'
import type { ProcessedPhoto, ProcessingOptions } from './types'

// contentHash/excluded are managed by the caller (App.tsx), which computes
// the hash up front for instant duplicate detection and owns exclusion state.
export type ProcessPhotoResult = Omit<ProcessedPhoto, 'contentHash' | 'excluded'>

const HEIC_EXTENSIONS = ['.heic', '.heif']
const HEIC_TYPES = ['image/heic', 'image/heif']
const THUMBNAIL_MAX_SIZE = 320
const SQUARIFY_BACKGROUND = '#000000'

function isHeic(file: File): boolean {
  const name = file.name.toLowerCase()
  return HEIC_TYPES.includes(file.type.toLowerCase()) || HEIC_EXTENSIONS.some((ext) => name.endsWith(ext))
}

function stripExtension(name: string): string {
  return name.replace(/\.[^./\\]+$/, '')
}

/** Squarify always re-encodes to JPEG (it has to rasterize anyway); HEIC only
 *  becomes JPEG if conversion is on, or squarify forces a rasterize pass. */
function outputFilenameFor(file: File, options: ProcessingOptions): string {
  const willBeJpeg = options.squarify || (options.convertHeic && isHeic(file))
  return willBeJpeg ? `${stripExtension(file.name)}.jpg` : file.name
}

/** Reads DateTimeOriginal from the EXIF sub-IFD (falling back to CreateDate/ModifyDate). */
async function extractExifDate(file: File): Promise<string | null> {
  try {
    const tags = await exifr.parse(file, { pick: ['DateTimeOriginal', 'CreateDate', 'ModifyDate'] })
    const date: Date | undefined = tags?.DateTimeOriginal ?? tags?.CreateDate ?? tags?.ModifyDate
    if (!date || Number.isNaN(date.getTime())) return null
    return toIsoDate(date)
  } catch {
    return null
  }
}

async function decodeHeicToJpeg(file: File, quality = 0.9): Promise<Blob> {
  const converted = await heic2any({ blob: file, toType: 'image/jpeg', quality })
  return Array.isArray(converted) ? converted[0] : converted
}

/** Pads an image to a square canvas (longer side sets the size), centered, with a solid fill. */
async function squarifyImage(blob: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(blob)
  const size = Math.max(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context unavailable')
  ctx.fillStyle = SQUARIFY_BACKGROUND
  ctx.fillRect(0, 0, size, size)
  ctx.drawImage(bitmap, (size - bitmap.width) / 2, (size - bitmap.height) / 2)
  bitmap.close()

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (out) => (out ? resolve(out) : reject(new Error('Squarify failed'))),
      'image/jpeg',
      0.92,
    )
  })
}

async function makeThumbnail(blob: Blob, maxSize = THUMBNAIL_MAX_SIZE): Promise<string> {
  const bitmap = await createImageBitmap(blob)
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context unavailable')
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()

  return new Promise((resolve, reject) => {
    canvas.toBlob((thumbBlob) => {
      if (!thumbBlob) {
        reject(new Error('Thumbnail generation failed'))
        return
      }
      resolve(URL.createObjectURL(thumbBlob))
    }, 'image/jpeg', 0.8)
  })
}

/**
 * All processing happens in the browser: HEIC is decoded to JPEG via the
 * heic2any WASM build, EXIF dates are read from the file directly, and
 * nothing is ever sent to a server.
 */
export async function processPhoto(
  file: File,
  id: string,
  options: ProcessingOptions,
): Promise<ProcessPhotoResult> {
  const outputFilename = outputFilenameFor(file, options)
  try {
    const exifDate = await extractExifDate(file)
    const { date, source: dateSource } = resolveDate(exifDate, file.lastModified)

    const sourceIsHeic = isHeic(file)
    // Squarify needs to rasterize regardless of the convert toggle, since it
    // has to draw the image onto a canvas either way.
    const decodedForOutput = sourceIsHeic && (options.convertHeic || options.squarify)

    let outputBlob: Blob = decodedForOutput ? await decodeHeicToJpeg(file) : file
    if (options.squarify) {
      outputBlob = await squarifyImage(outputBlob)
    }

    // Thumbnails need a browser-renderable blob even when the export stays
    // untouched HEIC (convertHeic and squarify both off) - decode a
    // throwaway copy just for the preview in that case.
    const previewBlob = sourceIsHeic && !decodedForOutput ? await decodeHeicToJpeg(file, 0.7) : outputBlob
    const thumbnailUrl = await makeThumbnail(previewBlob)

    return {
      id,
      originalFilename: file.name,
      outputFilename,
      exifDate: date,
      dateSource,
      status: 'done',
      error: null,
      thumbnailUrl,
      outputBlob,
    }
  } catch (err) {
    return {
      id,
      originalFilename: file.name,
      outputFilename,
      exifDate: null,
      dateSource: null,
      status: 'failed',
      error: err instanceof Error ? err.message : 'Processing failed',
      thumbnailUrl: null,
      outputBlob: null,
    }
  }
}
