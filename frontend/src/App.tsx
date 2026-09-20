import { useCallback, useMemo, useRef, useState } from 'react'
import { DateGroups } from './components/DateGroup'
import { DuplicatesPanel } from './components/DuplicatesPanel'
import { OptionsPanel } from './components/OptionsPanel'
import { PhotoGrid } from './components/PhotoGrid'
import { UploadDropzone } from './components/UploadDropzone'
import { buildOrganizedZip } from './lib/buildZip'
import { findDuplicateGroups, idsToAutoExclude } from './lib/duplicates'
import { compareSizes, formatSizeComparison } from './lib/formatSize'
import { sha256Hex } from './lib/hash'
import { processPhoto } from './lib/processPhoto'
import type { ProcessedPhoto, ProcessingOptions } from './lib/types'

const DEFAULT_OPTIONS: ProcessingOptions = {
  sortByDate: true,
  convertHeic: true,
  squarify: false,
  reduceQuality: false,
  qualityPercent: 75,
}

// Options that change the actual output bytes, so an already-processed photo
// needs to be re-run through processPhoto when one of them changes.
// sortByDate is deliberately excluded - it's applied live at render/zip time
// (see DateGroups/buildOrganizedZip), no reprocessing needed.
const OUTPUT_AFFECTING_KEYS = ['convertHeic', 'squarify', 'reduceQuality', 'qualityPercent'] as const

const REPROCESS_DEBOUNCE_MS = 400

let nextId = 0
function makeId(): string {
  nextId += 1
  return `photo-${nextId}`
}

