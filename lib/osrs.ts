const API_BASE = "https://prices.runescape.wiki/api/v1/osrs";
const USER_AGENT = "osrs-flip-finder/1.0 (contact@example.com)";

const DEFAULT_MIN_VOLUME = 500;
const DEFAULT_LIMIT = 25;
const MOCK_ENABLED = process.env.MOCK_OSRS_DATA === "1";
const MAX_MARGIN_RATIO = 4; // skip items where margin exceeds 400% of buy price (likely bad data)
const MAX_PRICE_AGE_SECONDS = 60 * 60; // skip if price timestamps are older than 1 hour by default
const DEFAULT_BUY_AGGRESSIVENESS = 0.2; // percent of spread to bid above low
const DEFAULT_SELL_AGGRESSIVENESS = 0.2; // percent of spread to undercut high
const DEFAULT_MAX_FILL_HOURS = 6; // how long we're willing to wait for fills
const DEFAULT_SLOTS_PER_ITEM = 1; // assume dedicating one GE slot per item by default
const MAX_SLOTS = 6;
const DEFAULT_TOTAL_SLOTS = 6;
const MIN_HOURLY_WINDOW = 0.25; // floor for time-based calculations
const HIGH_MARGIN_SKIP_PCT = 0.3; // skip thin-liquidity items with margins above this pct
const HIGH_MARGIN_MIN_VOLUME = 15_000; // require stronger liquidity when margins are large
const WIDE_SPREAD_PCT = 0.65; // if spread exceeds this share of mid, require high volume
const WIDE_SPREAD_MIN_VOLUME = 50_000;
const SHORT_WINDOW_AGGRO_BONUS = 0.05;
const RISK_SIZE_FLOOR = 0.25;

export interface MappingItem {
  id: number;
  name: string;
  examine?: string;
  members?: boolean;
  lowalch?: number;
  limit?: number;
  value?: number;
  highalch?: number;
  ge_id?: number;
}

export interface LatestPriceRecord {
  high: number | null;
  low: number | null;
  highTime: number;
  lowTime: number;
}

export type VolumeRecord = Record<string, number>;

export interface FlipCandidate {
  id: number;
  name: string;
  buyPrice: number;
  sellPrice: number;
  margin: number;
  marginPct: number;
  volume: number;
  maxAffordableQty: number;
  effectiveQty: number;
  estimatedProfit: number;
  recommendedBuyPrice: number;
  recommendedSellPrice: number;
  estimatedFillHours: number;
  estimatedSellHours: number;
  slotsUsed: number;
  profitPerHour: number;
  fit: "low" | "medium" | "high";
  fitReason: string;
}

export interface TimeseriesPoint {
  timestamp: number;
  avgHighPrice: number | null;
  avgLowPrice: number | null;
  highPriceVolume?: number | null;
  lowPriceVolume?: number | null;
}

export type OfficialGuidePrice = {
  price: number | null;
  trend: string | null;
};

type LatestResponse = {
  data: Record<string, LatestPriceRecord>;
};

type VolumeResponse = {
  data: VolumeRecord;
};

const mockMapping: MappingItem[] = [
  { id: 2, name: "Cannonball" },
  { id: 30, name: "Lobster" },
  { id: 4151, name: "Abyssal whip" },
];

const mockLatest: LatestResponse = {
  data: {
    "2": { high: 230, low: 220, highTime: Date.now() / 1000, lowTime: Date.now() / 1000 },
    "30": { high: 310, low: 290, highTime: Date.now() / 1000, lowTime: Date.now() / 1000 },
    "4151": {
      high: 1_950_000,
      low: 1_900_000,
      highTime: Date.now() / 1000,
      lowTime: Date.now() / 1000,
    },
  },
};

const mockVolumes: VolumeResponse = {
  data: {
    "2": 2_000_000,
    "30": 150_000,
    "4151": 7_500,
  },
};

type BudgetParseResult = {
  raw: string;
  value: number;
};

let mappingCache: { data: MappingItem[]; fetchedAt: number } | null = null;
const ONE_HOUR_MS = 60 * 60 * 1000;

