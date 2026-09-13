import imageCompression from 'browser-image-compression'
import { gps as readExifGps } from 'exifr'

export interface CompressedPhoto {
  file: File
  width: number
  height: number
}

export interface PhotoGps {
  lat: number
  lng: number
}

/** Compresses a photo for upload (spec §6.2 step 3: 1600 px max, quality 0.8),
 * and strips its EXIF data in the process.
 *
 * `preserveExif: false` is the line that satisfies "EXIF supprimé" — do not
 * flip it for convenience (e.g. to keep orientation), the point of this
 * step is that no location or device metadata leaves the browser.
 *
 * `maxSizeMB: 2` mirrors the klash-photos bucket's per-file cap (spec §5):
 * on top of the 1600px/0.8 pass, the library iterates quality downward if
 * needed so an unusually detailed source still clears the bucket's limit
 * instead of being rejected at upload time.
 *
 * `useWebWorker: true` keeps the main thread free while compressing, which
 * is what lets 3 photos compress and upload within the acceptance
 * criterion's 10s budget without janking the UI.
 */
export async function compressPhoto(file: File): Promise<CompressedPhoto> {
  const compressed = await imageCompression(file, {
    maxWidthOrHeight: 1600,
    initialQuality: 0.8,
    maxSizeMB: 2,
    useWebWorker: true,
    preserveExif: false,
  })
  const dimensions = await getImageDimensions(compressed)
  return { file: compressed, width: dimensions.width, height: dimensions.height }
}

function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve({ width: image.naturalWidth, height: image.naturalHeight })
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to read image dimensions'))
    }
    image.src = url
  })
}

/** Reads a photo's embedded GPS position, if any — must run on the
 * *original* file, before compression strips EXIF entirely (spec §6.2 step
 * 3: "lecture préalable du GPS"). Never throws: a file with no GPS data, or
 * one exifr can't parse, resolves to `null` rather than failing the whole
 * photo pick. */
export async function readPhotoGps(file: File): Promise<PhotoGps | null> {
  try {
    const result = await readExifGps(file)
    if (!result || typeof result.latitude !== 'number' || typeof result.longitude !== 'number') {
      return null
    }
    return { lat: result.latitude, lng: result.longitude }
  } catch {
    return null
  }
}
