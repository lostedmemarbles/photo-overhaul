import { describe, expect, it } from 'vitest'
import { runWithConcurrency } from './concurrency'

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

describe('runWithConcurrency', () => {
  it('runs every item exactly once', async () => {
    const seen: number[] = []
    await runWithConcurrency([1, 2, 3, 4, 5], 2, async (item) => {
      await delay(1)
      seen.push(item)
    })
    expect(seen.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5])
  })

  it('never runs more than `limit` at once', async () => {
    let active = 0
    let maxActive = 0
    await runWithConcurrency(Array.from({ length: 8 }, (_, i) => i), 3, async () => {
      active++
      maxActive = Math.max(maxActive, active)
      await delay(5)
      active--
    })
    expect(maxActive).toBeLessThanOrEqual(3)
    expect(maxActive).toBeGreaterThan(1) // sanity check it actually overlapped
  })

  it('handles limit greater than item count without hanging', async () => {
    const seen: number[] = []
    await runWithConcurrency([1, 2], 10, async (item) => {
      seen.push(item)
    })
    expect(seen.sort()).toEqual([1, 2])
  })

  it('handles an empty item list', async () => {
    let called = false
    await runWithConcurrency([], 3, async () => {
      called = true
    })
    expect(called).toBe(false)
  })
})
