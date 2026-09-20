import { describe, expect, it } from 'vitest'
import { resolveDate, toIsoDate } from './dates'

describe('toIsoDate', () => {
  it('formats using local calendar date parts, zero-padded', () => {
    expect(toIsoDate(new Date(2023, 0, 4))).toBe('2023-01-04') // month is 0-indexed
  })
})

describe('resolveDate', () => {
  it('prefers the EXIF date when present', () => {
    const result = resolveDate('2023-07-04', new Date(2025, 0, 1).getTime())
    expect(result).toEqual({ date: '2023-07-04', source: 'exif' })
  })

  it('falls back to the file last-modified date when EXIF is missing', () => {
    const lastModified = new Date(2025, 5, 15).getTime()
    const result = resolveDate(null, lastModified)
    expect(result).toEqual({ date: '2025-06-15', source: 'file-modified' })
  })
})
