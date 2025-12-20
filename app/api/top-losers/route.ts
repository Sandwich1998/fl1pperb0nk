import { NextResponse } from "next/server";
import { getCachedJson } from "@/lib/wiki-cache";

type LatestResponse = {
  data: Record<
    string,
    {
      high: number | null;
      low: number | null;
      highTime: number;
      lowTime: number;
    }
  >;
};

type Summary24hResponse = {
  data: Record<
    string,
    {
      avgHighPrice: number | null;
      avgLowPrice: number | null;
      highPriceVolume?: number | null;
      lowPriceVolume?: number | null;
    }
  >;
};

type MappingItem = {
  id: number;
  name: string;
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limitParam = Number(searchParams.get("limit"));
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(50, Math.floor(limitParam)) : 10;

  try {
    const [latest, summary24h, mapping] = await Promise.all([
      getCachedJson<LatestResponse>("top-losers-latest", "/latest", 30_000),
      getCachedJson<Summary24hResponse>("top-losers-24h", "/24h", 60_000),
      getCachedJson<MappingItem[]>("top-losers-mapping", "/mapping", 60 * 60 * 1000),
    ]);

    if (!latest || !summary24h || !mapping) {
      throw new Error("Missing wiki data");
    }

    const nameMap = new Map<number, string>();
    for (const item of mapping) {
      if (Number.isFinite(item.id)) {
        nameMap.set(item.id, item.name);
      }
    }

    const results: Array<{
      id: number;
      name: string;
      currentPrice: number;
      avg24hPrice: number;
      change: number;
      changePct: number;
      volume24h: number | null;
    }> = [];

    for (const [idKey, record] of Object.entries(summary24h.data ?? {})) {
      const latestRecord = latest.data?.[idKey];
      if (!latestRecord) continue;
      const avgHigh = record.avgHighPrice;
      const avgLow = record.avgLowPrice;
      const high = latestRecord.high;
      const low = latestRecord.low;
      if (avgHigh === null || avgLow === null || high === null || low === null) {
        continue;
      }
      if (!Number.isFinite(avgHigh) || !Number.isFinite(avgLow) || !Number.isFinite(high) || !Number.isFinite(low)) {
        continue;
      }
      const avg24h = (avgHigh + avgLow) / 2;
      const current = (high + low) / 2;
      if (!Number.isFinite(avg24h) || !Number.isFinite(current) || avg24h <= 0) continue;
      const change = current - avg24h;
      if (change >= 0) continue;

      const volume =
        (record.highPriceVolume ?? 0) + (record.lowPriceVolume ?? 0);
      const id = Number(idKey);
      results.push({
        id,
        name: nameMap.get(id) ?? `Item ${idKey}`,
        currentPrice: Math.round(current),
        avg24hPrice: Math.round(avg24h),
        change: Math.round(change),
        changePct: change / avg24h,
        volume24h: Number.isFinite(volume) ? volume : null,
      });
    }

    results.sort((a, b) => a.change - b.change);

    return NextResponse.json({ items: results.slice(0, limit) });
  } catch (error) {
    console.error("top-losers error", error);
    return NextResponse.json({ error: "Failed to load top losers" }, { status: 500 });
  }
}
