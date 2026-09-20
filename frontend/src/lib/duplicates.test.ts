import { describe, expect, it } from 'vitest'
import { findDuplicateGroups, idsToAutoExclude } from './duplicates'
import type { ProcessedPhoto } from './types'

function photo(overrides: Partial<ProcessedPhoto>): ProcessedPhoto {
  return {
    id: overrides.id ?? Math.random().toString(),
    originalFilename: 'a.jpg',
    outputFilename: 'a.jpg',
    exifDate: null,
    dateSource: null,
    status: 'done',
    error: null,
    thumbnailUrl: null,
    outputBlob: null,
    contentHash: null,
    excluded: false,
    ...overrides,
  }
}

describe('findDuplicateGroups', () => {
  it('groups photos that share a content hash', () => {
    const photos = [
      photo({ id: '1', contentHash: 'hashA' }),
      photo({ id: '2', contentHash: 'hashB' }),
      photo({ id: '3', contentHash: 'hashA' }),
    ]
    const groups = findDuplicateGroups(photos)
    expect(groups).toHaveLength(1)
    expect(groups[0].map((p) => p.id)).toEqual(['1', '3'])
  })

  it('ignores photos with no hash yet (still processing) and unique hashes', () => {
    const photos = [photo({ id: '1', contentHash: null }), photo({ id: '2', contentHash: 'hashC' })]
    expect(findDuplicateGroups(photos)).toEqual([])
  })
})

describe('idsToAutoExclude', () => {
  it('keeps the first photo in each group and excludes the rest', () => {
    const groups = [
      [photo({ id: '1' }), photo({ id: '2' }), photo({ id: '3' })],
      [photo({ id: '4' }), photo({ id: '5' })],
    ]
    expect(idsToAutoExclude(groups)).toEqual(new Set(['2', '3', '5']))
  })
})
