// =============================================================================
//  lib/offline/db.ts
//  Thin Promise-based wrapper over the browser's IndexedDB API.
//
//  We deliberately avoid pulling in a dependency (Dexie, idb) so the offline
//  layer adds zero bytes to the bundle beyond what we write here. The API is
//  intentionally small — get/getAll/put/delete/clear/transaction.
// =============================================================================

import { DB_NAME, DB_VERSION, STORES, type StoreName } from './schema';

let dbPromise: Promise<IDBDatabase> | null = null;

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof indexedDB !== 'undefined';
}

function open(): Promise<IDBDatabase> {
  if (!isBrowser()) {
    return Promise.reject(new Error('IndexedDB is only available in the browser'));
  }
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const spec of STORES) {
        let store: IDBObjectStore;
        if (!db.objectStoreNames.contains(spec.name)) {
          store = db.createObjectStore(spec.name, { keyPath: spec.keyPath });
        } else {
          store = req.transaction!.objectStore(spec.name);
        }
        for (const idx of spec.indexes ?? []) {
          const [idxName, idxKey, unique] = idx;
          if (!store.indexNames.contains(idxName)) {
            store.createIndex(idxName, idxKey, { unique: !!unique });
          }
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'));
    req.onblocked = () =>
      reject(new Error('IndexedDB blocked — close other tabs running this app'));
  });
  return dbPromise;
}

function promisify<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'));
  });
}

// ─── Public API ────────────────────────────────────────────────────────────

export const idb = {
  isAvailable: isBrowser,

  async getAll<T = unknown>(store: StoreName): Promise<T[]> {
    const db = await open();
    const tx = db.transaction(store, 'readonly');
    return promisify<T[]>(tx.objectStore(store).getAll());
  },

  async get<T = unknown>(store: StoreName, key: IDBValidKey): Promise<T | undefined> {
    const db = await open();
    const tx = db.transaction(store, 'readonly');
    return promisify<T | undefined>(tx.objectStore(store).get(key));
  },

  async getByIndex<T = unknown>(
    store: StoreName,
    index: string,
    value: IDBValidKey,
  ): Promise<T[]> {
    const db = await open();
    const tx = db.transaction(store, 'readonly');
    return promisify<T[]>(tx.objectStore(store).index(index).getAll(value));
  },

  async put<T = unknown>(store: StoreName, value: T): Promise<void> {
    const db = await open();
    const tx = db.transaction(store, 'readwrite');
    await promisify(tx.objectStore(store).put(value as unknown));
    await txDone(tx);
  },

  async bulkPut<T = unknown>(store: StoreName, values: readonly T[]): Promise<void> {
    if (values.length === 0) return;
    const db = await open();
    const tx = db.transaction(store, 'readwrite');
    const os = tx.objectStore(store);
    for (const v of values) os.put(v as unknown);
    await txDone(tx);
  },

  async delete(store: StoreName, key: IDBValidKey): Promise<void> {
    const db = await open();
    const tx = db.transaction(store, 'readwrite');
    await promisify(tx.objectStore(store).delete(key));
    await txDone(tx);
  },

  async clear(store: StoreName): Promise<void> {
    const db = await open();
    const tx = db.transaction(store, 'readwrite');
    await promisify(tx.objectStore(store).clear());
    await txDone(tx);
  },

  async replaceAll<T = unknown>(store: StoreName, values: readonly T[]): Promise<void> {
    const db = await open();
    const tx = db.transaction(store, 'readwrite');
    const os = tx.objectStore(store);
    await promisify(os.clear());
    for (const v of values) os.put(v as unknown);
    await txDone(tx);
  },

  async count(store: StoreName): Promise<number> {
    const db = await open();
    const tx = db.transaction(store, 'readonly');
    return promisify<number>(tx.objectStore(store).count());
  },

  /** Drop and re-open the database — used on sign-out to wipe local data. */
  async wipe(): Promise<void> {
    if (!isBrowser()) return;
    if (dbPromise) {
      try {
        const db = await dbPromise;
        db.close();
      } catch {
        // ignore
      }
      dbPromise = null;
    }
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.deleteDatabase(DB_NAME);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error ?? new Error('wipe failed'));
      req.onblocked = () => resolve(); // proceed; will finish when handles close
    });
  },
};

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error ?? new Error('Transaction aborted'));
    tx.onerror = () => reject(tx.error ?? new Error('Transaction failed'));
  });
}
