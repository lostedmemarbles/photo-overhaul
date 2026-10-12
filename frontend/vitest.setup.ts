// The real app always runs in a browser, where crypto.subtle is native.
// Vitest's Node test environment doesn't expose the global `crypto` the same
// way a plain `node` process does, so polyfill it here for tests that hash
// files (see lib/hash.ts).
import { webcrypto } from 'node:crypto'

if (typeof globalThis.crypto === 'undefined') {
  // @ts-expect-error - Node's webcrypto type is structurally compatible but not identical to the DOM lib's Crypto type
  globalThis.crypto = webcrypto
}
