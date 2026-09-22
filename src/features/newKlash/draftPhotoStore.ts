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

// Every read/write below runs through this single-file queue. IndexedDB only
// orders readwrite transactions by the order their *transaction* is created,
// not by call order, and each function here awaits openDb() before creating
// its transaction — so two overlapping calls (an autosave's saveDraftPhotos
// racing a restore's loadDraftPhotos, or two saves in a row) could otherwise
// create their transactions in either order regardless of which call
// happened first. Chaining every operation onto one promise forces them to
// run one at a time, in call order. Safe to do unconditionally: every
// operation below already swallows its own errors (see their try/catches),
// so it never rejects and can't jam the queue for whatever runs after it.
let queue: Promise<void> = Promise.resolve()

function enqueue<T>(operation: () => Promise<T>): Promise<T> {
  const result = queue.then(operation)
  queue = result.then(() => undefined)
  return result
}

/** Pure id-set diff, used by `saveDraftPhotos` to avoid rewriting an
 * unchanged photo's blob. Exported separately so it's unit-testable without
 * IndexedDB, which jsdom doesn't have (same reasoning this module's other
 * functions go untested for). */
export function diffDraftPhotoIds(
  existingIds: string[],
  nextIds: string[],
): { toDelete: string[]; toAdd: string[] } {
  const existingSet = new Set(existingIds)
  const nextSet = new Set(nextIds)
  return {
    toDelete: existingIds.filter((id) => !nextSet.has(id)),
    toAdd: nextIds.filter((id) => !existingSet.has(id)),
  }
}

/** Persists the given photo files, keyed by their `PendingPhoto` id, as the
 * draft's complete photo set. Reads the store's current keys and writes only
 * the delta (`diffDraftPhotoIds`) inside one transaction, rather than
 * clearing and re-`put`-ting everything: a `PendingPhoto`'s id is assigned
 * once and its bytes never change, so an already-stored id doesn't need
 * rewriting — at up to `MAX_PHOTOS_PER_KLASH` photos and 2 MB each, blindly
 * rewriting all of them on every added or removed photo would mean tens of
 * MB of blob writes for a single new photo. Never throws: any IndexedDB
 * failure (unavailable, quota) is swallowed, leaving the draft's text
 * restorable even when its photos aren't. */
export function saveDraftPhotos(photos: { id: string; file: File }[]): Promise<void> {
  return enqueue(async () => {
    let db: IDBDatabase | undefined
    try {
      db = await openDb()
      const database = db
      await new Promise<void>((resolve, reject) => {
        const tx = database.transaction(STORE_NAME, 'readwrite')
        const store = tx.objectStore(STORE_NAME)
        const keysRequest = store.getAllKeys()
        keysRequest.onsuccess = () => {
          const existingIds = keysRequest.result.map(String)
          const nextIds = photos.map((photo) => photo.id)
          const { toDelete, toAdd } = diffDraftPhotoIds(existingIds, nextIds)
          for (const id of toDelete) store.delete(id)
          const toAddSet = new Set(toAdd)
          for (const photo of photos) {
            if (toAddSet.has(photo.id)) store.put(photo.file, photo.id)
          }
        }
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
        tx.onabort = () => reject(tx.error)
      })
    } catch {
      // See docblock — a photo that fails to save just won't come back.
    } finally {
      db?.close()
    }
  })
}

/** Loads every stored draft photo, keyed by id. Returns an empty map on any
 * failure — callers then restore whatever text/metadata they have and treat
 * photos referenced in that metadata but absent here as gone. */
export function loadDraftPhotos(): Promise<Map<string, File>> {
  return enqueue(async () => {
    let db: IDBDatabase | undefined
    try {
      db = await openDb()
      const database = db
      const entries = await new Promise<[IDBValidKey, File][]>((resolve, reject) => {
        const tx = database.transaction(STORE_NAME, 'readonly')
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
      return new Map(entries.map(([key, file]) => [String(key), file]))
    } catch {
      return new Map()
    } finally {
      db?.close()
    }
  })
}

export function clearDraftPhotos(): Promise<void> {
  return enqueue(async () => {
    let db: IDBDatabase | undefined
    try {
      db = await openDb()
      const database = db
      await new Promise<void>((resolve, reject) => {
        const tx = database.transaction(STORE_NAME, 'readwrite')
        tx.objectStore(STORE_NAME).clear()
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
        tx.onabort = () => reject(tx.error)
      })
    } catch {
      // See saveDraftPhotos' docblock.
    } finally {
      db?.close()
    }
  })
}
