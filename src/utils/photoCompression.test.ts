import { describe, expect, it, vi } from 'vitest'

// The real codec (browser-image-compression) and EXIF parser (exifr) both
// need a browser image pipeline that doesn't exist under jsdom, so these
// tests cover the logic that belongs to this module — option wiring and
// readPhotoGps's error handling — not the libraries themselves.
const { imageCompressionMock, gpsMock } = vi.hoisted(() => ({
  imageCompressionMock: vi.fn(),
  gpsMock: vi.fn(),
}))
vi.mock('browser-image-compression', () => ({ default: imageCompressionMock }))
vi.mock('exifr', () => ({ gps: gpsMock }))

const { compressPhoto, readPhotoGps } = await import('./photoCompression')

function makeFile(name = 'photo.jpg'): File {
  return new File(['fake-image-bytes'], name, { type: 'image/jpeg' })
}

describe('compressPhoto', () => {
  it('compresses with the spec-mandated options (1600px, quality 0.8, EXIF stripped)', async () => {
    imageCompressionMock.mockResolvedValue(makeFile('compressed.jpg'))
    // jsdom has no real <img> decoder, so Image.onload never fires on its
    // own — resolve it manually to exercise getImageDimensions' happy path.
    const originalImage = globalThis.Image
    class FakeImage {
      naturalWidth = 1600
      naturalHeight = 1200
      onload: (() => void) | null = null
      set src(_value: string) {
        queueMicrotask(() => this.onload?.())
      }
    }
    // @ts-expect-error -- stubbing the DOM Image constructor for this test only
    globalThis.Image = FakeImage
    URL.createObjectURL = vi.fn(() => 'blob:fake')
    URL.revokeObjectURL = vi.fn()

    try {
      const result = await compressPhoto(makeFile())

      expect(imageCompressionMock).toHaveBeenCalledWith(
        expect.any(File),
        expect.objectContaining({
          maxWidthOrHeight: 1600,
          initialQuality: 0.8,
          maxSizeMB: 2,
          useWebWorker: true,
          preserveExif: false,
        }),
      )
      expect(result.width).toBe(1600)
      expect(result.height).toBe(1200)
      expect(result.file.name).toBe('compressed.jpg')
    } finally {
      globalThis.Image = originalImage
    }
  })
})

describe('readPhotoGps', () => {
  it('returns the coordinates when exifr finds GPS data', async () => {
    gpsMock.mockResolvedValue({ latitude: 43.49, longitude: -1.47 })
    await expect(readPhotoGps(makeFile())).resolves.toEqual({ lat: 43.49, lng: -1.47 })
  })

  it('returns null when the photo has no GPS data', async () => {
    gpsMock.mockResolvedValue(undefined)
    await expect(readPhotoGps(makeFile())).resolves.toBeNull()
  })

  it('returns null instead of throwing when exifr fails to parse the file', async () => {
    gpsMock.mockRejectedValue(new Error('not a valid image'))
    await expect(readPhotoGps(makeFile())).resolves.toBeNull()
  })

  it('returns null when exifr resolves a malformed result', async () => {
    gpsMock.mockResolvedValue({ latitude: 'oops', longitude: null })
    await expect(readPhotoGps(makeFile())).resolves.toBeNull()
  })
})
