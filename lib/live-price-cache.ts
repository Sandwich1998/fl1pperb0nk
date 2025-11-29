import { fetchOfficialGuidePrice, type OfficialGuidePrice } from "@/lib/osrs";

type GuideCacheEntry = OfficialGuidePrice & { fetchedAt: number };

const guideCache = new Map<number, GuideCacheEntry>();
const STALE_MS = 30 * 1000;

export async function getGuidePriceFresh(id: number): Promise<GuideCacheEntry | null> {
  if (!Number.isFinite(id)) return null;

  const existing = guideCache.get(id);
  const now = Date.now();
  if (existing && now - existing.fetchedAt < STALE_MS) {
    return existing;
  }

  const fresh = await fetchOfficialGuidePrice(id);
  if (!fresh) return existing ?? null;

  const entry: GuideCacheEntry = { ...fresh, fetchedAt: now };
  guideCache.set(id, entry);
  return entry;
}