function makeHeaders() {
  return {
    "User-Agent": USER_AGENT,
  };
}

async function fetchJson<T>(path: string, revalidateSeconds = 60): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: makeHeaders(),
    next: { revalidate: revalidateSeconds },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch ${path}: ${res.status} ${res.statusText}`);
  }

  return res.json() as Promise<T>;
}

async function fetchMapping(): Promise<MappingItem[]> {
  if (MOCK_ENABLED) {
    return mockMapping;
  }

  const now = Date.now();
  if (mappingCache && now - mappingCache.fetchedAt < ONE_HOUR_MS) {
    return mappingCache.data;
  }

  const data = await fetchJson<MappingItem[]>("/mapping", 3600);
  mappingCache = { data, fetchedAt: now };
  return data;
}

async function fetchLatest(): Promise<LatestResponse> {
  if (MOCK_ENABLED) {
    return mockLatest;
  }

  return fetchJson<LatestResponse>("/latest", 30);
}

async function fetchVolumes(): Promise<VolumeResponse> {
  if (MOCK_ENABLED) {
    return mockVolumes;
  }

  return fetchJson<VolumeResponse>("/volumes", 60);
}

export async function fetchTimeseries(
  id: number,
  timestep: "5m" | "1h" | "24h" = "1h",
): Promise<TimeseriesPoint[]> {
  if (!Number.isFinite(id)) return [];
  const isFast = timestep === "5m";
  const res = await fetch(`${API_BASE}/timeseries?timestep=${timestep}&id=${id}`, {
    headers: makeHeaders(),
    ...(isFast
      ? { cache: "no-store" as const }
      : { next: { revalidate: timestep === "1h" ? 900 : 1800 } }),
  });
  if (!res.ok) return [];
  const body = (await res.json()) as { data?: Array<{ timestamp: number; avgHighPrice: number | null; avgLowPrice: number | null; highPriceVolume?: number | null; lowPriceVolume?: number | null }> };
  return body.data ?? [];
}

function parseGuidePrice(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  if (typeof input === "number" && Number.isFinite(input)) return input;
  if (typeof input !== "string") return null;
  const normalized = input.trim().toLowerCase().replace(/,/g, "");
  const match = normalized.match(/^(\d+(?:\.\d+)?)([kmb])?$/);
  if (match) {
    const [, numPart, suffix] = match;
    let num = Number(numPart);
    if (!Number.isFinite(num)) return null;
    if (suffix === "k") num *= 1_000;
    if (suffix === "m") num *= 1_000_000;
    if (suffix === "b") num *= 1_000_000_000;
    return Math.round(num);
  }
  const fallbackNum = Number(normalized);
  return Number.isFinite(fallbackNum) ? fallbackNum : null;
}

export async function fetchOfficialGuidePrice(id: number): Promise<OfficialGuidePrice | null> {
  if (!Number.isFinite(id)) return null;
  const res = await fetch(
    `https://services.runescape.com/m=itemdb_oldschool/api/catalogue/detail.json?item=${id}`,
    { cache: "no-store" },
  );
  if (!res.ok) return null;
  const body = (await res.json()) as
    | { item?: { current?: { price?: number | string; trend?: string } } }
    | undefined;
  const price = parseGuidePrice(body?.item?.current?.price);
  const trend = body?.item?.current?.trend ?? null;
  return { price, trend };
}

export function parseBudget(input?: string | null): BudgetParseResult {
  const fallback = 10_000_000;
  if (!input) {
    return { raw: "", value: fallback };
  }

  const normalized = input.trim().toLowerCase().replace(/,/g, "");
  const match = normalized.match(/^(\d+)([mk])?$/i);
  if (!match) {
    return { raw: input, value: fallback };
  }

  const [, numPart, suffix] = match;
  let value = Number(numPart);

  if (!Number.isFinite(value) || value <= 0) {
    return { raw: input, value: fallback };
  }

  if (suffix === "m") {
    value *= 1_000_000;
  } else if (suffix === "k") {
    value *= 1_000;
  }

  return { raw: input, value };
}

