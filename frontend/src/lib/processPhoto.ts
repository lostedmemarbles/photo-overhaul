import exifr from 'exifr'
import heic2any from 'heic2any'
import { resolveDate, toIsoDate } from './dates'
import { resolveQuality } from './quality'
import type { ProcessedPhoto, ProcessingOptions } from './types'

// contentHash/excluded are managed by the caller (App.tsx), which computes
// the hash up front for instant duplicate detection and owns exclusion state.
export type ProcessPhotoResult = Omit<ProcessedPhoto, 'contentHash' | 'excluded'>

const HEIC_EXTENSIONS = ['.heic', '.heif']
const HEIC_TYPES = ['image/heic', 'image/heif']
const THUMBNAIL_MAX_SIZE = 320
const SQUARIFY_BACKGROUND = '#000000'
const DEFAULT_HEIC_QUALITY = 0.9
const DEFAULT_SQUARIFY_QUALITY = 0.92
const DEFAULT_RECOMPRESS_QUALITY = 0.9

function isHeic(file: File): boolean {
  const name = file.name.toLowerCase()
  return HEIC_TYPES.includes(file.type.toLowerCase()) || HEIC_EXTENSIONS.some((ext) => name.endsWith(ext))
}

function stripExtension(name: string): string {
  return name.replace(/\.[^./\\]+$/, '')
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
async function squarifyImage(blob: Blob, quality: number): Promise<Blob> {
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
      quality,
    )
  })
}

/** Redraws an image at its original size, re-encoding at the given JPEG quality - for the
 *  "reduce quality" option on photos that would otherwise pass through untouched. */
async function recompressImage(blob: Blob, quality: number): Promise<Blob> {
  const bitmap = await createImageBitmap(blob)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context unavailable')
  ctx.drawImage(bitmap, 0, 0)
  bitmap.close()

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (out) => (out ? resolve(out) : reject(new Error('Recompress failed'))),
      'image/jpeg',
      quality,
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
  try {
    const exifDate = await extractExifDate(file)
    const { date, source: dateSource } = resolveDate(exifDate, file.lastModified)

    const sourceIsHeic = isHeic(file)
    // 100% means "whatever quality it already had" - quality reduction only
    // ever kicks in below that, so it can only ever shrink a file, never grow one.
    const effectiveReduceQuality = options.reduceQuality && options.qualityPercent < 100

    // Squarify and (sub-100%) quality reduction both need to rasterize HEIC
    // regardless of the convert toggle, since they have to draw onto a canvas
    // either way. Decoded once - also reused for the thumbnail below, even if
    // quality reduction later falls back to the original HEIC bytes for output.
    const needsHeicDecode = sourceIsHeic && (options.convertHeic || options.squarify || effectiveReduceQuality)
    const decodedJpeg = needsHeicDecode
      ? await decodeHeicToJpeg(file, resolveQuality(options, DEFAULT_HEIC_QUALITY))
      : null

    let outputBlob: Blob = decodedJpeg ?? file
    let outputIsJpeg = decodedJpeg !== null

    if (options.squarify) {
      outputBlob = await squarifyImage(outputBlob, resolveQuality(options, DEFAULT_SQUARIFY_QUALITY))
      outputIsJpeg = true
    } else if (effectiveReduceQuality) {
      if (sourceIsHeic) {
        // JPEG can lose to HEIC's more efficient compression for some images.
        // If conversion wasn't independently requested via "Convert HEIC,"
        // quality reduction should never hand back something bigger than the
        // upload - fall back to the untouched original in that case.
        if (!options.convertHeic && outputBlob.size >= file.size) {
          outputBlob = file
          outputIsJpeg = false
        }
      } else {
        const candidate = await recompressImage(outputBlob, resolveQuality(options, DEFAULT_RECOMPRESS_QUALITY))
        if (candidate.size < outputBlob.size) {
          outputBlob = candidate
          outputIsJpeg = true
        }
      }
    }

    const outputFilename = outputIsJpeg ? `${stripExtension(file.name)}.jpg` : file.name

    // Thumbnails need a browser-renderable blob even when the export stays
    // untouched HEIC - reuse the decode above if we already have it.
    const previewBlob = sourceIsHeic ? (decodedJpeg ?? (await decodeHeicToJpeg(file, 0.7))) : outputBlob
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
      originalSize: file.size,
    }
  } catch (err) {
    return {
      id,
      originalFilename: file.name,
      outputFilename: file.name,
      exifDate: null,
      dateSource: null,
      status: 'failed',
      error: err instanceof Error ? err.message : 'Processing failed',
      thumbnailUrl: null,
      outputBlob: null,
      originalSize: file.size,
    }
  }
}