export function App() {
  const [options, setOptions] = useState<ProcessingOptions>(DEFAULT_OPTIONS)
  const [photos, setPhotos] = useState<ProcessedPhoto[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [isZipping, setIsZipping] = useState(false)
  const processingToken = useRef(0)
  const sourceFiles = useRef(new Map<string, File>())
  const reprocessTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return

      const token = ++processingToken.current
      const ids = files.map(() => makeId())
      files.forEach((file, i) => sourceFiles.current.set(ids[i], file))

      const pending: ProcessedPhoto[] = files.map((file, i) => ({
        id: ids[i],
        originalFilename: file.name,
        outputFilename: file.name,
        exifDate: null,
        dateSource: null,
        status: 'pending',
        error: null,
        thumbnailUrl: null,
        outputBlob: null,
        contentHash: null,
        excluded: false,
        originalSize: file.size,
      }))
      setPhotos((prev) => [...prev, ...pending])
      setIsProcessing(true)

      // Hash immediately (cheap) so duplicate badges show up before the
      // slower per-photo processing (HEIC decode etc.) even finishes.
      const hashes = await Promise.all(files.map((f) => sha256Hex(f)))
      if (processingToken.current !== token) return
      setPhotos((prev) =>
        prev.map((p) => {
          const i = ids.indexOf(p.id)
          return i === -1 ? p : { ...p, contentHash: hashes[i] }
        }),
      )

      // Processed sequentially - HEIC WASM decoding is memory-heavy, and this
      // keeps progress visibly updating one photo at a time in the gallery.
      for (let i = 0; i < files.length; i++) {
        const result = await processPhoto(files[i], ids[i], options)
        if (processingToken.current !== token) return // a newer batch superseded this one
        setPhotos((prev) =>
          prev.map((p) => (p.id === result.id ? { ...result, contentHash: p.contentHash, excluded: p.excluded } : p)),
        )
      }
      setIsProcessing(false)
    },
    [options],
  )

  const reprocessAll = useCallback(async (newOptions: ProcessingOptions) => {
    const entries = [...sourceFiles.current.entries()]
    if (entries.length === 0) return

    const token = ++processingToken.current
    setIsProcessing(true)

    for (const [id, file] of entries) {
      if (processingToken.current !== token) return // superseded by a newer change
      setPhotos((prev) => prev.map((p) => (p.id === id ? { ...p, status: 'processing' } : p)))
      const result = await processPhoto(file, id, newOptions)
      if (processingToken.current !== token) return
      setPhotos((prev) =>
        prev.map((p) => (p.id === result.id ? { ...result, contentHash: p.contentHash, excluded: p.excluded } : p)),
      )
    }
    setIsProcessing(false)
  }, [])

  const handleOptionsChange = useCallback(
    (newOptions: ProcessingOptions) => {
      const affectsOutput = OUTPUT_AFFECTING_KEYS.some((key) => newOptions[key] !== options[key])
      setOptions(newOptions)

      // Only schedule a reprocess if there's already something to reprocess -
      // otherwise a setting changed just before the first upload can fire its
      // debounced reprocess AFTER that upload lands, redundantly re-running
      // (and visibly flickering) photos that were already processed correctly
      // with the current settings the first time.
      if (affectsOutput && sourceFiles.current.size > 0) {
        // Debounced so dragging the quality slider doesn't kick off a decode
        // pass on every tick - only the value you settle on actually runs.
        if (reprocessTimer.current) clearTimeout(reprocessTimer.current)
        reprocessTimer.current = setTimeout(() => reprocessAll(newOptions), REPROCESS_DEBOUNCE_MS)
      }
    },
    [options, reprocessAll],
  )

  const toggleExcluded = useCallback((id: string) => {
    setPhotos((prev) => prev.map((p) => (p.id === id ? { ...p, excluded: !p.excluded } : p)))
  }, [])

  const autoRemoveDuplicates = useCallback(() => {
    setPhotos((prev) => {
      const toExclude = idsToAutoExclude(findDuplicateGroups(prev))
      return prev.map((p) => (toExclude.has(p.id) ? { ...p, excluded: true } : p))
    })
  }, [])

  const handleReset = useCallback(() => {
    if (reprocessTimer.current) clearTimeout(reprocessTimer.current)
    processingToken.current++ // invalidate any in-flight processing loop
    sourceFiles.current.clear()
    setPhotos((prev) => {
      for (const p of prev) if (p.thumbnailUrl) URL.revokeObjectURL(p.thumbnailUrl)
      return []
    })
    setOptions(DEFAULT_OPTIONS)
    setIsProcessing(false)
    setIsZipping(false)
  }, [])

  const handleDownload = useCallback(async () => {
    setIsZipping(true)
    try {
      const zipBlob = await buildOrganizedZip(photos, options.sortByDate)
      const url = URL.createObjectURL(zipBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'organized-photos.zip'
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setIsZipping(false)
    }
  }, [photos, options.sortByDate])

  const canReset = photos.length > 0 || JSON.stringify(options) !== JSON.stringify(DEFAULT_OPTIONS)
  const duplicateGroups = useMemo(() => findDuplicateGroups(photos), [photos])
  const doneCount = photos.filter((p) => p.status === 'done').length
  const failedCount = photos.filter((p) => p.status === 'failed').length
  const donePhotos = photos.filter((p) => p.status === 'done')
  const includedPhotos = donePhotos.filter((p) => !p.excluded)
  const includedCount = includedPhotos.length

  // "Before" is a fixed baseline: every photo that was actually uploaded and
  // processed, regardless of duplicate exclusion. "After" is live and tracks
  // your current selection, so unchecking a duplicate shrinks only that side -
  // together they show both savings from compression AND from deduping.
  const showSizeComparison = (options.convertHeic || options.reduceQuality) && donePhotos.length > 0
  const sizeComparison = showSizeComparison
    ? compareSizes(
        donePhotos.reduce((sum, p) => sum + (p.originalSize || 0), 0),
        includedPhotos.reduce((sum, p) => sum + (p.outputBlob?.size ?? p.originalSize ?? 0), 0),
      )
    : null

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '1.5rem' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
        <div>
          <h1 style={{ marginBottom: 0 }}>Photo Organizer</h1>
          <p style={{ color: '#666', marginTop: '0.25rem' }}>
            Everything happens in your browser! Photos are never uploaded anywhere.
          </p>
        </div>
        <button onClick={handleReset} disabled={!canReset} title="Remove all photos and reset options to their defaults">
          Reset
        </button>
      </header>

      <main style={{ marginTop: '1.5rem' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <OptionsPanel options={options} onChange={handleOptionsChange} />
        </div>

        <UploadDropzone onFilesSelected={handleFiles} disabled={isProcessing} />

        {photos.length > 0 && (
          <div style={{ marginTop: '1.5rem' }}>
            <DuplicatesPanel
              groups={duplicateGroups}
              onToggleExcluded={toggleExcluded}
              onAutoRemove={autoRemoveDuplicates}
            />

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
              <p style={{ margin: 0 }}>
                {doneCount}/{photos.length} processed
                {failedCount > 0 && <span style={{ color: 'crimson' }}> ({failedCount} failed)</span>}
                {includedCount !== doneCount && <span> · {includedCount} will be included in the zip</span>}
              </p>
              <button onClick={handleDownload} disabled={includedCount === 0 || isZipping}>
                {isZipping ? 'Building zip…' : 'Download organized zip'}
              </button>
            </div>
            {sizeComparison && (
              <p style={{ margin: '0 0 1rem', fontSize: '0.9rem', color: '#444' }}>
                Total size: {formatSizeComparison(sizeComparison)}
              </p>
            )}
            {options.sortByDate ? <DateGroups photos={photos} /> : <PhotoGrid photos={photos} />}
          </div>
        )}
      </main>
    </div>
  )
}
