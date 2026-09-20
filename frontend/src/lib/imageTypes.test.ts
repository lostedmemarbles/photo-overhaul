import { describe, expect, it } from 'vitest'
import { isImageFilename, mimeTypeForFilename } from './imageTypes'

describe('isImageFilename', () => {
  it('accepts known photo extensions case-insensitively', () => {
    expect(isImageFilename('photo.jpg')).toBe(true)
    expect(isImageFilename('PHOTO.JPG')).toBe(true)
    expect(isImageFilename('photo.HEIC')).toBe(true)
    expect(isImageFilename('photo.png')).toBe(true)
  })

  it('rejects non-photo files', () => {
    expect(isImageFilename('readme.txt')).toBe(false)
    expect(isImageFilename('video.mov')).toBe(false)
    expect(isImageFilename('archive.zip')).toBe(false)
  })
})

describe('mimeTypeForFilename', () => {
  it('maps extensions to the right mime type', () => {
    expect(mimeTypeForFilename('a.jpg')).toBe('image/jpeg')
    expect(mimeTypeForFilename('a.jpeg')).toBe('image/jpeg')
    expect(mimeTypeForFilename('a.png')).toBe('image/png')
    expect(mimeTypeForFilename('a.heic')).toBe('image/heic')
  })

  it('falls back to a generic type for unknown extensions', () => {
    expect(mimeTypeForFilename('a.txt')).toBe('application/octet-stream')
  })
})
