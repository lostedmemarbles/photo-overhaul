import { describe, expect, it } from 'vitest'
import { groupByDate } from './groupByDate'
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
    originalSize: 1000,
    converted: false,
    ...overrides,
  }
}

describe('groupByDate', () => {
  it('groups photos by exifDate and sorts newest first', () => {
    const photos = [
      photo({ id: '1', exifDate: '2022-01-01' }),
      photo({ id: '2', exifDate: '2023-07-04' }),
      photo({ id: '3', exifDate: '2023-07-04' }),
    ]

    const groups = groupByDate(photos)

    expect(groups.map(([key]) => key)).toEqual(['2023-07-04', '2022-01-01'])
    expect(groups[0][1].map((p) => p.id)).toEqual(['2', '3'])
  })

  it('buckets photos with no exifDate under "Unknown date"', () => {
    const groups = groupByDate([photo({ id: '1', exifDate: null })])
    expect(groups).toEqual([['Unknown date', [photo({ id: '1', exifDate: null })]]])
  })

  it('groups by year-month instead of the exact day when granularity is "month"', () => {
    const photos = [
      photo({ id: '1', exifDate: '2023-07-04' }),
      photo({ id: '2', exifDate: '2023-07-19' }),
      photo({ id: '3', exifDate: '2022-01-01' }),
    ]

    const groups = groupByDate(photos, 'month')

    expect(groups.map(([key]) => key)).toEqual(['2023-07', '2022-01'])
    expect(groups[0][1].map((p) => p.id)).toEqual(['1', '2'])
  })

  it('groups by year only when granularity is "year"', () => {
    const photos = [
      photo({ id: '1', exifDate: '2023-07-04' }),
      photo({ id: '2', exifDate: '2023-01-19' }),
      photo({ id: '3', exifDate: '2022-01-01' }),
    ]

    const groups = groupByDate(photos, 'year')

    expect(groups.map(([key]) => key)).toEqual(['2023', '2022'])
    expect(groups[0][1].map((p) => p.id)).toEqual(['1', '2'])
  })
})
