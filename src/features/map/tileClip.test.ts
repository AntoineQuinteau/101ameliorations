import { describe, expect, it } from 'vitest'
import { tileClipRect } from './tileClip'

describe('tileClipRect', () => {
  it('draws the whole tile when the clip box fully contains it', () => {
    const rect = tileClipRect(1000, 1000, 256, 256, 0, 0, 5000, 5000)
    expect(rect).toEqual({ x: 0, y: 0, width: 256, height: 256 })
  })

  it("returns null when the tile doesn't overlap the clip box at all (regression: PR #33 review, round 6)", () => {
    // The exact failure mode Leaflet's own `bounds` option misses (`GridLayer
    // ._isValidTile` only checks `overlaps`, not containment) — a tile whose rectangle
    // is nowhere near the clip box must draw nothing, not the whole tile.
    const rect = tileClipRect(1000, 1000, 256, 256, 5000, 5000, 6000, 6000)
    expect(rect).toBeNull()
  })

  it('returns just the overlapping corner when the clip box only partly covers the tile', () => {
    // Tile spans [0, 256) x [0, 256). Clip box's own rectangle only reaches
    // (100, 100)-(400, 400) — i.e. only this tile's bottom-right corner is inside it.
    const rect = tileClipRect(0, 0, 256, 256, 100, 100, 400, 400)
    expect(rect).toEqual({ x: 100, y: 100, width: 156, height: 156 })
  })

  it('returns null for a clip box that only touches the tile edge with zero-width overlap', () => {
    const rect = tileClipRect(0, 0, 256, 256, 256, 0, 500, 500)
    expect(rect).toBeNull()
  })

  it('clips independently on each axis (a box that overlaps in x but not y, and vice versa)', () => {
    // Overlaps in x (0-256 vs 100-400) but not in y (0-256 vs 300-400).
    expect(tileClipRect(0, 0, 256, 256, 100, 300, 400, 400)).toBeNull()
    // Overlaps in y but not in x.
    expect(tileClipRect(0, 0, 256, 256, 300, 100, 400, 400)).toBeNull()
  })

  it('handles a tile whose own origin is offset (not at the pixel-space origin)', () => {
    // A tile at pixel origin (2048, 4096) — as any tile away from the map's own (0,0)
    // corner actually is — with a clip box reaching only its top-left quarter.
    const rect = tileClipRect(2048, 4096, 256, 256, 1900, 3900, 2176, 4224)
    expect(rect).toEqual({ x: 0, y: 0, width: 128, height: 128 })
  })

  it('supports a non-square tile (width and height clipped independently)', () => {
    const rect = tileClipRect(0, 0, 512, 256, 0, 0, 300, 100)
    expect(rect).toEqual({ x: 0, y: 0, width: 300, height: 100 })
  })
})
