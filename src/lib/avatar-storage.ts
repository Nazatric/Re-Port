/** Animated avatars must retain their original frames, and can exceed localStorage's quota. */
const PREFIX = 'avatar-blob:';
const DB = 'report-profile-images';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('images');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open image storage'));
  });
}

export function isStoredAvatar(url: string): boolean { return url.startsWith(PREFIX); }

export async function storeAnimatedAvatar(file: File): Promise<string> {
  const db = await openDatabase();
  const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('images', 'readwrite');
      tx.objectStore('images').put(file, id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('Could not save GIF'));
      tx.onabort = () => reject(tx.error ?? new Error('Could not save GIF'));
    });
    return PREFIX + id;
  } finally { db.close(); }
}

export async function loadStoredAvatar(url: string): Promise<Blob | undefined> {
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction('images', 'readonly').objectStore('images').get(url.slice(PREFIX.length));
      request.onsuccess = () => resolve(request.result as Blob | undefined);
      request.onerror = () => reject(request.error);
    });
  } finally { db.close(); }
}
