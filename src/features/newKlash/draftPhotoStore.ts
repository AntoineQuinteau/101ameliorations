const DB_NAME = 'klash-drafts'
const DB_VERSION = 1
const STORE_NAME = 'photos'

/** Opens (and, on first use, creates) the drafts database. Rejects rather
 * than throwing synchronously so every caller can handle "IndexedDB
 * unavailable" (Safari private browsing, a blocked/quota-exceeded origin)
 * the same way: catch and degrade, never crash the report flow over a
 * draft that simply won't persist its photos. */
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

/** Persists the given photo files, keyed by their `PendingPhoto` id, as the
 * draft's complete photo set — replaces whatever was stored before in one
 * transaction, so a photo removed by the user is also removed here rather
 * than resurrected on the next restore. Never throws: any IndexedDB failure
 * (unavailable, quota) is swallowed, leaving the draft's text restorable
 * even when its photos aren't. */
export async function saveDraftPhotos(photos: { id: string; file: File }[]): Promise<void> {
  try {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      store.clear()
      for (const photo of photos) store.put(photo.file, photo.id)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })
    db.close()
  } catch {
    // See docblock — a photo that fails to save just won't come back.
  }
}

/** Loads every stored draft photo, keyed by id. Returns an empty map on any
 * failure — callers then restore whatever text/metadata they have and treat
 * photos referenced in that metadata but absent here as gone. */
export async function loadDraftPhotos(): Promise<Map<string, File>> {
  try {
    const db = await openDb()
    const entries = await new Promise<[IDBValidKey, File][]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const keysRequest = store.getAllKeys()
      const valuesRequest = store.getAll()
      tx.oncomplete = () => {
        const keys = keysRequest.result
        const values = valuesRequest.result as File[]
        resolve(keys.map((key, index) => [key, values[index]]))
      }
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })
    db.close()
    return new Map(entries.map(([key, file]) => [String(key), file]))
  } catch {
    return new Map()
  }
}

export async function clearDraftPhotos(): Promise<void> {
  try {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).clear()
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })
    db.close()
  } catch {
    // See saveDraftPhotos' docblock.
  }
}
