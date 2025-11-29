import { NextResponse } from "next/server";
import { fetchTimeseries } from "@/lib/osrs";
import { getCachedJson } from "@/lib/wiki-cache";

export async function GET(
  _req: Request,
  context: { params: { id: string } },
) {
  const { id } = context.params;
  const itemId = Number(id);
  if (!Number.isFinite(itemId) || itemId <= 0) {
    return NextResponse.json({ error: "Invalid item id" }, { status: 400 });
  }

  const url = new URL(_req.url);
  const timestepParam = url.searchParams.get("timestep");
  const allowed = new Set(["5m", "1h", "24h"]);
  const timestep = allowed.has(timestepParam || "") ? (timestepParam as any) : "1h";

  try {
    // Cache the fast intervals in-process for 60s to avoid hammering upstream while staying fresh.
    const cacheKey = `ts-${itemId}-${timestep}`;
    const cached = await getCachedJson<{ id: number; timestep: string; count: number; points: unknown[] }>(
      cacheKey,
      `/timeseries?timestep=${timestep}&id=${itemId}`,
      60_000,
    );
    const data = Array.isArray(cached?.points) ? cached?.points : await fetchTimeseries(itemId, timestep);
    return NextResponse.json({
      id: itemId,
      timestep,
      count: Array.isArray(data) ? data.length : 0,
      points: Array.isArray(data) ? data : [],
    });
  } catch (error) {
    console.error("history error", error);
    return NextResponse.json({ error: "Failed to fetch history" }, { status: 500 });
  }
}
