import { describe, expect, it } from 'vitest'
import { resolveQuality } from './quality'

describe('resolveQuality', () => {
  it('uses the fallback when reduceQuality is off', () => {
    expect(resolveQuality({ reduceQuality: false, qualityPercent: 20 }, 0.9)).toBe(0.9)
  })

  it('converts the percent slider to a 0-1 quality when reduceQuality is on', () => {
    expect(resolveQuality({ reduceQuality: true, qualityPercent: 75 }, 0.9)).toBe(0.75)
  })

  it('clamps out-of-range percent values', () => {
    expect(resolveQuality({ reduceQuality: true, qualityPercent: 0 }, 0.9)).toBe(0.01)
    expect(resolveQuality({ reduceQuality: true, qualityPercent: 150 }, 0.9)).toBe(1)
  })
})
