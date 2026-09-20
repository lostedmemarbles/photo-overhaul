import type { ProcessedPhoto } from './types'

/** Groups photos sharing an identical content hash (byte-for-byte duplicates), across the whole session. */
export function findDuplicateGroups(photos: ProcessedPhoto[]): ProcessedPhoto[][] {
  const byHash = new Map<string, ProcessedPhoto[]>()
  for (const photo of photos) {
    if (!photo.contentHash) continue
    if (!byHash.has(photo.contentHash)) byHash.set(photo.contentHash, [])
    byHash.get(photo.contentHash)!.push(photo)
  }
  return [...byHash.values()].filter((group) => group.length > 1)
}

/** IDs to exclude if auto-dedupe keeps only the first (earliest-added) copy in each group. */
export function idsToAutoExclude(groups: ProcessedPhoto[][]): Set<string> {
  return new Set(groups.flatMap((group) => group.slice(1).map((p) => p.id)))
}
