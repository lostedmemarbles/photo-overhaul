import { describe, expect, it } from 'vitest'
import { sha256Hex, sha256HexSafe } from './hash'

function fakeFile(bytes: number[]): { arrayBuffer: () => Promise<ArrayBuffer> } {
  return { arrayBuffer: async () => new Uint8Array(bytes).buffer }
}

describe('sha256Hex', () => {
  it('hashes consistently and matches a known SHA-256 value', async () => {
    // sha256("abc") is a well-known test vector.
    const file = fakeFile([0x61, 0x62, 0x63])
    const hash = await sha256Hex(file as unknown as File)
    expect(hash).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })

  it('produces different hashes for different content', async () => {
    const a = await sha256Hex(fakeFile([1, 2, 3]) as unknown as File)
    const b = await sha256Hex(fakeFile([1, 2, 4]) as unknown as File)
    expect(a).not.toBe(b)
  })
})

describe('sha256HexSafe', () => {
  it('resolves the real hash for a normal file', async () => {
    const file = fakeFile([1, 2, 3])
    expect(await sha256HexSafe(file as unknown as File)).toBe(await sha256Hex(file as unknown as File))
  })

  it('resolves to null instead of hanging forever when reading the file never settles', async () => {
    const hungFile = { arrayBuffer: () => new Promise<ArrayBuffer>(() => {}) }
    const result = await sha256HexSafe(hungFile as unknown as File, 20) // short timeout for a fast test
    expect(result).toBeNull()
  })

  it('resolves to null instead of throwing when reading the file fails', async () => {
    const brokenFile = {
      arrayBuffer: () => Promise.reject(new Error('read failed')),
    }
    expect(await sha256HexSafe(brokenFile as unknown as File)).toBeNull()
  })
})