export async function findBestFlips(
  budgetGp: number,
  options?: {
    minVolume?: number;
    limit?: number;
    buyAggressiveness?: number;
    sellAggressiveness?: number;
    maxFillHours?: number;
    slotsPerItem?: number;
    totalSlots?: number;
    autoDistribute?: boolean;
    favoriteIds?: number[];
    membership?: "all" | "members" | "f2p";
  },
): Promise<FlipCandidate[]> {
  const minVolume = options?.minVolume ?? DEFAULT_MIN_VOLUME;
  const limit = options?.limit ?? DEFAULT_LIMIT;
  const budget = Number.isFinite(budgetGp) && budgetGp > 0 ? Math.floor(budgetGp) : 10_000_000;
  const nowSeconds = Date.now() / 1000;
  const favoriteIds = new Set(options?.favoriteIds ?? []);
  const buyAggressiveness = clamp01(options?.buyAggressiveness ?? DEFAULT_BUY_AGGRESSIVENESS, 0.5);
  const sellAggressiveness = clamp01(options?.sellAggressiveness ?? DEFAULT_SELL_AGGRESSIVENESS, 0.5);
  const maxFillHours = Math.max(MIN_HOURLY_WINDOW, options?.maxFillHours ?? DEFAULT_MAX_FILL_HOURS);
  const tightWindow = maxFillHours <= 1 ? 0.6 : maxFillHours <= 2 ? 0.8 : 1;
  const slotsPerItem = Math.min(
    MAX_SLOTS,
    Math.max(1, Math.floor(options?.slotsPerItem ?? DEFAULT_SLOTS_PER_ITEM)),
  );
  const totalSlots =
    Math.min(MAX_SLOTS, Math.max(1, Math.floor(options?.totalSlots ?? DEFAULT_TOTAL_SLOTS))) || MAX_SLOTS;
  const membershipFilter = options?.membership ?? "all";

  const [mappingRes, latestRes, volumesRes] = await Promise.all([
    fetchMapping(),
    fetchLatest(),
    fetchVolumes(),
  ]);

  const latestData = latestRes.data;
  const volumeData = volumesRes.data;
  const results: FlipCandidate[] = [];

  for (const item of mappingRes) {
    const isMembers = !!item.members;
    if (membershipFilter === "members" && !isMembers) continue;
    if (membershipFilter === "f2p" && isMembers) continue;

    const record = latestData[item.id];
    if (!record) continue;

    const buyPrice = record.low ?? 0;
    const sellPrice = record.high ?? 0;
    if (buyPrice <= 0 || sellPrice <= 0) continue;
    if (buyPrice < 10 || sellPrice > 1_000_000_000) continue;

    // Skip stale price points to avoid nonsense margins
    if (
      nowSeconds - record.lowTime > MAX_PRICE_AGE_SECONDS ||
      nowSeconds - record.highTime > MAX_PRICE_AGE_SECONDS
    ) {
      continue;
    }

    const margin = sellPrice - buyPrice;
    if (margin <= 0) continue;

    const marginPct = margin / buyPrice;
    if (marginPct < 0.005 || marginPct > MAX_MARGIN_RATIO) continue;

    const volume = volumeData?.[item.id] ?? 0;
    const spreadPct = margin / Math.max(1, (buyPrice + sellPrice) / 2);
    const highMarginThin = marginPct >= HIGH_MARGIN_SKIP_PCT && volume < Math.max(minVolume, HIGH_MARGIN_MIN_VOLUME);
    const wideSpreadThin = spreadPct >= WIDE_SPREAD_PCT && volume < WIDE_SPREAD_MIN_VOLUME;
    if (volume < minVolume || highMarginThin || wideSpreadThin) continue;

    const baseBuyAggro = buyAggressiveness;
    const baseSellAggro = sellAggressiveness;
    const timeAggroBoost = maxFillHours <= 1 ? SHORT_WINDOW_AGGRO_BONUS : maxFillHours <= 2 ? SHORT_WINDOW_AGGRO_BONUS / 2 : 0;
    const riskAggroPenalty = marginPct >= 0.35 ? 0.08 : marginPct >= 0.2 ? 0.04 : 0;

    const isFavorite = favoriteIds.has(item.id);
    const highVolumeFav = isFavorite && (volumeData?.[item.id] ?? 0) > 50_000;
    const favAggroBoost = highVolumeFav ? 0.05 : 0;
    const favFillBoost = isFavorite ? 1.5 : 1;

    // Choose slightly aggressive prices to improve fill probability
    const buyCap = 0.55;
    const sellCap = 0.55;
    const tunedBuyAggro = clamp01(baseBuyAggro + favAggroBoost + timeAggroBoost - riskAggroPenalty, 0.5);
    const tunedSellAggro = clamp01(baseSellAggro + favAggroBoost + timeAggroBoost - riskAggroPenalty, 0.5);
    const recommendedBuyPrice = Math.max(
      1,
      Math.min(
        sellPrice,
        Math.floor(
          Math.min(buyPrice + margin * tunedBuyAggro, buyPrice + margin * buyCap),
        ),
      ),
    );
    const recommendedSellPrice = Math.max(
      recommendedBuyPrice + 1,
      Math.floor(
        Math.max(
          sellPrice - margin * tunedSellAggro,
          sellPrice - margin * sellCap,
        ),
      ),
    );

    const adjustedMargin = recommendedSellPrice - recommendedBuyPrice;
    if (adjustedMargin <= 0) continue;

    const safeVolume = Math.min(
      volume,
      typeof item.limit === "number" && item.limit > 0 ? item.limit * 6 : volume,
    );

    const budgetShare =
      options?.autoDistribute && totalSlots > 0
        ? Math.max(1, Math.floor((budget * slotsPerItem) / totalSlots))
        : budget;

    const maxAffordableQty = Math.floor(budgetShare / recommendedBuyPrice);
    if (maxAffordableQty <= 0) continue;

    const perHourVolume = volume / 24;
    // Slow down fill/sell speed to account for order competition and short windows
    const buyPerHour = perHourVolume * (0.6 * tightWindow);
    const sellPerHour = perHourVolume * (0.5 * tightWindow);
    const effectiveMaxFill = maxFillHours;
    const timeCapQty =
      buyPerHour > 0 ? Math.floor(buyPerHour * effectiveMaxFill * slotsPerItem * favFillBoost) : 0;
    const limitQty =
      typeof item.limit === "number" && item.limit > 0 ? Math.floor(item.limit) : Number.POSITIVE_INFINITY;

    const budgetBoundQty = Math.min(maxAffordableQty, safeVolume, limitQty);
    let effectiveQty = Math.max(0, Math.min(budgetBoundQty, timeCapQty > 0 ? timeCapQty : safeVolume));
    // Extra clamp for aggressive short windows: avoid suggesting massive stacks unlikely to fill in <=1h
    if (maxFillHours <= 1 && maxAffordableQty > 0) {
      const shortCap = Math.floor(maxAffordableQty * 0.5);
      effectiveQty = Math.min(effectiveQty, shortCap > 0 ? shortCap : effectiveQty);
    }
    const riskSizeMultiplier = computeRiskSizeMultiplier({
      marginPct,
      volume,
      minVolume,
      maxFillHours,
    });
    effectiveQty = Math.floor(effectiveQty * riskSizeMultiplier);
    if (effectiveQty === 0 && maxAffordableQty > 0) {
      effectiveQty = 1;
    }

    // If the budget-sized stack still fits within the fill/sell windows, prefer spending the budget.
    if (budgetBoundQty > effectiveQty) {
      const budgetFillHours =
        buyPerHour > 0 ? budgetBoundQty / Math.max(buyPerHour, 1 / (MIN_HOURLY_WINDOW * 24)) : Number.POSITIVE_INFINITY;
      const budgetSellHours =
        sellPerHour > 0 ? budgetBoundQty / Math.max(sellPerHour, 1 / (MIN_HOURLY_WINDOW * 24)) : Number.POSITIVE_INFINITY;
      if (budgetFillHours <= effectiveMaxFill * favFillBoost && budgetSellHours <= effectiveMaxFill * favFillBoost * 1.2) {
        effectiveQty = budgetBoundQty;
      }
    }
    if (effectiveQty <= 0) continue;

    const estimatedFillHours =
      buyPerHour > 0 ? effectiveQty / Math.max(buyPerHour, 1 / (MIN_HOURLY_WINDOW * 24)) : Number.POSITIVE_INFINITY;
    if (estimatedFillHours > effectiveMaxFill * favFillBoost) continue;

    const estimatedSellHours =
      sellPerHour > 0 ? effectiveQty / Math.max(sellPerHour, 1 / (MIN_HOURLY_WINDOW * 24)) : Number.POSITIVE_INFINITY;

    const estimatedProfit = adjustedMargin * effectiveQty;
    if (estimatedProfit <= 0) continue;

    const cycleHours = Math.max(MIN_HOURLY_WINDOW, estimatedFillHours + estimatedSellHours);
    const profitPerHour = estimatedProfit / cycleHours;
    const { fit, fitReason } = computeFitLevel({
      volume,
      desiredQty: effectiveQty,
      marginPct: adjustedMargin / recommendedBuyPrice,
      spreadPct,
      estimatedFillHours,
      estimatedSellHours,
      maxFillHours,
    });

    results.push({
      id: item.id,
      name: item.name,
      buyPrice,
      sellPrice,
      margin: adjustedMargin,
      marginPct: adjustedMargin / recommendedBuyPrice,
      volume,
      maxAffordableQty,
      effectiveQty,
      estimatedProfit,
      recommendedBuyPrice,
      recommendedSellPrice,
      estimatedFillHours,
      estimatedSellHours,
      slotsUsed: slotsPerItem,
      profitPerHour,
      fit,
      fitReason,
    });
  }

  results.sort((a, b) => b.estimatedProfit - a.estimatedProfit);
  return results.slice(0, limit);
}

