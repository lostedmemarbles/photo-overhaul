// heic2any assumes a real DOM: it references `window`, and encodes the
// decoded pixels to JPEG via document.createElement("canvas") + canvas.toBlob(...).
// Neither exists in a Worker. Shim both - OffscreenCanvas is close enough to
// a real canvas (toBlob -> convertToBlob) to satisfy it. If a future
// heic2any version probes for some other DOM API we haven't stubbed here,
// the catch-all branch below returns an inert object instead of throwing;
// heicWorkerPool.ts falls back to a main-thread decode if a job still fails,
// so a shim gap degrades to "slower" rather than "broken."
;(self as unknown as { window: typeof self }).window = self
;(self as unknown as { document: unknown }).document = {
  createElement(tag: string) {
    if (tag === 'canvas') {
      const canvas = new OffscreenCanvas(1, 1) as OffscreenCanvas & {
        toBlob?: (cb: (b: Blob | null) => void, type?: string, quality?: number) => void
      }
      canvas.toBlob = (cb, type, quality) => {
        canvas.convertToBlob({ type, quality }).then(cb).catch(() => cb(null))
      }
      return canvas
    }
    return {
      style: {},
      setAttribute() {},
      addEventListener() {},
      removeEventListener() {},
      canPlayType() {
        return ''
      },
    }
  },
}

export interface HeicDecodeRequest {
  id: number
  blob: Blob
  quality: number
}

export interface HeicDecodeResponse {
  id: number
  ok: boolean
  blob?: Blob
  error?: string
}

self.onmessage = async (e: MessageEvent<HeicDecodeRequest>) => {
  const { id, blob, quality } = e.data
  try {
    const { default: heic2any } = await import('heic2any')
    const converted = await heic2any({ blob, toType: 'image/jpeg', quality })
    const result = Array.isArray(converted) ? converted[0] : converted
    const response: HeicDecodeResponse = { id, ok: true, blob: result }
    self.postMessage(response)
  } catch (err) {
    const response: HeicDecodeResponse = {
      id,
      ok: false,
      error: err instanceof Error ? err.message : JSON.stringify(err, Object.getOwnPropertyNames(err ?? {})),
    }
    self.postMessage(response)
  }
}
