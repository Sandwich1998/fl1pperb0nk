import { NextResponse } from "next/server";
import { findBestFlips } from "@/lib/osrs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limitParam = Number(searchParams.get("limit"));
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(120, Math.floor(limitParam)) : 40;

  try {
    const flips = await findBestFlips(20_000_000, {
      minVolume: 100_000,
      maxFillHours: 2,
      limit,
      totalSlots: 6,
      autoDistribute: true,
      membership: "all",
    });

    // Prefer volume, then profit per hour
    const sorted = [...flips].sort((a, b) => {
      if (b.volume === a.volume) return b.profitPerHour - a.profitPerHour;
      return b.volume - a.volume;
    });

    return NextResponse.json({ flips: sorted.slice(0, limit) });
  } catch (error) {
    console.error("high-volume error", error);
    return NextResponse.json({ error: "Failed to load high-volume flips" }, { status: 500 });
  }
}
