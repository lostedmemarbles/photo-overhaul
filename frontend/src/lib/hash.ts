import { withTimeout } from './withTimeout'

// Hashing a file is normally near-instant (WebCrypto does MB/s-GB/s), even
// for a large real photo - if it hasn't finished in this long, something is
// genuinely wrong (a stuck arrayBuffer() read, browser weirdness) rather
// than just slow.
const HASH_TIMEOUT_MS = 15_000

/** SHA-256 of a file's raw bytes, as hex - used for exact-duplicate detection. */
export async function sha256Hex(file: File): Promise<string> {
  const buf = await file.arrayBuffer()
  const digest = await crypto.subtle.digest('SHA-256', buf)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Same as sha256Hex, but never rejects and never hangs: a timeout or any
 * other failure resolves to null instead. Hashing runs as one big
 * Promise.all across an entire batch (see App.tsx) - without this, a single
 * stuck or failing file would block every other file's hash forever,
 * freezing the whole batch (this exact failure mode is what caused a
 * reported stall). A file that comes back null just sits out of duplicate
 * detection; everything else in the batch still proceeds normally.
 */
export async function sha256HexSafe(file: File, timeoutMs = HASH_TIMEOUT_MS): Promise<string | null> {
  try {
    return await withTimeout(sha256Hex(file), timeoutMs, 'Hashing timed out')
  } catch {
    return null
  }
}
