/** Runs `worker` over `items` with at most `limit` running at once. */
export async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<void>,
): Promise<void> {
  let nextIndex = 0

  async function runNext(): Promise<void> {
    const i = nextIndex++
    if (i >= items.length) return
    await worker(items[i], i)
    return runNext()
  }

  const workerCount = Math.max(1, Math.min(limit, items.length))
  await Promise.all(Array.from({ length: workerCount }, runNext))
}
