# Photo Organizer

A browser-only web app for organizing photos (including HEIC) by capture
date. Upload a batch and choose what to do with them via checkboxes:
organize by date, convert HEIC to JPEG, and/or pad to a 1:1 square - then
download a zip with the results.

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
- [jszip](https://www.npmjs.com/package/jszip) builds the downloadable zip,
  with photos nested under `YYYY/YYYY-MM-DD/` when "Organize by date" is on
  (or `unknown/` if no date could be determined at all), flat otherwise.

Three checkboxes in the UI control per-batch behavior (see
[frontend/src/lib/types.ts](frontend/src/lib/types.ts)'s `ProcessingOptions`):

- **Organize by date** - group the gallery/zip by date. If off, the gallery
  is a flat grid and the zip is flat too.
- **Convert HEIC to JPEG** - off leaves HEIC files untouched in the export.
- **Pad to square (1:1)** - adds black borders to make every photo square.
  This always re-encodes to JPEG, even for HEIC with conversion off, since
  padding requires rasterizing the image onto a canvas either way.
- **Reduce quality to save space** - reveals a 10-100% quality slider and
  re-compresses every photo at that level, including ones that would
  otherwise pass through untouched (plain JPEG/PNG). Like squarify, this
  always re-encodes to JPEG. Tested against a real 964KB photo: 20% quality
  produced a 217KB file, 95% quality produced ~1.18MB - both valid, correctly
  sized JPEGs.

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
hashes each uploaded file's raw bytes (SHA-256) and groups exact matches
across the whole session - not just within one drop. It only catches
byte-identical files (the same photo uploaded twice, or two downloads of the
same file), not visually-similar-but-different-bytes copies (e.g. a HEIC and
a separately-exported JPG of the same shot). Nothing is removed
automatically by default: duplicate groups show up in a panel where you can
uncheck individual copies to exclude them from the zip, or click "Remove
duplicates automatically" to keep just the first copy of each group in one
step.

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
npm test           # vitest: EXIF-date grouping and zip-path logic
```

The processing pipeline itself (HEIC decode, thumbnailing) uses browser APIs
(`canvas`, `createImageBitmap`) and is exercised by hand in the browser —
drop in a real HEIC file, confirm it converts, groups correctly, and the
downloaded zip has the right folder structure.

## Deploying

Static site, deployable anywhere that serves a Vite build — Vercel is the
simplest: `vercel --prod` from `frontend/`, or connect the repo in the Vercel
dashboard with root directory set to `frontend/`. No backend/database/storage
to provision.

## Known limits of this first pass

- Large batches (dozens+ of high-res HEIC photos) will be slower than native
  decoding would be, since HEIC conversion runs through WASM in the main
  thread. If this becomes a bottleneck, the next step is moving
  `processPhoto` into a Web Worker so the UI stays responsive and photos can
  process in parallel.
- No deduplication — that was broken in the original app too and is
  out of scope for this pass.
- EXIF `Orientation` isn't explicitly corrected; rotated photos may display
  sideways depending on the browser's default `createImageBitmap` behavior.
