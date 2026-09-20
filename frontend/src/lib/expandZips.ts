import JSZip from 'jszip'
import { isImageFilename, mimeTypeForFilename } from './imageTypes'

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

async function extractFromZip(zipFile: ZipEntryFile): Promise<ExpandedFiles> {
  const zip = await JSZip.loadAsync(await zipFile.arrayBuffer())
  const images: File[] = []
  const passthrough: File[] = []

  for (const [path, entry] of Object.entries(zip.files)) {
    if (entry.dir || isJunkPath(path)) continue
    const filename = path.split('/').pop() ?? path

    const blob = await entry.async('blob')
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
 *  A zip that fails to parse (corrupt, or not really a zip) is treated as a
 *  passthrough file itself instead of throwing, so it still ends up in the
 *  output rather than stalling the whole upload. */
export async function expandZipFiles(files: ZipEntryFile[]): Promise<ExpandedFiles> {
  const parts = await Promise.all(
    files.map(async (file): Promise<ExpandedFiles> => {
      if (!isZipFile(file)) {
        return isImageFilename(file.name)
          ? { images: [file as File], passthrough: [] }
          : { images: [], passthrough: [file as File] }
      }
      try {
        return await extractFromZip(file)
      } catch {
        return { images: [], passthrough: [file as File] }
      }
    }),
  )
  return {
    images: parts.flatMap((p) => p.images),
    passthrough: parts.flatMap((p) => p.passthrough),
  }
}
