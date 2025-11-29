import { NextResponse } from "next/server";
import { findBestFlips, parseBudget } from "@/lib/osrs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const budgetParam = searchParams.get("budget");
  const minVolumeParam = searchParams.get("minVolume");
  const slotsParam = searchParams.get("slots");
  const maxFillHoursParam = searchParams.get("maxFillHours");
  const buyAggroParam = searchParams.get("buyAggro");
  const sellAggroParam = searchParams.get("sellAggro");
  const limitParam = searchParams.get("limit");
  const totalSlotsParam = searchParams.get("totalSlots");
  const favoritesParam = searchParams.get("favorites");
  const membershipParam = searchParams.get("membership");

  const parsedBudget = parseBudget(budgetParam);
  const minVolume = (() => {
    const parsed = Number(minVolumeParam);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 500;
  })();
  const slots = (() => {
    const parsed = Number(slotsParam);
    return Number.isFinite(parsed) ? parsed : undefined;
  })();
  const maxFillHours = (() => {
    const parsed = Number(maxFillHoursParam);
    return Number.isFinite(parsed) ? parsed : undefined;
  })();
  const buyAggro = (() => {
    const parsed = Number(buyAggroParam);
    return Number.isFinite(parsed) ? parsed : undefined;
  })();
  const sellAggro = (() => {
    const parsed = Number(sellAggroParam);
    return Number.isFinite(parsed) ? parsed : undefined;
  })();
  const limit = (() => {
    const parsed = Number(limitParam);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 25;
  })();
  const totalSlots = (() => {
    const parsed = Number(totalSlotsParam);
    return Number.isFinite(parsed) ? parsed : undefined;
  })();
  const membership: "all" | "members" | "f2p" =
    membershipParam === "members" || membershipParam === "f2p" ? membershipParam : "all";
  const favoriteIds =
    favoritesParam && favoritesParam.length > 0
      ? favoritesParam
          .split(",")
          .map((s) => Number(s.trim()))
          .filter((n) => Number.isFinite(n))
      : undefined;

  try {
    const flips = await findBestFlips(parsedBudget.value, {
      minVolume,
      limit,
      slotsPerItem: slots,
      maxFillHours,
      buyAggressiveness: buyAggro,
      sellAggressiveness: sellAggro,
      totalSlots,
      favoriteIds,
      membership,
    });

    return NextResponse.json({
      budget: parsedBudget.value,
      minVolume,
      slots: slots ?? null,
      maxFillHours: maxFillHours ?? null,
      buyAggro: buyAggro ?? null,
      sellAggro: sellAggro ?? null,
      limit,
      totalSlots: totalSlots ?? null,
      favorites: favoriteIds ?? [],
      membership,
      count: flips.length,
      flips,
    });
  } catch (error) {
    console.error("best-flips error", error);
    const message =
      error instanceof Error ? error.message : "Failed to fetch flip data";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
