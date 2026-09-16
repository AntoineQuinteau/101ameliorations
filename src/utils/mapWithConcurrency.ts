/** Runs `fn` over `items`, at most `limit` calls in flight at once, and resolves once
 * every call has settled — either with the array of results (same order as `items`) or
 * by rejecting with the first error encountered, exactly like `Promise.all`.
 *
 * Used where 12 photos (spec §4: MAX_PHOTOS_PER_KLASH) would otherwise all compress or
 * all upload at once: unbounded parallelism at that count risks blowing the 10s
 * acceptance budget on a phone in 4G, but photos are independent enough that running
 * them one at a time would waste the budget instead. */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let nextIndex = 0

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex
      nextIndex += 1
      results[index] = await fn(items[index], index)
    }
  }

  const workerCount = Math.min(limit, items.length)
  await Promise.all(Array.from({ length: workerCount }, () => worker()))

  return results
}
