# Photo Organizer

A browser-only web app for organizing photos (including HEIC) by capture
date. Upload a batch of photos - or a .zip archive of them - choose what to
do via checkboxes (organize by date with a chosen folder depth, convert HEIC
to JPEG, pad to a 1:1 square, reduce quality to save space, check for and
remove duplicates), click **Process** to apply it, then download a zip with
the results.

**No backend.** Everything — HEIC decoding, EXIF parsing, thumbnailing, and
zip creation — runs client-side in the browser via WebAssembly and JS
libraries. Photos are never uploaded anywhere; nothing is stored server-side.

- `frontend/` — the React + TypeScript app (Vite). This is the whole product.
- `legacy/` — the original tkinter desktop app, kept for reference only.

## How it works

- [heic2any](https://www.npmjs.com/package/heic2any) (a libheif WASM build)
  decodes HEIC/HEIF to JPEG in-browser.
- [exifr](https://www.npmjs.com/package/exifr) reads `DateTimeOriginal` from
  the photo's EXIF data (falling back to `CreateDate`/`ModifyDate`).
- [jszip](https://www.npmjs.com/package/jszip) builds the downloadable zip.
  When "Organize by date" is on, photos nest under a folder depth you choose
  (`YYYY/`, `YYYY/YYYY-MM/`, or `YYYY/YYYY-MM/YYYY-MM-DD/` - "Year"/"Month"/
  "Day" in the options panel; `unknown/` if no date could be determined at
  all); flat at the zip root otherwise. It's also used to *read* an uploaded
  .zip: dropping one in extracts every image inside (at any nesting depth)
  and feeds them through the same pipeline as individually-dropped files.
  macOS junk (`__MACOSX/`, dotfiles) is skipped - but nothing else is
  silently dropped. Any non-image file, whether loose or found inside a zip
  (including a zip that reads fine but fails to parse as a zip), rides along
  unchanged into `other-files/` in the download instead of being discarded,
  so you never have to go back and manually recover something from the
  original zip/folder. See
  [frontend/src/lib/expandZips.ts](frontend/src/lib/expandZips.ts) and
  [frontend/src/lib/buildZip.ts](frontend/src/lib/buildZip.ts).
- A zip whose raw bytes can't even be read at all - typically a multi-GB zip
  that exceeds what the browser can allocate in one contiguous buffer (see
  "A hard memory ceiling" below) - is reported by name instead of being
  silently mislabeled as an ordinary file: a second read attempt at zip-build
  time would just fail identically, so it's excluded from the download
  rather than passed through.
- The same "don't lose anything" rule applies to photos that fail *during*
  processing (a corrupt file, an unsupported HEIC variant, anything
  `createImageBitmap`/`heic2any` can't decode) - their original untouched
  bytes go into `failed-to-process/` in the download rather than being
  dropped. Hover the "failed" badge on a photo in the gallery to see the
  actual error.
- Building the zip reads each file's bytes defensively: if one Blob can't be
  read (e.g. its backing data got evicted under memory pressure - see
  "A hard memory ceiling" below), it's left out and reported by name instead
  of aborting the *entire* download, which is what used to happen when any
  single file failed. See
  [frontend/src/lib/buildZip.ts](frontend/src/lib/buildZip.ts)'s
  `BuildZipResult.skipped`.

The options panel (see [frontend/src/lib/types.ts](frontend/src/lib/types.ts)'s
`ProcessingOptions`) controls processing. Toggling a checkbox or moving the
quality slider only updates the selected settings - it does **not**
reprocess anything by itself. A **Process** button in the options panel
applies the current settings to every photo you've already added in one
explicit pass (hashing anything unhashed first if "Check for duplicates" is
on). New uploads always process immediately with whatever settings are
currently selected; Process is only needed to apply a *changed* setting to
photos already added. (Earlier versions auto-reprocessed on every toggle,
debounced - this was deliberately removed: dragging the quality slider on a
large batch triggered a full re-decode pass on every tick.) "Organize by
date" needs no reprocessing either way, since it's just how the gallery/zip
are laid out, recomputed live. A **Reset** button in the header clears all
photos and options back to defaults in one click (disabled while a batch is
processing or a zip is being built, to avoid resetting out from under
either).

- **Organize by date** - group the gallery/zip by date, nested to the folder
  depth you pick (Year / Month / Day). If off, the gallery is a flat grid
  and the zip is flat too.
- **Convert HEIC to JPEG** - off leaves HEIC files untouched in the export.
  On its own (without "Reduce quality"), this always produces a JPEG at a
  fixed quality regardless of size - and since HEIC/HEVC compresses more
  efficiently than JPEG at the same visual quality, converting can
  legitimately make a batch's total size *larger*, not smaller. That's
  expected: the point of this option is compatibility (many apps/tools can't
  open HEIC directly), not size reduction. Check "Reduce quality to save
  space" too and lower the slider if you want smaller output as well.
- **Pad to square (1:1)** - adds black borders to make every photo square.
  This always re-encodes to JPEG, even for HEIC with conversion off, since
  padding requires rasterizing the image onto a canvas either way.
- **Reduce quality to save space** - reveals a 10-100% quality slider. It can
  only ever shrink a file, never grow one:
  - **100%** is treated as "exactly what was uploaded" - the photo isn't
    touched at all, not even decoded, so the output is byte-identical to the
    original (verified: same SHA-256 hash in, hash out).
  - **Below 100%** on a plain JPEG/PNG, it re-compresses and keeps the result
    only if it's actually smaller; otherwise the original is kept untouched.
  - **On HEIC with "Convert HEIC" off**, quality reduction alone can still
    force a JPEG conversion (there's no way to write a smaller HEIC in-browser)
    - but JPEG sometimes loses to HEIC's more efficient compression on small
    images, so if the converted result would be bigger than the original
    HEIC, the original HEIC bytes are kept instead. This guarantee doesn't
    extend to an explicitly-checked "Convert HEIC," which always produces a
    JPEG regardless of size, since that's a separate, deliberate request.
  - Squarify is exempt from all of this - padding is an intentional size
    change, not a quality-reduction side effect.

When "Convert HEIC to JPEG" or "Reduce quality to save space" is on, a
**total size comparison** appears above the gallery - see
[frontend/src/lib/formatSize.ts](frontend/src/lib/formatSize.ts). The two
sides aren't computed the same way on purpose: "before" is a fixed baseline
of everything you uploaded (including duplicates, even ones you've excluded),
while "after" is live and only counts what's currently checked - so
unchecking a duplicate copy shrinks "after" without moving "before," showing
savings from compression and from deduping as two separate, visible effects.

Video compression was considered but is out of scope for now - doing it
fully client-side would need ffmpeg.wasm (a ~25-30MB download and
CPU-bound transcoding) or the WebCodecs API (faster but inconsistent
browser support), either of which is a much bigger lift than the image
pipeline above.

If no EXIF date is found, the app falls back to the file's last-modified
date and marks the photo with a "file date" badge in the gallery, since that
fallback is often just the download date (e.g. photos from social media,
which strips EXIF on upload) rather than when the photo was actually taken.

**Duplicate detection** ([frontend/src/lib/duplicates.ts](frontend/src/lib/duplicates.ts))
is gated behind the "Check for duplicates" checkbox (off by default, like
every other option) - with it off, nothing gets hashed and the duplicates
panel never appears, even if you upload literal byte-identical copies. With
it on, uploaded files' raw bytes get hashed (SHA-256) and exact matches are
grouped across the whole session - not just within one drop. Clicking
**Process** after turning it on hashes any already-uploaded photo that
predates the change (`App.tsx`'s `handleProcess`), so duplicates are found
across old and new uploads alike. It only catches
byte-identical files (the same photo uploaded twice, or two downloads of the
same file), not visually-similar-but-different-bytes copies (e.g. a HEIC and
a separately-exported JPG of the same shot).

By default, nothing is removed automatically: duplicate groups show up in a
panel with a thumbnail per copy, where you can uncheck individual copies to
exclude them from the zip. A second checkbox, **"Automatically remove
duplicates"** (shown once "Check for duplicates" is on), keeps only the
first copy of each group without manual review - and since there's nothing
to review, it also skips generating the duplicate-panel thumbnails entirely
(the panel doesn't even render), which is faster for large batches. Either
way, an excluded photo moves to a separate "Excluded duplicates" section at
the bottom of the list - with its own checkbox per photo, so you can still
bring a specific one back into the download without having to turn
"Automatically remove duplicates" off first.

See [frontend/src/lib/processPhoto.ts](frontend/src/lib/processPhoto.ts) for
the per-photo pipeline and [frontend/src/lib/buildZip.ts](frontend/src/lib/buildZip.ts)
for the zip layout.

## Local development

```bash
cd frontend
npm install
npm run dev
```

Opens at http://localhost:5173. No environment variables, no accounts to set
up, no services to run alongside it.

## Testing

```bash
cd frontend
npx tsc --noEmit   # typecheck
npm test           # vitest: EXIF-date grouping, duplicate detection, zip-path/granularity logic, timeouts, concurrency, hashing...
npm run lint       # eslint (flat config, typescript-eslint + react-hooks + react-refresh)
```

The processing pipeline itself (HEIC decode, thumbnailing, the Worker pool)
and every React component use browser APIs (`canvas`, `createImageBitmap`,
real Web Workers) and have no automated test coverage - they're exercised by
hand in the browser instead: drop in a real HEIC file, confirm it converts,
groups correctly, and the downloaded zip has the right folder structure.
`App.tsx` itself (the upload/process/download orchestration - where most
real bugs have actually turned up) also has no direct unit tests for the
same reason; changes there should be verified in a real browser, ideally
with a script against a real multi-hundred-photo batch, not just by reading
the diff.

## Deploying

Static site, deployable anywhere that serves a Vite build — Vercel is the
simplest: `vercel --prod` from `frontend/`, or connect the repo in the Vercel
dashboard with root directory set to `frontend/`. No backend/database/storage
to provision.

## Performance: thumbnails are opt-in, not automatic

The gallery ([frontend/src/components/PhotoGrid.tsx](frontend/src/components/PhotoGrid.tsx))
is deliberately text-only: filename, date, file size, and a "converted"/
"unchanged" badge (with the before/after size and percent change, when
processing actually touched the bytes) - no image. Decoding a photo just to
render a preview was the single biggest cost in the whole pipeline (see
below) - by not doing it at all for most photos, a batch that used to take
seconds now takes tens of milliseconds. Measured on a real 5-photo batch
(including a genuine 1.4MB iPhone HEIC): **97ms total**, down from several
seconds when every photo got a thumbnail.

A photo still gets a real thumbnail - generated by
[processPhoto.ts](frontend/src/lib/processPhoto.ts)'s existing pipeline, just
gated behind a `needsThumbnail` flag - when it's part of a likely-duplicate
group (same content hash as another upload) **and** "Automatically remove
duplicates" is off, since that's the one case a visual side-by-side actually
matters: [DuplicatesPanel](frontend/src/components/DuplicatesPanel.tsx)
shows those. With auto-remove on, there's no review step, so thumbnails
aren't generated at all for any photo, and the panel doesn't render even if
duplicates were found. `App.tsx` tracks content-hash counts across the whole
session (`hashCounts`/`idToHash` refs) to decide this per photo. New uploads
decide it immediately at hash time, so if photo A is uploaded alone (no
thumbnail yet) and photo B - a byte-identical duplicate - gets dropped in
later, B gets a thumbnail right away but A doesn't until you click
**Process**, which recomputes `needsThumbnail` for every photo against the
now-current hash counts and backfills A's thumbnail too. The duplicate
pairing itself is detected and shown correctly either way, even before A's
thumbnail catches up.

## Performance: HEIC decoding runs in a Worker pool

For photos that *do* need a thumbnail (or any photo run through "Convert
HEIC," "Pad to square," or "Reduce quality" below 100%), HEIC decoding
(`heic2any`, a libheif WASM build) is by far the slowest step. Measured on
real ~1.2MB iPhone photos: ~1.4-2.3 seconds each, versus tens of milliseconds
for a same-size JPEG. `Promise.all` alone doesn't help - the decode is
CPU-bound and blocks the single JS main thread, so "concurrent" promises just
run back to back anyway (confirmed by measurement: a 1.11x "speedup" from
Promise.all - i.e., none).

[frontend/src/lib/heicWorkerPool.ts](frontend/src/lib/heicWorkerPool.ts) runs
decodes in a small pool of real Web Workers (capped at 4, regardless of core
count, since each decoded frame holds tens of MB in memory) so multiple
photos' decodes genuinely overlap across CPU cores. Confirmed on real
hardware: 2 concurrent workers gave a 1.66x speedup over sequential; a
6-photo batch went from a projected ~11s sequential to ~4.4s. `App.tsx` uses
[frontend/src/lib/concurrency.ts](frontend/src/lib/concurrency.ts) to keep
that many `processPhoto` calls in flight at once, matching the worker count.

**The catch:** `heic2any` assumes a real browser DOM and doesn't run in a
Worker out of the box - it references `window`, and encodes its output via
`document.createElement("canvas")` + `canvas.toBlob(...)`. Neither exists in
a Worker.
[frontend/src/workers/heicDecoder.worker.ts](frontend/src/workers/heicDecoder.worker.ts)
shims both (`OffscreenCanvas` stands in for the canvas; `toBlob` bridges to
`convertToBlob`), plus a catch-all stub for other incidental DOM calls
`heic2any` makes internally (it also probes for a `<video>` element for
unrelated feature detection). This relies on `heic2any`'s internal
implementation rather than a documented API, so it could break on a future
version bump. If a decode fails in a worker for any reason - a shim gap, a
worker crashing - `heicWorkerPool.ts` falls back to decoding that file on the
main thread instead of failing outright, so a shim gap degrades to "slower,"
not "broken."

**Hung decodes, not just crashed ones.** A worker *erroring* is handled by
the fallback above, but a pathological/corrupt HEIC file can make the WASM
decoder hang instead of throwing - no error, no response, just spinning
forever. Without a timeout, that permanently blocks whichever
`runWithConcurrency` lane is waiting on it, and since the batch's overall
`Promise.all` never resolves, the entire batch - not just that one photo -
stalls forever with the progress overlay frozen mid-count. Two bounded
timeouts guard against this: `heicWorkerPool.ts` gives each worker job 30s
before treating it as hung, rejecting just that job (triggering the
main-thread fallback) and replacing that specific worker so future jobs
don't queue up behind a dead one; `processPhoto.ts` wraps the *entire*
per-photo pipeline in a 60s outer timeout as a final backstop, in case
something besides the decode itself - the main-thread fallback, a canvas
call - is what hangs. Verified by deliberately simulating a hung worker: a
4-photo batch with one poisoned file settled in ~4s (3 done, 1 correctly
failed) instead of hanging indefinitely.

**Worker memory grows across decodes and is never freed on its own.**
`heic2any`'s WASM module (libheif/Emscripten) only ever grows its internal
heap within a single worker instance - over a large batch (hundreds of real
photos), a long-lived worker's memory climbs for as long as it keeps
decoding, eventually exhausting what the renderer process is allowed and
getting killed (observed: a ~600-photo, two-zip batch OOMing with only a
handful of photos left). `heicWorkerPool.ts` proactively recycles each
worker (terminate + recreate) every 20 completed jobs, bounding peak memory
regardless of total batch size - safe to do mid-batch since each worker only
ever has one job in flight at a time (round-robin assignment matches
`HEIC_DECODE_CONCURRENCY` 1:1).

**The same hang/stall problem exists for hashing, separately, with its own
separate memory issue on top.** "Check for duplicates" hashes every file via
[frontend/src/lib/hash.ts](frontend/src/lib/hash.ts)'s `sha256HexSafe`, which
reads a whole file into memory (`.arrayBuffer()`) to hash it - before any
HEIC decoding even starts. Originally this ran as one bare `Promise.all`
over every file, which had two separate failure modes:
- **A hang:** if even one file's hash hung (a stuck `arrayBuffer()` read,
  browser weirdness), that `Promise.all` never resolved, and since hashing
  has to finish before processing begins, the *entire* batch stalled before
  a single photo was even attempted - this exact failure mode caused a
  reported stall at 590/594 with duplicate checking on. Fixed the same way
  as the decoder: a 15s timeout that resolves to `null` instead of hanging
  or rejecting, so one bad file just sits out of duplicate detection while
  everything else proceeds. Verified by simulating a hung hash read: a
  3-file batch (one poisoned) settled in ~2s instead of hanging.
- **A memory spike:** a bare `Promise.all` also fires every file's read at
  once, with no concurrency cap - for a large real batch (hundreds of
  photos, gigabytes total), that's every file's bytes resident in memory
  *simultaneously*, before any of the paced, bounded decode step even
  starts. This turned out to be a separate real cause of the same kind of
  OOM/stall symptom, triggered by "Check for duplicates" alone, with no HEIC
  conversion involved at all. Fixed by bounding hashing to 8 files in flight
  at once (`HASH_CONCURRENCY` in `App.tsx`), the same `runWithConcurrency`
  pattern already used for decoding.

## A hard memory ceiling

This app holds everything in memory for the whole session (extracted zip
entries, hashed bytes, processed output blobs) until you download - there's
no server to offload storage to. That has a real, unavoidable ceiling: a
single file's raw bytes have to fit in one contiguous `ArrayBuffer`
(`.arrayBuffer()` on a zip or a photo Blob), and browsers cap how large one
of those can be - roughly the low single-digit-GB range on 64-bit Chrome,
regardless of how much system RAM is free. A zip anywhere near or above that
will fail with `RangeError: Array buffer allocation failed` (or Chromium's
related "could not be read... permission problems" error, which can also
show up when a Blob's backing data gets evicted under memory pressure before
it's read). [frontend/src/lib/expandZips.ts](frontend/src/lib/expandZips.ts)
tells this apart from genuine zip corruption (bytes that read fine but
aren't a valid zip structure) and reports it by name instead of silently
mislabeling it as an ordinary file. As a rough guide: single zips under
~1GB are safe; anywhere in the low single-digit GB gets progressively
riskier, especially alongside other large uploads in the same session. The
only real fix for a file that's genuinely too big is splitting it into
smaller zips before uploading - there's no in-browser way around the limit.

EXIF `Orientation` isn't explicitly corrected; rotated photos may display
sideways depending on the browser's default `createImageBitmap` behavior.
