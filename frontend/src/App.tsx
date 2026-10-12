import { useCallback, useMemo, useRef, useState } from 'react'
import { DateGroups } from './components/DateGroup'
import { DuplicatesPanel } from './components/DuplicatesPanel'
import { OptionsPanel } from './components/OptionsPanel'
import { PhotoGrid } from './components/PhotoGrid'
import { ProcessingOverlay } from './components/ProcessingOverlay'
import { UploadDropzone } from './components/UploadDropzone'
import { buildOrganizedZip, FAILED_FOLDER, PASSTHROUGH_FOLDER } from './lib/buildZip'
import { runWithConcurrency } from './lib/concurrency'
import { findDuplicateGroups, idsToAutoExclude } from './lib/duplicates'
import { expandZipFiles } from './lib/expandZips'
import { HEIC_DECODE_CONCURRENCY } from './lib/heicWorkerPool'
import { compareSizes, formatSizeComparison } from './lib/formatSize'
import { sha256HexSafe } from './lib/hash'
import { processPhoto, type ProcessPhotoResult } from './lib/processPhoto'
import type { ProcessedPhoto, ProcessingOptions } from './lib/types'

const DEFAULT_OPTIONS: ProcessingOptions = {
  sortByDate: false,
  dateGranularity: 'day',
  convertHeic: false,
  squarify: false,
  reduceQuality: false,
  qualityPercent: 75,
  checkDuplicates: false,
  autoRemoveDuplicates: false,
}

// sha256HexSafe reads a whole file into memory (arrayBuffer()) to hash it.
// Unlike HEIC decoding, hashing has no worker/WASM cost to bound, but running
// it via a bare Promise.all still fires every file's read at once - for a
// large real batch (hundreds of photos, gigabytes total) that's every file's
// bytes resident in memory simultaneously before any paced processing even
// starts. Bounding it the same way processing already is keeps peak memory
// proportional to the concurrency cap, not the batch size.
const HASH_CONCURRENCY = 8

let nextId = 0
function makeId(): string {
  nextId += 1
  return `photo-${nextId}`
}

/**
 * Replaces a photo's stored result with a fresh one from processPhoto,
 * revoking its previous thumbnail object URL first if it's being replaced by
 * a different one (or none). Every reprocess pass (the Process button, or a
 * fresh duplicate-hash pass picking up new matches) calls this - without the
 * revoke, each pass would leak the old blob URL, since previously only a
 * full Reset ever revoked them.
 */
function applyResult(photos: ProcessedPhoto[], result: ProcessPhotoResult): ProcessedPhoto[] {
  return photos.map((p) => {
    if (p.id !== result.id) return p
    if (p.thumbnailUrl && p.thumbnailUrl !== result.thumbnailUrl) {
      URL.revokeObjectURL(p.thumbnailUrl)
    }
    return { ...result, contentHash: p.contentHash, excluded: p.excluded }
  })
}

