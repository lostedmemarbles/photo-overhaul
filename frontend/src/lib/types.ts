export type PhotoStatus = 'pending' | 'processing' | 'done' | 'failed'

// 'exif' = read from the photo's own metadata (reliable, the capture date).
// 'file-modified' = no EXIF date was found, so we fell back to the file's
// last-modified timestamp - this is often just the download/save date (e.g.
// for photos from social media, which strips EXIF), not when the photo was
// actually taken. Surfaced in the UI so it doesn't read as an exact date.
export type DateSource = 'exif' | 'file-modified'

// Folder depth when sortByDate is on: 'year' -> YYYY/, 'month' -> YYYY/YYYY-MM/,
// 'day' -> YYYY/YYYY-MM/YYYY-MM-DD/.
export type DateGranularity = 'year' | 'month' | 'day'

export interface ProcessingOptions {
  sortByDate: boolean
  dateGranularity: DateGranularity // only used when sortByDate is true
  convertHeic: boolean
  squarify: boolean
  reduceQuality: boolean
  qualityPercent: number // 1-100 JPEG compression level; only used when reduceQuality is true
  checkDuplicates: boolean
  autoRemoveDuplicates: boolean // only used when checkDuplicates is true - excludes all but one copy of each duplicate found, without manual review
}

export interface ProcessedPhoto {
  id: string
  originalFilename: string
  outputFilename: string
  exifDate: string | null // ISO yyyy-mm-dd, or null if no date could be determined at all
  dateSource: DateSource | null
  status: PhotoStatus
  error: string | null
  thumbnailUrl: string | null
  outputBlob: Blob | null
  contentHash: string | null // SHA-256 of the original file's raw bytes, for exact-duplicate detection
  excluded: boolean // true if the user (or auto-dedupe) chose to leave this out of the download
  originalSize: number // bytes of the original uploaded file, for the before/after size comparison
  converted: boolean // true if processing actually replaced the original bytes (HEIC decode, squarify, or a smaller recompress) - false means outputBlob is the untouched original
}
