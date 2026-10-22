import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { TileLayerProps } from 'react-leaflet'
import { MapTiles } from './MapTiles'

// Captures the props MapTiles hands to react-leaflet's TileLayer, without mounting a map.
const tileLayerProps: TileLayerProps[] = []

vi.mock('react-leaflet', () => ({
  TileLayer: (props: TileLayerProps) => {
    tileLayerProps.push(props)
    return null
  },
}))

// The real module validates Supabase vars this test has no use for; an empty env is the
// production default (MapTiler host, no key) as far as MapTiles is concerned.
vi.mock('../../env', () => ({ env: {} }))

function renderLayer(layer: 'plan' | 'satellite'): TileLayerProps {
  renderToStaticMarkup(<MapTiles layer={layer} />)
  expect(tileLayerProps).toHaveLength(1)
  return tileLayerProps[0]
}

beforeEach(() => {
  tileLayerProps.length = 0
})

describe('MapTiles', () => {
  // detectRetina on top of {r} halves the 512px grid on high-density screens and
  // requests 4x as many (billed) tiles — see the comment on the plan layer.
  it('gets retina plan tiles from {r} alone, never from detectRetina', () => {
    const props = renderLayer('plan')
    expect(props.detectRetina).toBeUndefined()
    expect(props.url).toContain('{r}')
    expect(props.tileSize).toBe(512)
    expect(props.zoomOffset).toBe(-1)
    expect(props.maxNativeZoom).toBe(20)
  })

  it('keeps the satellite layer on its plain 256px grid with no retina variant', () => {
    const props = renderLayer('satellite')
    expect(props.detectRetina).toBeUndefined()
    expect(props.url).not.toContain('{r}')
    expect(props.tileSize).toBeUndefined()
    expect(props.zoomOffset).toBeUndefined()
    expect(props.maxNativeZoom).toBe(22)
  })
})
