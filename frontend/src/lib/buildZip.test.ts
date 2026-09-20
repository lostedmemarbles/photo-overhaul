import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import { archivePathFor, buildOrganizedZip } from './buildZip'
import type { ProcessedPhoto } from './types'

function donePhoto(overrides: Partial<ProcessedPhoto>): ProcessedPhoto {
  return {
    id: overrides.id ?? Math.random().toString(),
    originalFilename: 'a.jpg',
    outputFilename: 'a.jpg',
    exifDate: null,
    dateSource: null,
    status: 'done',
    error: null,
    thumbnailUrl: null,
    outputBlob: new Blob(['bytes']),
    contentHash: null,
    excluded: false,
    ...overrides,
  }
}

async function fileEntryNames(zipBlob: Blob): Promise<string[]> {
  const zip = await JSZip.loadAsync(await zipBlob.arrayBuffer())
  return Object.values(zip.files).filter((f) => !f.dir).map((f) => f.name)
}

describe('archivePathFor', () => {
  it('groups by year/date when sorting by date and exifDate is present', () => {
    expect(archivePathFor({ exifDate: '2023-07-04', outputFilename: 'img.jpg' }, true)).toBe(
      '2023/2023-07-04/img.jpg',
    )
  })

  it('falls back to unknown/ when sorting by date but exifDate is missing', () => {
    expect(archivePathFor({ exifDate: null, outputFilename: 'img.jpg' }, true)).toBe('unknown/img.jpg')
  })

  it('is flat at the zip root when not sorting by date, regardless of exifDate', () => {
    expect(archivePathFor({ exifDate: '2023-07-04', outputFilename: 'img.jpg' }, false)).toBe('img.jpg')
  })
})

describe('buildOrganizedZip', () => {
  it('includes only done photos with output bytes, nested by date when sortByDate is true', async () => {
    const photos: ProcessedPhoto[] = [
      donePhoto({ id: '1', exifDate: '2023-07-04', outputFilename: 'a.jpg' }),
      donePhoto({ id: '2', exifDate: null, outputFilename: 'b.jpg' }),
      donePhoto({ id: '3', status: 'failed', outputBlob: null, outputFilename: 'c.jpg' }),
      donePhoto({ id: '4', status: 'pending', outputBlob: null, outputFilename: 'd.jpg' }),
    ]

    const names = await fileEntryNames(await buildOrganizedZip(photos, true))
    expect(names.sort()).toEqual(['2023/2023-07-04/a.jpg', 'unknown/b.jpg'])
  })

  it('is flat at the zip root when sortByDate is false', async () => {
    const photos: ProcessedPhoto[] = [
      donePhoto({ id: '1', exifDate: '2023-07-04', outputFilename: 'a.jpg' }),
      donePhoto({ id: '2', exifDate: null, outputFilename: 'b.jpg' }),
    ]

    const names = await fileEntryNames(await buildOrganizedZip(photos, false))
    expect(names.sort()).toEqual(['a.jpg', 'b.jpg'])
  })

  it('skips photos excluded as duplicates', async () => {
    const photos: ProcessedPhoto[] = [
      donePhoto({ id: '1', outputFilename: 'a.jpg' }),
      donePhoto({ id: '2', outputFilename: 'a-copy.jpg', excluded: true }),
    ]

    const names = await fileEntryNames(await buildOrganizedZip(photos, false))
    expect(names).toEqual(['a.jpg'])
  })
})
