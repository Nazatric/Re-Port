/** Tiered cache: byte-bounded in-memory LRU (L1) + persistent localStorage (L2),
 *  stale-while-revalidate network resolution with deterministic exponential backoff. */

interface Entry<T> { value: T; expires: number; size: number }
const PREFIX = "report:v2:";
const MAX_BYTES = 1_500_000;

class Lru<T> {
  private map = new Map<string, Entry<T>>();
  private bytes = 0;
  get(key: string): Entry<T> | undefined {
    const e = this.map.get(key);
    if (!e) return undefined;
    this.map.delete(key);
    this.map.set(key, e);
    return e;
  }
  set(key: string, value: T, ttl: number) {
    const prev = this.map.get(key);
    if (prev) this.bytes -= prev.size;
    const size = estimate(value);
    this.map.delete(key);
    this.map.set(key, { value, expires: Date.now() + ttl, size });
    this.bytes += size;
    while (this.bytes > MAX_BYTES && this.map.size > 1) {
      const oldest = this.map.keys().next().value as string;
      const e = this.map.get(oldest)!;
      this.bytes -= e.size;
      this.map.delete(oldest);
    }
  }
  delete(key: string) {
    const e = this.map.get(key);
    if (e) { this.bytes -= e.size; this.map.delete(key); }
  }
}
function estimate(v: unknown): number {
  try { return JSON.stringify(v).length * 2; } catch { return 256; }
}
const l1 = new Lru<unknown>();

function l2Get<T>(key: string): Entry<T> | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as Entry<T>) : null;
  } catch { return null; }
}
function l2Set<T>(key: string, e: Entry<T>) {
  try { localStorage.setItem(PREFIX + key, JSON.stringify(e)); } catch { /* quota — L1 still serves */ }
}

export function readCache<T>(key: string): { value: T; stale: boolean } | null {
  const mem = l1.get(key) as Entry<T> | undefined;
  if (mem) return { value: mem.value, stale: Date.now() > mem.expires };
  const disk = l2Get<T>(key);
  if (!disk) return null;
  l1.set(key, disk.value, Math.max(0, disk.expires - Date.now()));
  return { value: disk.value, stale: Date.now() > disk.expires };
}
export function writeCache<T>(key: string, value: T, ttl = 6 * 60 * 60 * 1000) {
  l1.set(key, value, ttl);
  l2Set(key, { value, expires: Date.now() + ttl, size: estimate(value) });
}
export function invalidate(key: string) {
  l1.delete(key);
  try { localStorage.removeItem(PREFIX + key); } catch { /* ignore */ }
}

export class NetworkError extends Error {
  constructor(message: string, readonly attempts: number) { super(message); }
}

async function fetchWithRetry(url: string, timeoutMs = 8000): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: controller.signal, headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      clearTimeout(timer);
      return res;
    } catch (e) {
      clearTimeout(timer);
      lastError = e;
      if (attempt < 2) await new Promise((r) => setTimeout(r, 350 * 2 ** attempt));
    }
  }
  throw new NetworkError(lastError instanceof Error ? lastError.message : "Network unavailable", 3);
}

/** Serve cached data immediately, revalidate in background, coalesce duplicate requests. */
const inflight = new Map<string, Promise<unknown>>();
export async function swrJson<T>(key: string, url: string, ttl = 6 * 60 * 60 * 1000): Promise<T> {
  const cached = readCache<T>(key);
  let job = inflight.get(key) as Promise<T> | undefined;
  if (!job) {
    job = (async () => {
      const res = await fetchWithRetry(url);
      const value = (await res.json()) as T;
      writeCache(key, value, ttl);
      return value;
    })();
    inflight.set(key, job);
    const pending = job;
    void job.then(
      () => { if (inflight.get(key) === pending) inflight.delete(key); },
      () => { if (inflight.get(key) === pending) inflight.delete(key); },
    );
  }
  if (cached && !cached.stale) {
    void job.catch(() => undefined);
    return cached.value;
  }
  try { return await job; }
  catch (e) {
    if (cached) return cached.value;
    throw e;
  }
}

export async function freshJson<T>(url: string, timeoutMs = 8000): Promise<T> {
  const res = await fetchWithRetry(url, timeoutMs);
  return (await res.json()) as T;
}
