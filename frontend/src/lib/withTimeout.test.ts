import { describe, expect, it } from 'vitest'
import { TimeoutError, withTimeout } from './withTimeout'

describe('withTimeout', () => {
  it('resolves normally when the promise finishes before the timeout', async () => {
    const result = await withTimeout(Promise.resolve('done'), 1000)
    expect(result).toBe('done')
  })

  it('rejects with the original error if the promise rejects before the timeout', async () => {
    await expect(withTimeout(Promise.reject(new Error('boom')), 1000)).rejects.toThrow('boom')
  })

  it('rejects with TimeoutError if the promise never settles in time', async () => {
    const neverSettles = new Promise(() => {})
    await expect(withTimeout(neverSettles, 20, 'took too long')).rejects.toBeInstanceOf(TimeoutError)
    await expect(withTimeout(neverSettles, 20, 'took too long')).rejects.toThrow('took too long')
  })
})