function clamp01(value: number, max = 1) {
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.min(max, value);
}

function computeRiskSizeMultiplier({
  marginPct,
  volume,
  minVolume,
  maxFillHours,
}: {
  marginPct: number;
  volume: number;
  minVolume: number;
  maxFillHours: number;
}) {
  let multiplier = 1;

  if (marginPct >= 0.35) {
    multiplier *= 0.5;
  } else if (marginPct >= 0.2) {
    multiplier *= 0.7;
  }

  if (volume < minVolume * 3) {
    multiplier *= 0.7;
  } else if (volume < minVolume * 5) {
    multiplier *= 0.85;
  }

  if (maxFillHours <= 1) {
    multiplier *= 0.9;
  } else if (maxFillHours <= 2) {
    multiplier *= 0.95;
  }

  return Math.max(RISK_SIZE_FLOOR, Math.min(1, multiplier));
}

function computeFitLevel({
  volume,
  desiredQty,
  marginPct,
  spreadPct,
  estimatedFillHours,
  estimatedSellHours,
  maxFillHours,
}: {
  volume: number;
  desiredQty: number;
  marginPct: number;
  spreadPct: number;
  estimatedFillHours: number;
  estimatedSellHours: number;
  maxFillHours: number;
}) {
  const cycleHours = estimatedFillHours + estimatedSellHours;
  const volumeToQty = desiredQty > 0 ? volume / desiredQty : 0;
  const meetsTime = cycleHours <= maxFillHours * 1.05;

  // Low fit: thin liquidity or extreme margins/spreads or too slow
  if (volumeToQty < 5 || marginPct > 0.5 || spreadPct > 0.65 || !meetsTime) {
    return { fit: "low" as const, fitReason: "Thin liquidity or slow/volatile trade" };
  }

  // High fit: plenty of volume, moderate margins, reasonable spread, fits time
  if (volumeToQty >= 15 && marginPct >= 0.05 && marginPct <= 0.35 && spreadPct <= 0.5 && meetsTime) {
    return { fit: "high" as const, fitReason: "Strong liquidity and moderate margin within window" };
  }

  return { fit: "medium" as const, fitReason: "Decent liquidity but watch fills/price moves" };
}
