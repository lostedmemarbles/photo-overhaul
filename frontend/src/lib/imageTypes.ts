export const ACCEPTED_IMAGE_EXTENSIONS = ['.heic', '.heif', '.jpg', '.jpeg', '.png']

const EXTENSION_TO_MIME: Record<string, string> = {
  '.heic': 'image/heic',
  '.heif': 'image/heif',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
}

export function isImageFilename(name: string): boolean {
  const lower = name.toLowerCase()
  return ACCEPTED_IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext))
}

export function mimeTypeForFilename(name: string): string {
  const lower = name.toLowerCase()
  const ext = ACCEPTED_IMAGE_EXTENSIONS.find((e) => lower.endsWith(e))
  return (ext && EXTENSION_TO_MIME[ext]) || 'application/octet-stream'
}
