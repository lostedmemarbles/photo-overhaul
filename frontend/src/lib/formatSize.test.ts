import { describe, expect, it } from 'vitest'
import { compareSizes, formatBytes, formatSizeComparison } from './formatSize'

describe('formatBytes', () => {
  it('formats bytes under 1KB as-is', () => {
    expect(formatBytes(512)).toBe('512 B')
  })

  it('formats KB and MB with sensible precision', () => {
    expect(formatBytes(2048)).toBe('2.0 KB')
    expect(formatBytes(15 * 1024)).toBe('15 KB')
    expect(formatBytes(3.4 * 1024 * 1024)).toBe('3.4 MB')
  })

  it('never renders NaN - treats non-finite input as 0', () => {
    expect(formatBytes(NaN)).toBe('0 B')
    expect(formatBytes(undefined as unknown as number)).toBe('0 B')
    expect(formatBytes(Infinity)).toBe('0 B')
  })
})

describe('compareSizes', () => {
  it('computes a negative percentChange when output is smaller', () => {
    const c = compareSizes(1000, 250)
    expect(c.percentChange).toBe(-75)
  })

  it('computes a positive percentChange when output is larger', () => {
    const c = compareSizes(1000, 1200)
    expect(c.percentChange).toBe(20)
  })

  it('does not divide by zero when there is nothing to compare', () => {
    expect(compareSizes(0, 0).percentChange).toBe(0)
  })

  it('treats non-finite inputs as 0 instead of producing NaN', () => {
    const c = compareSizes(NaN, undefined as unknown as number)
    expect(c).toEqual({ originalBytes: 0, outputBytes: 0, percentChange: 0 })
  })
})

describe('formatSizeComparison', () => {
  it('labels a size reduction as "smaller"', () => {
    expect(formatSizeComparison(compareSizes(1000, 250))).toBe('1000 B → 250 B (75% smaller)')
  })

  it('labels a size increase as "larger"', () => {
    expect(formatSizeComparison(compareSizes(1000, 1200))).toBe('1000 B → 1.2 KB (20% larger)')
  })
})
