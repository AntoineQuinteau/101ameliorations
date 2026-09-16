import { describe, expect, it } from 'vitest'
import { mapWithConcurrency } from './mapWithConcurrency'

describe('mapWithConcurrency', () => {
  it('preserves the input order in the results, independent of completion order', async () => {
    const delays = [30, 10, 20, 0]
    const results = await mapWithConcurrency(
      delays,
      4,
      (delay, index) => new Promise<number>((resolve) => setTimeout(() => resolve(index), delay)),
    )
    expect(results).toEqual([0, 1, 2, 3])
  })

  it('never runs more than `limit` calls at once', async () => {
    let active = 0
    let maxActive = 0
    await mapWithConcurrency(
      Array.from({ length: 10 }, (_, i) => i),
      3,
      async () => {
        active += 1
        maxActive = Math.max(maxActive, active)
        await new Promise((resolve) => setTimeout(resolve, 5))
        active -= 1
      },
    )
    expect(maxActive).toBeLessThanOrEqual(3)
  })

  it('rejects with the first error, like Promise.all', async () => {
    await expect(
      mapWithConcurrency([1, 2, 3], 2, async (item) => {
        if (item === 2) throw new Error('boom')
        return item
      }),
    ).rejects.toThrow('boom')
  })

  it('handles a limit larger than the item count', async () => {
    const results = await mapWithConcurrency([1, 2], 10, async (item) => item * 2)
    expect(results).toEqual([2, 4])
  })

  it('handles an empty input', async () => {
    const results = await mapWithConcurrency([], 4, async (item: number) => item)
    expect(results).toEqual([])
  })
})