export function App() {
  const [options, setOptions] = useState<ProcessingOptions>(DEFAULT_OPTIONS)
  const [photos, setPhotos] = useState<ProcessedPhoto[]>([])
  const [passthroughFiles, setPassthroughFiles] = useState<File[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  // Drives the ProcessingOverlay specifically - deliberately separate from
  // deriving counts from `photos`' live status. Reprocessing (options
  // changing, or the duplicate-check backfill) re-runs already-`done`
  // photos, and previously this briefly flipped their status to
  // 'processing' to make the overlay's count dip while they re-ran - which
  // made the displayed count visibly go backwards (e.g. "590/594" ->
  // "587/594") and made the size-total below it flicker too, since both
  // were counting `status === 'done'` photos live. This tracks progress of
  // whatever operation is currently running instead, so it only ever counts
  // up, and leaves each photo's displayed status/size untouched until its
  // fresh result actually lands.
  const [progress, setProgress] = useState({ done: 0, failed: 0, total: 0 })
  const [isZipping, setIsZipping] = useState(false)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const [downloadWarning, setDownloadWarning] = useState<string | null>(null)
  // Zips whose raw bytes couldn't be read at all (e.g. too large for
  // available memory) - reported rather than silently passed through, since
  // a passthrough attempt would just fail identically at zip-build time.
  const [failedZipNames, setFailedZipNames] = useState<string[]>([])
  const processingToken = useRef(0)
  const sourceFiles = useRef(new Map<string, File>())
  // Track content-hash duplicate counts across the whole session so a photo
  // only gets a (relatively expensive) thumbnail decode when it's actually
  // part of a duplicate group, where a visual comparison is worth it.
  const hashCounts = useRef(new Map<string, number>())
  const idToHash = useRef(new Map<string, string>())

  const handleFiles = useCallback(
    async (rawFiles: File[]) => {
      if (rawFiles.length === 0) return

      const token = ++processingToken.current
      setIsProcessing(true) // covers zip extraction too, which can take a moment for large archives

      const { images: files, passthrough, failedZips } = await expandZipFiles(rawFiles)
      if (processingToken.current !== token) return
      if (passthrough.length > 0) {
        setPassthroughFiles((prev) => [...prev, ...passthrough])
      }
      if (failedZips.length > 0) {
        setFailedZipNames((prev) => [...prev, ...failedZips])
      }
      if (files.length === 0) {
        setIsProcessing(false)
        return
      }

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
        converted: false,
      }))
      setPhotos((prev) => [...prev, ...pending])
      setProgress({ done: 0, failed: 0, total: files.length })

      // Hash immediately (cheap) so duplicate badges show up before the
      // slower per-photo processing (HEIC decode etc.) even finishes. Only
      // when duplicate checking is on - otherwise there's no duplicates
      // panel to feed, and nothing should be treated as needing a thumbnail.
      // sha256HexSafe never hangs or rejects - a file whose hash times out
      // or fails just resolves to null and sits out of duplicate detection,
      // rather than blocking every other file's hash (and thus the whole
      // batch) behind one bad entry. Concurrency is bounded (see
      // HASH_CONCURRENCY) so a big batch doesn't read every file into memory
      // at once.
      const hashes: Array<string | null> = files.map(() => null)
      if (options.checkDuplicates) {
        await runWithConcurrency(files, HASH_CONCURRENCY, async (file, i) => {
          hashes[i] = await sha256HexSafe(file)
        })
      }
      if (processingToken.current !== token) return
      if (options.checkDuplicates) {
        setPhotos((prev) =>
          prev.map((p) => {
            const i = ids.indexOf(p.id)
            return i === -1 ? p : { ...p, contentHash: hashes[i] }
          }),
        )
        for (let i = 0; i < ids.length; i++) {
          const hash = hashes[i]
          if (hash === null) continue
          idToHash.current.set(ids[i], hash)
          hashCounts.current.set(hash, (hashCounts.current.get(hash) ?? 0) + 1)
        }
        if (options.autoRemoveDuplicates) {
          setPhotos((prev) => {
            const toExclude = idsToAutoExclude(findDuplicateGroups(prev))
            return prev.map((p) => (toExclude.has(p.id) ? { ...p, excluded: true } : p))
          })
        }
      }

      // Bounded concurrency: HEIC decoding runs in a Worker pool (see
      // heicWorkerPool.ts) so several photos' decodes genuinely overlap
      // across CPU cores, while still capping how many are in flight at once
      // (each decoded frame is tens of MB, so unbounded concurrency risks
      // memory pressure on a big batch).
      await runWithConcurrency(files, HEIC_DECODE_CONCURRENCY, async (file, i) => {
        if (processingToken.current !== token) return
        // No thumbnail needed when duplicates are removed automatically -
        // there's no review panel to show one in, so skip the decode entirely.
        const needsThumbnail =
          options.checkDuplicates &&
          !options.autoRemoveDuplicates &&
          hashes[i] !== null &&
          (hashCounts.current.get(hashes[i]!) ?? 0) > 1
        const result = await processPhoto(file, ids[i], options, needsThumbnail)
        if (processingToken.current !== token) return // a newer batch superseded this one
        setPhotos((prev) => applyResult(prev, result))
        setProgress((p) => ({
          ...p,
          done: p.done + (result.status === 'done' ? 1 : 0),
          failed: p.failed + (result.status === 'failed' ? 1 : 0),
        }))
      })
      setIsProcessing(false)
    },
    [options],
  )

  // Manual, explicit re-processing (a "Process" button) instead of an
  // automatic debounced reprocess on every options change - with a large
  // batch, auto-reprocessing on every tick of the quality slider meant
  // dragging it kicked off a full re-decode pass repeatedly. Applies the
  // CURRENT options to every already-uploaded photo in one pass: hashes
  // anything not yet hashed (covers "Check for duplicates" having been off
  // before, or new files landed while it was off), then reprocesses
  // everything so duplicate-group thumbnails and output options are both
  // brought up to date together.
  const handleProcess = useCallback(async () => {
    const entries = [...sourceFiles.current.entries()]
    if (entries.length === 0) return

    const token = ++processingToken.current
    setIsProcessing(true)

    if (options.checkDuplicates) {
      const unhashed = entries.filter(([id]) => !idToHash.current.has(id))
      if (unhashed.length > 0) {
        // sha256HexSafe never hangs or rejects, and concurrency is bounded -
        // see the comment on the same call in handleFiles above.
        const hashes: Array<string | null> = unhashed.map(() => null)
        await runWithConcurrency(unhashed, HASH_CONCURRENCY, async ([, file], i) => {
          hashes[i] = await sha256HexSafe(file)
        })
        if (processingToken.current !== token) return
        for (let i = 0; i < unhashed.length; i++) {
          const [id] = unhashed[i]
          const hash = hashes[i]
          if (hash === null) continue
          idToHash.current.set(id, hash)
          hashCounts.current.set(hash, (hashCounts.current.get(hash) ?? 0) + 1)
        }
        setPhotos((prev) =>
          prev.map((p) => {
            const idx = unhashed.findIndex(([id]) => id === p.id)
            return idx === -1 ? p : { ...p, contentHash: hashes[idx] }
          }),
        )
      }
      if (options.autoRemoveDuplicates) {
        setPhotos((prev) => {
          const toExclude = idsToAutoExclude(findDuplicateGroups(prev))
          return prev.map((p) => (toExclude.has(p.id) ? { ...p, excluded: true } : p))
        })
      }
    }

    setProgress({ done: 0, failed: 0, total: entries.length })
    await runWithConcurrency(entries, HEIC_DECODE_CONCURRENCY, async ([id, file]) => {
      if (processingToken.current !== token) return // superseded by a newer change
      const hash = idToHash.current.get(id)
      // No thumbnail needed when duplicates are removed automatically - see
      // the comment on the same check in handleFiles above.
      const needsThumbnail =
        options.checkDuplicates &&
        !options.autoRemoveDuplicates &&
        hash !== undefined &&
        (hashCounts.current.get(hash) ?? 0) > 1
      const result = await processPhoto(file, id, options, needsThumbnail)
      if (processingToken.current !== token) return
      setPhotos((prev) => applyResult(prev, result))
      setProgress((p) => ({
        ...p,
        done: p.done + (result.status === 'done' ? 1 : 0),
        failed: p.failed + (result.status === 'failed' ? 1 : 0),
      }))
    })
    setIsProcessing(false)
  }, [options])

  const handleOptionsChange = useCallback((newOptions: ProcessingOptions) => {
    setOptions(newOptions)
  }, [])

  const toggleExcluded = useCallback((id: string) => {
    setPhotos((prev) => prev.map((p) => (p.id === id ? { ...p, excluded: !p.excluded } : p)))
  }, [])

  const handleReset = useCallback(() => {
    processingToken.current++ // invalidate any in-flight processing loop
    sourceFiles.current.clear()
    hashCounts.current.clear()
    idToHash.current.clear()
    setPhotos((prev) => {
      for (const p of prev) if (p.thumbnailUrl) URL.revokeObjectURL(p.thumbnailUrl)
      return []
    })
    setPassthroughFiles([])
    setFailedZipNames([])
    setOptions(DEFAULT_OPTIONS)
    setIsProcessing(false)
    setProgress({ done: 0, failed: 0, total: 0 })
    setIsZipping(false)
    setDownloadError(null)
    setDownloadWarning(null)
  }, [])

  const handleDownload = useCallback(async () => {
    setIsZipping(true)
    setDownloadError(null)
    setDownloadWarning(null)
    try {
      // Failed photos still had a real original file - include it unprocessed
      // rather than dropping it, the same way non-photo passthrough files are.
      const failedOriginals = photos
        .filter((p) => p.status === 'failed')
        .map((p) => sourceFiles.current.get(p.id))
        .filter((f): f is File => f !== undefined)

      const { blob, skipped } = await buildOrganizedZip(
        photos,
        options.sortByDate,
        passthroughFiles,
        failedOriginals,
        options.dateGranularity,
      )
      if (skipped.length > 0) {
        // A file's Blob can go unreadable under memory pressure (large
        // batches, long sessions) - buildOrganizedZip already leaves those
        // out rather than aborting the whole download, so surface which
        // ones so it's clear the zip isn't silently missing something.
        const shown = skipped.slice(0, 5).join(', ')
        setDownloadWarning(
          `${skipped.length} file${skipped.length === 1 ? '' : 's'} couldn't be read and ${skipped.length === 1 ? 'was' : 'were'} left out of the zip (this can happen under heavy memory use with very large batches): ${shown}${skipped.length > 5 ? ', …' : ''}`,
        )
      }
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'organized-photos.zip'
      // Some browsers only reliably fire a synthetic click's download if the
      // anchor is actually attached to the DOM when .click() runs.
      document.body.appendChild(a)
      a.click()
      a.remove()
      // Revoke on a delay, not immediately - revoking before the browser has
      // actually started the download can silently cancel it in some browsers.
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : 'Building the zip failed. Please try again.')
    } finally {
      setIsZipping(false)
    }
  }, [photos, options.sortByDate, options.dateGranularity, passthroughFiles])

  const canReset =
    photos.length > 0 ||
    passthroughFiles.length > 0 ||
    failedZipNames.length > 0 ||
    JSON.stringify(options) !== JSON.stringify(DEFAULT_OPTIONS)
  // No review panel when duplicates are removed automatically - nothing to
  // show a thumbnail for anyway, since needsThumbnail skips them in that case.
  const duplicateGroups = useMemo(
    () => (options.checkDuplicates && !options.autoRemoveDuplicates ? findDuplicateGroups(photos) : []),
    [photos, options.checkDuplicates, options.autoRemoveDuplicates],
  )
  const doneCount = photos.filter((p) => p.status === 'done').length
  const failedCount = photos.filter((p) => p.status === 'failed').length
  const donePhotos = photos.filter((p) => p.status === 'done')
  const includedPhotos = donePhotos.filter((p) => !p.excluded)
  const includedCount = includedPhotos.length
  // Excluded (duplicate) photos get their own section at the bottom instead
  // of showing dimmed inline, so the main list only shows what's actually
  // going in the download.
  const visiblePhotos = photos.filter((p) => !p.excluded)
  const excludedPhotos = photos.filter((p) => p.excluded)

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
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '1.5rem', cursor: isProcessing ? 'wait' : 'default' }}>
      {isProcessing && (
        <ProcessingOverlay doneCount={progress.done} failedCount={progress.failed} total={progress.total} />
      )}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
        <div>
          <h1 style={{ marginBottom: 0 }}>Photo Organizer</h1>
          <p style={{ color: '#666', marginTop: '0.25rem' }}>
            Everything happens in your browser! Photos are never uploaded anywhere.
          </p>
        </div>
        <button
          onClick={handleReset}
          disabled={!canReset || isZipping}
          title={
            isZipping
              ? 'Wait for the zip to finish building before resetting'
              : 'Remove all photos and reset options to their defaults'
          }
        >
          Reset
        </button>
      </header>

      <main style={{ marginTop: '1.5rem' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <OptionsPanel
            options={options}
            onChange={handleOptionsChange}
            onProcess={handleProcess}
            canProcess={photos.length > 0 && !isProcessing && !isZipping}
            isProcessing={isProcessing}
          />
        </div>

        <UploadDropzone onFilesSelected={handleFiles} disabled={isProcessing || isZipping} />

        {failedZipNames.length > 0 && (
          <p style={{ margin: '1rem 0 0', color: 'crimson' }}>
            {failedZipNames.length} zip file{failedZipNames.length === 1 ? '' : 's'} couldn't be read (likely
            too large for available memory) and {failedZipNames.length === 1 ? "wasn't" : "weren't"} included:{' '}
            {failedZipNames.join(', ')}
          </p>
        )}

        {(photos.length > 0 || passthroughFiles.length > 0) && (
          <div style={{ marginTop: '1.5rem' }}>
            <DuplicatesPanel groups={duplicateGroups} onToggleExcluded={toggleExcluded} />

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
              {photos.length > 0 && (
                <p style={{ margin: 0 }}>
                  {doneCount}/{photos.length} processed
                  {failedCount > 0 && <span style={{ color: 'crimson' }}> ({failedCount} failed)</span>}
                  {includedCount !== doneCount && <span> · {includedCount} will be included in the zip</span>}
                </p>
              )}
              {passthroughFiles.length > 0 && (
                <p style={{ margin: 0, color: '#666' }}>
                  + {passthroughFiles.length} other file{passthroughFiles.length === 1 ? '' : 's'} (not
                  photos) will be included as-is in {PASSTHROUGH_FOLDER}/
                </p>
              )}
              {failedCount > 0 && (
                <p style={{ margin: 0, color: '#666' }}>
                  + {failedCount} file{failedCount === 1 ? '' : 's'} that failed to process will be included
                  unprocessed in {FAILED_FOLDER}/
                </p>
              )}
              <button
                onClick={handleDownload}
                disabled={
                  (includedCount === 0 && passthroughFiles.length === 0 && failedCount === 0) || isZipping
                }
              >
                {isZipping ? 'Building zip…' : 'Download organized zip'}
              </button>
            </div>
            {downloadError && (
              <p style={{ margin: '0 0 1rem', color: 'crimson', fontSize: '0.9rem' }}>
                {downloadError}
              </p>
            )}
            {downloadWarning && (
              <p style={{ margin: '0 0 1rem', color: '#b8590a', fontSize: '0.9rem' }}>
                {downloadWarning}
              </p>
            )}
            {sizeComparison && (
              <p style={{ margin: '0 0 1rem', fontSize: '0.9rem', color: '#444' }}>
                Total size: {formatSizeComparison(sizeComparison)}
              </p>
            )}
            {visiblePhotos.length > 0 &&
              (options.sortByDate ? (
                <DateGroups photos={visiblePhotos} granularity={options.dateGranularity} />
              ) : (
                <PhotoGrid photos={visiblePhotos} />
              ))}

            {excludedPhotos.length > 0 && (
              <div style={{ marginTop: '2rem' }}>
                <h3 style={{ fontSize: '0.9rem', color: '#666', marginBottom: '0.5rem' }}>
                  Excluded duplicates ({excludedPhotos.length}) - not included in the download
                </h3>
                <PhotoGrid photos={excludedPhotos} onToggleExcluded={toggleExcluded} />
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
