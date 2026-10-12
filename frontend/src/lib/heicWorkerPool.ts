import type { HeicDecodeRequest, HeicDecodeResponse } from '../workers/heicDecoder.worker'

// Capped rather than using the full core count - each in-flight decode holds
// a full decoded frame in memory (tens of MB for a real photo), and beyond a
// handful of workers the gain flattens out while memory risk keeps growing.
export const HEIC_DECODE_CONCURRENCY = Math.min(
  typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4,
  4,
)

// A real decode takes ~1-2s even for a large photo (measured). If a job
// hasn't come back in this long, treat the worker as hung rather than wait
// forever - a stuck WASM call (e.g. a pathological/corrupt HEIC file that
// sends the decoder into a spin instead of throwing) otherwise blocks its
// whole runWithConcurrency lane permanently, silently stalling the entire
// batch: the exact failure mode this timeout exists to prevent.
const JOB_TIMEOUT_MS = 30_000

// heic2any's WASM decoder (libheif/Emscripten) only ever grows its internal
// heap across calls within the same module instance - it's never freed until
// the whole worker is torn down. Left alone, a long-lived worker's memory
// climbs steadily over a big batch (hundreds of real photos) until the
// renderer hits its memory ceiling and gets killed (observed: a two-zip,
// ~600-photo batch OOMing with only a handful of photos left). Recycling
// each worker periodically bounds peak memory regardless of batch size.
const RECYCLE_WORKER_AFTER_JOBS = 20

interface PendingJob {
  resolve: (blob: Blob) => void
  reject: (err: Error) => void
  timer: ReturnType<typeof setTimeout>
  workerIndex: number
}

let workers: Worker[] = []
let nextWorkerIndex = 0
let nextJobId = 0
let poolFailed = false
let warnedAboutFallback = false
const pending = new Map<number, PendingJob>()
const jobsCompletedByWorker: number[] = []

function warnFallbackOnce(reason: string): void {
  if (warnedAboutFallback) return
  warnedAboutFallback = true
  console.warn(
    `[heicWorkerPool] falling back to main-thread HEIC decoding (${reason}). ` +
      'Processing will still work correctly, just without the worker-pool speedup.',
  )
}

function settleJob(id: number, result: { ok: true; blob: Blob } | { ok: false; error: string }): void {
  const job = pending.get(id)
  if (!job) return
  pending.delete(id)
  clearTimeout(job.timer)
  if (result.ok) job.resolve(result.blob)
  else job.reject(new Error(result.error))

  // Only one job is ever in flight per worker at a time (see
  // decodeHeicInWorker's round-robin assignment, which matches
  // HEIC_DECODE_CONCURRENCY 1:1), so it's safe to recycle right here.
  const { workerIndex } = job
  jobsCompletedByWorker[workerIndex] = (jobsCompletedByWorker[workerIndex] ?? 0) + 1
  if (jobsCompletedByWorker[workerIndex] >= RECYCLE_WORKER_AFTER_JOBS) {
    replaceWorker(workerIndex)
  }
}

/** Rejects only the jobs actually assigned to this worker - a single worker
 *  dying shouldn't cancel unrelated in-flight work on the healthy ones. */
function rejectJobsForWorker(workerIndex: number, message: string): void {
  for (const [id, job] of pending) {
    if (job.workerIndex !== workerIndex) continue
    pending.delete(id)
    clearTimeout(job.timer)
    job.reject(new Error(message))
  }
}

function createWorker(index: number): Worker {
  const worker = new Worker(new URL('../workers/heicDecoder.worker.ts', import.meta.url), { type: 'module' })
  worker.onmessage = (e: MessageEvent<HeicDecodeResponse>) => {
    const { id, ok, blob, error } = e.data
    if (ok && blob) settleJob(id, { ok: true, blob })
    else settleJob(id, { ok: false, error: error ?? 'HEIC decode failed in worker' })
  }
  worker.onerror = () => {
    rejectJobsForWorker(index, 'HEIC decoder worker failed')
    replaceWorker(index)
  }
  return worker
}

/** Assume a worker that just errored or timed out is compromised - swap in a
 *  fresh one so future jobs don't keep queuing up behind a dead one. */
function replaceWorker(index: number): void {
  jobsCompletedByWorker[index] = 0
  try {
    workers[index]?.terminate()
  } catch {
    // already gone - fine
  }
  try {
    workers[index] = createWorker(index)
  } catch {
    poolFailed = true
  }
}

function ensurePool(): boolean {
  if (poolFailed) return false
  if (workers.length > 0) return true
  try {
    const created: Worker[] = []
    for (let i = 0; i < HEIC_DECODE_CONCURRENCY; i++) {
      created.push(createWorker(i))
    }
    workers = created
    return true
  } catch {
    poolFailed = true
    workers = []
    return false
  }
}

/**
 * Decodes HEIC to JPEG using a pool of Workers for real parallelism (the
 * decode is CPU-bound and blocks a single thread, so Promise.all alone
 * doesn't help - see heicDecoder.worker.ts for why a Worker needs a DOM shim
 * to run heic2any at all). Falls back to `mainThreadDecode` - per job, or for
 * everything from here on if the pool itself fails to start - so a shim gap,
 * a worker crash, or a worker hanging on a pathological file all degrade to
 * "slower" rather than "the whole batch stalls forever."
 */
export async function decodeHeicInWorker(
  file: File,
  quality: number,
  mainThreadDecode: (file: File, quality: number) => Promise<Blob>,
): Promise<Blob> {
  if (!ensurePool()) {
    warnFallbackOnce('worker pool unavailable')
    return mainThreadDecode(file, quality)
  }

  const id = nextJobId++
  const workerIndex = nextWorkerIndex
  nextWorkerIndex = (nextWorkerIndex + 1) % workers.length
  const worker = workers[workerIndex]

  try {
    return await new Promise<Blob>((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id)
        reject(new Error('HEIC decode timed out'))
        replaceWorker(workerIndex) // assume the worker itself is hung, not just this job
      }, JOB_TIMEOUT_MS)
      pending.set(id, { resolve, reject, timer, workerIndex })
      const request: HeicDecodeRequest = { id, blob: file, quality }
      worker.postMessage(request)
    })
  } catch {
    warnFallbackOnce('a worker job failed')
    return mainThreadDecode(file, quality)
  }
}
