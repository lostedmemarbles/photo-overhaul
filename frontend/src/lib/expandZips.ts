import JSZip from 'jszip'
import { isImageFilename, mimeTypeForFilename } from './imageTypes'
import { withTimeout } from './withTimeout'

// A single real photo, even a large one, decompresses in well under a
// second. If one entry hasn't come back in this long, treat it as stuck
// (a pathological/corrupt entry sending JSZip's inflate into a spin) rather
// than block every other entry - and every zip queued behind it - forever.
// Same defense-in-depth pattern already used for hashing and HEIC decoding.
const ENTRY_EXTRACT_TIMEOUT_MS = 30_000

// Structural subset of File - lets tests pass a lightweight stand-in instead
// of needing a real DOM File (not available in the Node test environment).
export interface ZipEntryFile {
  name: string
  type: string
  arrayBuffer(): Promise<ArrayBuffer>
}

export interface ExpandedFiles {
  images: File[]
  // Anything that isn't a recognized photo type - rides along into the
  // output zip unchanged (see buildZip.ts) rather than being dropped, so
  // nothing from an uploaded zip/folder goes missing.
  passthrough: File[]
  // Names of uploaded zips that couldn't be read at all (e.g. a multi-GB
  // zip that exceeds available memory just to read its raw bytes) -
  // intentionally excluded rather than passed through, since a second read
  // attempt at zip-build time would only fail the same way again.
  failedZips: string[]
}

const JUNK_PATH_PATTERNS = [
  /^__MACOSX\//, // macOS's zip metadata folder
  /(^|\/)\.[^/]+$/, // dotfiles like .DS_Store, at any depth
]

export function isZipFile(file: Pick<ZipEntryFile, 'name' | 'type'>): boolean {
  return file.type === 'application/zip' || file.name.toLowerCase().endsWith('.zip')
}

function isJunkPath(path: string): boolean {
  return JUNK_PATH_PATTERNS.some((re) => re.test(path))
}

/** Extracts from an already-read buffer (see expandZipFiles - the initial
 *  raw read is split out so a failure there can be told apart from a
 *  failure here: the former means a second read would fail identically,
 *  the latter means the bytes are fine, just not a valid zip). */
async function extractFromZipBuffer(buf: ArrayBuffer): Promise<Omit<ExpandedFiles, 'failedZips'>> {
  const zip = await JSZip.loadAsync(buf)
  const images: File[] = []
  const passthrough: File[] = []

  for (const [path, entry] of Object.entries(zip.files)) {
    if (entry.dir || isJunkPath(path)) continue
    const filename = path.split('/').pop() ?? path

    let blob: Blob
    try {
      blob = await withTimeout(entry.async('blob'), ENTRY_EXTRACT_TIMEOUT_MS, 'Zip entry extraction timed out')
    } catch (err) {
      console.warn(`[expandZips] skipping "${path}" - failed to extract:`, err)
      continue
    }
    const lastModified = entry.date instanceof Date ? entry.date.getTime() : Date.now()

    if (isImageFilename(filename)) {
      images.push(new File([blob], filename, { type: mimeTypeForFilename(filename), lastModified }))
    } else {
      passthrough.push(new File([blob], filename, { lastModified }))
    }
  }

  return { images, passthrough }
}

/** Unpacks zips into the images and other files they contain; non-zip files
 *  are sorted the same way (image vs. passthrough) without being unpacked.
 *  A zip that reads fine but fails to parse (corrupt, or not really a zip)
 *  is treated as a passthrough file itself instead of throwing, so it still
 *  ends up in the output rather than stalling the whole upload. A zip whose
 *  raw bytes can't even be read (e.g. too large for available memory) is
 *  reported via failedZips instead - see extractFromZipBuffer for why.
 *
 *  Zips are extracted one at a time, not concurrently: a zip's raw bytes plus
 *  every entry decompressed from it have to stay resident in memory for the
 *  whole extraction, so extracting several large zips in parallel (e.g. a
 *  multi-gigabyte multi-zip upload) multiplies peak memory by however many
 *  are uploaded together instead of holding just one at a time. */
export async function expandZipFiles(files: ZipEntryFile[]): Promise<ExpandedFiles> {
  const images: File[] = []
  const passthrough: File[] = []
  const failedZips: string[] = []

  for (const file of files) {
    if (!isZipFile(file)) {
      if (isImageFilename(file.name)) images.push(file as File)
      else passthrough.push(file as File)
      continue
    }

    let buf: ArrayBuffer
    try {
      buf = await file.arrayBuffer()
    } catch (err) {
      console.warn(`[expandZips] "${file.name}" could not be read (likely too large for available memory):`, err)
      failedZips.push(file.name)
      continue
    }

    try {
      const expanded = await extractFromZipBuffer(buf)
      images.push(...expanded.images)
      passthrough.push(...expanded.passthrough)
    } catch {
      passthrough.push(file as File)
    }
  }

  return { images, passthrough, failedZips }
}
