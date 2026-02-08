/**
 * IndexedDB helpers for storing directory handles
 */

const DB_NAME = 'testblocks-storage';
const STORE_NAME = 'handles';

/**
 * Open the IndexedDB database
 */
export async function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

/**
 * Save a directory handle to IndexedDB
 */
export async function saveDirectoryHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  console.log('[Storage] Saving directory handle:', handle.name);
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(handle, 'lastDirectory');
    request.onerror = () => {
      console.error('[Storage] Failed to save handle:', request.error);
      reject(request.error);
    };
    request.onsuccess = () => {
      console.log('[Storage] Handle saved successfully');
      resolve();
    };
  });
}

/**
 * Get the stored directory handle from IndexedDB
 */
export async function getStoredDirectoryHandle(): Promise<FileSystemDirectoryHandle | null> {
  console.log('[Storage] Getting stored directory handle...');
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get('lastDirectory');
      request.onerror = () => {
        console.error('[Storage] Failed to get handle:', request.error);
        reject(request.error);
      };
      request.onsuccess = () => {
        const handle = request.result || null;
        console.log('[Storage] Retrieved handle:', handle ? handle.name : 'null');
        resolve(handle);
      };
    });
  } catch (e) {
    console.error('[Storage] Error getting handle:', e);
    return null;
  }
}
