import { fetchJson } from "@/lib/wiki-fetch";

const DEFAULT_STALE_MS = 60 * 1000;
const cache = new Map<string, { data: unknown; fetchedAt: number; ttl: number }>();

export async function getCachedJson<T>(
  key: string,
  url: string,
  ttlMs: number = DEFAULT_STALE_MS,
): Promise<T | null> {
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && now - cached.fetchedAt < cached.ttl) {
    return cached.data as T;
  }
  try {
    const data = await fetchJson<T>(url, { cache: "no-store" });
    cache.set(key, { data, fetchedAt: now, ttl: ttlMs });
    return data;
  } catch {
    return cached ? (cached.data as T) : null;
  }
}
