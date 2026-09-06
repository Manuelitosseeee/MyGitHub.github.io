/** Minimal promise-based IndexedDB wrapper. We keep one database with a
 *  single object store of arbitrary structured-clone values, which is enough
 *  for this app's local-only data (and trivially portable to a Swift model). */

const DB_NAME = "scala-db";
const STORE = "kv";
const VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
  });
  return dbPromise;
}

function tx<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T> | void
): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const s = t.objectStore(STORE);
        let result: T | undefined;
        const r = fn(s);
        if (r) {
          r.onsuccess = () => {
            result = r.result as T;
          };
          r.onerror = () => reject(r.error ?? new Error("request failed"));
        }
        t.oncomplete = () => resolve(result as T);
        t.onerror = () => reject(t.error ?? new Error("tx failed"));
        t.onabort = () => reject(t.error ?? new Error("tx aborted"));
      })
  );
}

export async function idbGet<T>(key: string): Promise<T | undefined> {
  return tx("readonly", (s) => s.get(key));
}

export async function idbSet(key: string, value: unknown): Promise<void> {
  return tx("readwrite", (s) => {
    s.put(value, key);
  });
}

export async function idbDelete(key: string): Promise<void> {
  return tx("readwrite", (s) => s.delete(key));
}

export async function idbClear(): Promise<void> {
  return tx("readwrite", (s) => s.clear());
}
