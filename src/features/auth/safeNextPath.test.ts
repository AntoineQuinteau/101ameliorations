import { describe, expect, it } from 'vitest'
import { safeNextPath } from './safeNextPath'

describe('safeNextPath', () => {
  it('falls back to the map when there is no target', () => {
    expect(safeNextPath(null)).toBe('/')
  })

  it('preserves an in-app path', () => {
    expect(safeNextPath('/new')).toBe('/new')
  })

  it('preserves an in-app path with a query string', () => {
    expect(safeNextPath('/k/abc?x=1')).toBe('/k/abc?x=1')
  })

  it('rejects an absolute URL to another host', () => {
    expect(safeNextPath('https://evil.example')).toBe('/')
  })

  it('rejects a protocol-relative URL', () => {
    expect(safeNextPath('//evil.example')).toBe('/')
  })

  it('rejects a javascript: URL', () => {
    expect(safeNextPath('javascript:alert(1)')).toBe('/')
  })
})
