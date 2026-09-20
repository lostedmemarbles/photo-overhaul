import { describe, expect, it } from 'vitest'
import { expandZipFiles, isZipFile, type ZipEntryFile } from './expandZips'

describe('isZipFile', () => {
  it('detects zips by mime type', () => {
    expect(isZipFile({ name: 'whatever', type: 'application/zip' })).toBe(true)
  })

  it('detects zips by extension when mime type is generic/empty', () => {
    expect(isZipFile({ name: 'photos.zip', type: '' })).toBe(true)
    expect(isZipFile({ name: 'PHOTOS.ZIP', type: '' })).toBe(true)
  })

  it('does not flag ordinary image files', () => {
    expect(isZipFile({ name: 'photo.jpg', type: 'image/jpeg' })).toBe(false)
  })
})

describe('expandZipFiles', () => {
  function fakeFile(name: string, type: string): ZipEntryFile {
    return { name, type, arrayBuffer: async () => new ArrayBuffer(4) }
  }

  it('sorts a loose image file into images', async () => {
    const image = fakeFile('a.jpg', 'image/jpeg')
    expect(await expandZipFiles([image])).toEqual({ images: [image], passthrough: [] })
  })

  it('sorts a loose non-photo file into passthrough', async () => {
    const doc = fakeFile('notes.txt', 'text/plain')
    expect(await expandZipFiles([doc])).toEqual({ images: [], passthrough: [doc] })
  })

  it('treats a corrupt/unparsable zip as a passthrough file instead of throwing', async () => {
    const brokenZip = fakeFile('broken.zip', 'application/zip')
    expect(await expandZipFiles([brokenZip])).toEqual({ images: [], passthrough: [brokenZip] })
  })
})
