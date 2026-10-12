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
    expect(await expandZipFiles([image])).toEqual({ images: [image], passthrough: [], failedZips: [] })
  })

  it('sorts a loose non-photo file into passthrough', async () => {
    const doc = fakeFile('notes.txt', 'text/plain')
    expect(await expandZipFiles([doc])).toEqual({ images: [], passthrough: [doc], failedZips: [] })
  })

  it('treats a corrupt/unparsable zip as a passthrough file instead of throwing (its bytes read fine, just aren\'t a valid zip)', async () => {
    const brokenZip = fakeFile('broken.zip', 'application/zip')
    expect(await expandZipFiles([brokenZip])).toEqual({ images: [], passthrough: [brokenZip], failedZips: [] })
  })

  it('reports a zip whose raw bytes cannot even be read as failed, instead of passing it through', async () => {
    const hugeZip: ZipEntryFile = {
      name: 'huge.zip',
      type: 'application/zip',
      arrayBuffer: () => Promise.reject(new Error('not enough memory')),
    }
    expect(await expandZipFiles([hugeZip])).toEqual({ images: [], passthrough: [], failedZips: ['huge.zip'] })
  })
})
