"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import type { FlipCandidate } from "@/lib/osrs";

const numberFormatter = new Intl.NumberFormat("en-US");

const itemIcon = (id: number) =>
  `https://secure.runescape.com/m=itemdb_oldschool/obj_sprite.gif?id=${id}`;

type MembershipFilter = "all" | "members" | "f2p";
type ViewMode = "catalog" | "hot" | "active" | "success" | "failed" | "all";

type TradeStatus = "buying" | "selling" | "done";

type TradeSettings = {
  budget: number | null;
  minVolume: number | null;
  maxFillHours: number | null;
  buyAggro: number | null;
  sellAggro: number | null;
  limit: number | null;
  membership: MembershipFilter;
};

type ActiveTrade = {
  id: number;
  name: string;
  quantity: number;
  buyPrice: number;
  sellPrice: number;
  startedAt: number; // epoch ms
  estBuyHours: number;
  estSellHours: number;
  status: TradeStatus;
  volume: number;
  margin: number;
  marginPct: number;
  estimatedProfit: number;
  profitPerHour: number;
  fit?: "low" | "medium" | "high";
  fitReason?: string;
  note: string | null;
  settings: TradeSettings;
};

type FailedTrade = {
  id: number;
  name: string;
  quantity: number;
  buyPrice: number;
  sellPrice: number;
  startedAt: number;
  failedAt: number;
  estBuyHours: number;
  estSellHours: number;
  failedStage: TradeStatus;
  reason: string | null;
  volume: number;
  margin: number;
  marginPct: number;
  estimatedProfit: number;
  profitPerHour: number;
  fit?: "low" | "medium" | "high";
  fitReason?: string;
  settings: TradeSettings;
};

type SuccessTrade = {
  id: number;
  name: string;
  quantity: number;
  buyPrice: number;
  sellPrice: number;
  startedAt: number;
  completedAt: number;
  estBuyHours: number;
  estSellHours: number;
  note: string | null;
  boughtWithinEstimate: number | null;
  soldWithinEstimate: number | null;
  volume: number;
  margin: number;
  marginPct: number;
  estimatedProfit: number;
  profitPerHour: number;
  fit?: "low" | "medium" | "high";
  fitReason?: string;
  settings: TradeSettings;
  actualBuyPrice: number | null;
  actualSellPrice: number | null;
  actualSoldQuantity: number | null;
};

type CatalogItem = {
  id: number;
  name: string;
  members: boolean;
  limit: number | null;
  buy: number | null;
  sell: number | null;
  margin: number | null;
  marginPct: number | null;
  volume: number | null;
};

type TopGainer = {
  id: number;
  name: string;
  currentPrice: number;
  avg24hPrice: number;
  change: number;
  changePct: number;
  volume24h: number | null;
};

export default function HomePage() {
  const [hotFlips, setHotFlips] = useState<FlipCandidate[] | null>(null);
  const [hotLoading, setHotLoading] = useState(false);
  const [hotError, setHotError] = useState<string | null>(null);
  const [topGainers, setTopGainers] = useState<TopGainer[] | null>(null);
  const [topGainersLoading, setTopGainersLoading] = useState(false);
  const [topGainersError, setTopGainersError] = useState<string | null>(null);
  const [topLosers, setTopLosers] = useState<TopGainer[] | null>(null);
  const [topLosersLoading, setTopLosersLoading] = useState(false);
  const [topLosersError, setTopLosersError] = useState<string | null>(null);
  const [activeTrades, setActiveTrades] = useState<ActiveTrade[]>([]);
  const [failedTrades, setFailedTrades] = useState<FailedTrade[]>([]);
  const [successfulTrades, setSuccessfulTrades] = useState<SuccessTrade[]>([]);
  const [catalogItems, setCatalogItems] = useState<CatalogItem[] | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [catalogFilter, setCatalogFilter] = useState("");
  const [catalogSort, setCatalogSort] = useState<"volume" | "margin" | "marginPct" | "name">("volume");
  const [catalogMembership, setCatalogMembership] = useState<MembershipFilter>("all");
  const [catalogLimit, setCatalogLimit] = useState(240);
  const [viewMode, setViewMode] = useState<ViewMode>("hot");
  const [latestMap, setLatestMap] = useState<Record<number, { buy: number; sell: number }>>({});
  const [now, setNow] = useState(() => Date.now());

  const formatMillions = (value: number) => `${(value / 1_000_000).toFixed(1)}M`;
  const formatMillionsSigned = (value: number) => `${value >= 0 ? "+" : ""}${formatMillions(value)}`;

  useEffect(() => {
    const storedTrades = localStorage.getItem("osrs-active-trades");
    const storedFailedTrades = localStorage.getItem("osrs-failed-trades");
    const storedSuccessTrades = localStorage.getItem("osrs-success-trades");
    if (storedTrades) {
      try {
        const parsed = JSON.parse(storedTrades) as ActiveTrade[];
        const normalized = parsed.map((t) => ({
          ...t,
          note: typeof t.note === "string" && t.note.trim().length > 0 ? t.note : null,
          settings: {
            budget: t.settings?.budget ?? null,
            minVolume: t.settings?.minVolume ?? null,
            maxFillHours: t.settings?.maxFillHours ?? null,
            buyAggro: t.settings?.buyAggro ?? null,
            sellAggro: t.settings?.sellAggro ?? null,
            limit: t.settings?.limit ?? null,
            membership: t.settings?.membership ?? "all",
          },
        }));
        setActiveTrades(normalized);
      } catch {
        // ignore parse errors
      }
    }
if (storedFailedTrades) {
  try {
    const parsed = JSON.parse(storedFailedTrades) as FailedTrade[];
    const normalized = parsed.map((t) => ({
      ...t,
      settings: {
        budget: t.settings?.budget ?? null,
        minVolume: t.settings?.minVolume ?? null,
        maxFillHours: t.settings?.maxFillHours ?? null,
        buyAggro: t.settings?.buyAggro ?? null,
        sellAggro: t.settings?.sellAggro ?? null,
        limit: t.settings?.limit ?? null,
        membership: t.settings?.membership ?? "all",
      },
    }));
    setFailedTrades(normalized);
  } catch {
    // ignore parse errors
  }
}
    if (storedSuccessTrades) {
      try {
        const parsed = JSON.parse(storedSuccessTrades) as SuccessTrade[];
        const normalized = parsed.map((t) => ({
          ...t,
          settings: {
            budget: t.settings?.budget ?? null,
            minVolume: t.settings?.minVolume ?? null,
            maxFillHours: t.settings?.maxFillHours ?? null,
            buyAggro: t.settings?.buyAggro ?? null,
            sellAggro: t.settings?.sellAggro ?? null,
            limit: t.settings?.limit ?? null,
            membership: t.settings?.membership ?? "all",
          },
          actualBuyPrice: t.actualBuyPrice ?? null,
          actualSellPrice: t.actualSellPrice ?? null,
          actualSoldQuantity: t.actualSoldQuantity ?? null,
        }));
        setSuccessfulTrades(normalized);
      } catch {
        // ignore parse errors
      }
    }
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000 * 30); // refresh timers every 30s
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (activeTrades.length === 0) {
      setLatestMap({});
      return;
    }
    let cancelled = false;
    async function refreshLatest() {
      try {
        const ids = Array.from(new Set(activeTrades.map((t) => t.id)));
        const params = new URLSearchParams({ ids: ids.join(",") });
        const res = await fetch(`/api/items/latest-lite?${params.toString()}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data && data.latest) {
          setLatestMap(data.latest);
        }
      } catch {
        // ignore
      }
    }
    refreshLatest();
    const t = setInterval(refreshLatest, 60_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [activeTrades]);

  useEffect(() => {
    if ((viewMode === "catalog" || viewMode === "all") && !catalogItems && !catalogLoading) {
      loadCatalog();
    }
  }, [viewMode, catalogItems, catalogLoading]);

  useEffect(() => {
    setCatalogLimit(240);
  }, [catalogFilter, catalogMembership, catalogSort]);

  useEffect(() => {
    setCatalogLimit(240);
  }, [catalogItems]);

  useEffect(() => {
    if ((viewMode === "hot" || viewMode === "all") && !hotFlips && !hotLoading) {
      loadHot();
    }
  }, [viewMode, hotFlips, hotLoading]);

  useEffect(() => {
    if (!topGainers && !topGainersLoading) {
      loadTopGainers();
    }
  }, [topGainers, topGainersLoading]);

  useEffect(() => {
    if (!topLosers && !topLosersLoading) {
      loadTopLosers();
    }
  }, [topLosers, topLosersLoading]);


  async function loadCatalog() {
    setCatalogLoading(true);
    setCatalogError(null);
    try {
      const res = await fetch("/api/items/list");
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to load items");
      }
      setCatalogItems(data.items ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load items";
      setCatalogError(message);
    } finally {
      setCatalogLoading(false);
    }
  }

  async function loadHot() {
    setHotLoading(true);
    setHotError(null);
    try {
      const res = await fetch("/api/high-volume");
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to load high-volume items");
      }
      setHotFlips(data.flips ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load high-volume items";
      setHotError(message);
    } finally {
      setHotLoading(false);
    }
  }

  async function loadTopGainers() {
    setTopGainersLoading(true);
    setTopGainersError(null);
    try {
      const res = await fetch("/api/top-gainers?limit=10");
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to load top gainers");
      }
      setTopGainers(Array.isArray(data.items) ? data.items : []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load top gainers";
      setTopGainersError(message);
    } finally {
      setTopGainersLoading(false);
    }
  }

  async function loadTopLosers() {
    setTopLosersLoading(true);
    setTopLosersError(null);
    try {
      const res = await fetch("/api/top-losers?limit=10");
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to load top losers");
      }
      setTopLosers(Array.isArray(data.items) ? data.items : []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load top losers";
      setTopLosersError(message);
    } finally {
      setTopLosersLoading(false);
    }
  }


  const filteredCatalog = useMemo(() => {
    if (!catalogItems) return null;
    const term = catalogFilter.trim().toLowerCase();
    const filtered = catalogItems.filter((item) => {
      if (catalogMembership === "members" && !item.members) return false;
      if (catalogMembership === "f2p" && item.members) return false;
      if (term && !item.name.toLowerCase().includes(term)) return false;
      return true;
    });
    const sorted = [...filtered].sort((a, b) => {
      if (catalogSort === "name") return a.name.localeCompare(b.name);
      const aVal =
        catalogSort === "volume"
          ? a.volume ?? 0
          : catalogSort === "margin"
            ? a.margin ?? 0
            : a.marginPct ?? 0;
      const bVal =
        catalogSort === "volume"
          ? b.volume ?? 0
          : catalogSort === "margin"
            ? b.margin ?? 0
            : b.marginPct ?? 0;
      return bVal - aVal;
    });
    return sorted;
  }, [catalogItems, catalogFilter, catalogMembership, catalogSort]);

  const visibleCatalog = useMemo(() => {
    if (!filteredCatalog) return null;
    return filteredCatalog.slice(0, catalogLimit);
  }, [filteredCatalog, catalogLimit]);

  const catalogTruncated = useMemo(() => {
    if (!filteredCatalog || !visibleCatalog) return false;
    return filteredCatalog.length > visibleCatalog.length;
  }, [filteredCatalog, visibleCatalog]);

  const persistActiveTrades = (entries: ActiveTrade[]) => {
    localStorage.setItem("osrs-active-trades", JSON.stringify(entries));
  };

  const persistFailedTrades = (entries: FailedTrade[]) => {
    localStorage.setItem("osrs-failed-trades", JSON.stringify(entries));
  };

  const persistSuccessTrades = (entries: SuccessTrade[]) => {
    localStorage.setItem("osrs-success-trades", JSON.stringify(entries));
  };

  function addTrade(flip: FlipCandidate) {
    const settings: TradeSettings = {
      budget: null,
      minVolume: null,
      maxFillHours: null,
      buyAggro: null,
      sellAggro: null,
      limit: null,
      membership: "all",
    };
    const entry: ActiveTrade = {
      id: flip.id,
      name: flip.name,
      quantity: flip.effectiveQty,
      buyPrice: flip.recommendedBuyPrice,
      sellPrice: flip.recommendedSellPrice,
      startedAt: Date.now(),
      estBuyHours: flip.estimatedFillHours,
      estSellHours: flip.estimatedSellHours,
      status: "buying",
      volume: flip.volume,
      margin: flip.margin,
      marginPct: flip.marginPct,
      estimatedProfit: flip.estimatedProfit,
      profitPerHour: flip.profitPerHour,
      note: null,
      settings,
    };
    setActiveTrades((prev) => {
      const updated = [...prev, entry];
      persistActiveTrades(updated);
      return updated;
    });
  }

  function markTradeNextStage(index: number) {
    setActiveTrades((prev) => {
      const updated = [...prev];
      const trade = updated[index];
      if (!trade) return prev;
      if (trade.status === "buying") {
        trade.status = "selling";
        trade.startedAt = Date.now();
      } else if (trade.status === "selling") {
        trade.status = "done";
      }
      persistActiveTrades(updated);
      return updated;
    });
  }

  function removeTrade(index: number) {
    setActiveTrades((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      persistActiveTrades(updated);
      return updated;
    });
  }

  function logFailedTrade(trade: ActiveTrade, reason: string | null) {
    const failedEntry: FailedTrade = {
      id: trade.id,
      name: trade.name,
      quantity: trade.quantity,
      buyPrice: trade.buyPrice,
      sellPrice: trade.sellPrice,
      startedAt: trade.startedAt,
      failedAt: Date.now(),
      estBuyHours: trade.estBuyHours,
      estSellHours: trade.estSellHours,
      failedStage: trade.status,
      reason: reason ?? trade.note,
      volume: trade.volume,
      margin: trade.margin,
      marginPct: trade.marginPct,
      estimatedProfit: trade.estimatedProfit,
      profitPerHour: trade.profitPerHour,
      settings: trade.settings,
    };
    setFailedTrades((prev) => {
      const updated = [failedEntry, ...prev];
      persistFailedTrades(updated);
      return updated;
    });
  }

  function logSuccessTrade(
    trade: ActiveTrade,
    note: string | null,
    boughtWithinEstimate: number | null,
    soldWithinEstimate: number | null,
    actualBuyPrice: number | null,
    actualSellPrice: number | null,
    actualSoldQuantity: number | null,
  ) {
    const successEntry: SuccessTrade = {
      id: trade.id,
      name: trade.name,
      quantity: trade.quantity,
      buyPrice: trade.buyPrice,
      sellPrice: trade.sellPrice,
      startedAt: trade.startedAt,
      completedAt: Date.now(),
      estBuyHours: trade.estBuyHours,
      estSellHours: trade.estSellHours,
      note: note ?? trade.note,
      boughtWithinEstimate,
      soldWithinEstimate,
      volume: trade.volume,
      margin: trade.margin,
      marginPct: trade.marginPct,
      estimatedProfit: trade.estimatedProfit,
      profitPerHour: trade.profitPerHour,
      settings: trade.settings,
      actualBuyPrice,
      actualSellPrice,
      actualSoldQuantity,
    };
    setSuccessfulTrades((prev) => {
      const updated = [successEntry, ...prev];
      persistSuccessTrades(updated);
      return updated;
    });
  }

  function markTradeFailed(index: number) {
    const trade = activeTrades[index];
    if (!trade) return;
    const noteInput =
      typeof window !== "undefined"
        ? window.prompt("Add a short note on why this failed (optional):", trade.note ?? "")
        : null;
    const note = noteInput && noteInput.trim().length > 0 ? noteInput.trim() : null;
    logFailedTrade(trade, note);
    setActiveTrades((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      persistActiveTrades(updated);
      return updated;
    });
  }

  function markTradeSuccess(index: number) {
    const trade = activeTrades[index];
    if (!trade) return;
    const noteInput =
      typeof window !== "undefined"
        ? window.prompt("Add a short note on this success (optional):", trade.note ?? "")
        : null;
    const actualBuyInput =
      typeof window !== "undefined"
        ? window.prompt(
            "Actual average buy price (optional, leave blank to use recommended):",
            trade.buyPrice.toString(),
          )
        : null;
    const actualSellInput =
      typeof window !== "undefined"
        ? window.prompt(
            "Actual average sell price (optional, leave blank to use recommended):",
            trade.sellPrice.toString(),
          )
        : null;
    const actualSoldQtyInput =
      typeof window !== "undefined"
        ? window.prompt(
            "How many units actually sold? (leave blank to use current quantity)",
            trade.quantity.toString(),
          )
        : null;
    const boughtInput =
      typeof window !== "undefined"
        ? window.prompt(
            "How many were bought within the estimated fill time? (leave blank if unknown)",
            trade.quantity.toString(),
          )
        : null;
    const soldInput =
      typeof window !== "undefined"
        ? window.prompt(
            "How many were sold within the estimated sell time? (leave blank if unknown)",
            trade.quantity.toString(),
          )
        : null;

    const parseCount = (val: string | null) => {
      if (!val) return null;
      const num = Number(val);
      return Number.isFinite(num) && num >= 0 ? Math.round(num) : null;
    };

    const note = noteInput && noteInput.trim().length > 0 ? noteInput.trim() : null;
    const boughtWithinEstimate = parseCount(boughtInput);
    const soldWithinEstimate = parseCount(soldInput);
    const actualBuyPrice = parseNumberInput(actualBuyInput);
    const actualSellPrice = parseNumberInput(actualSellInput);
    const actualSoldQuantity = parseCount(actualSoldQtyInput);

    logSuccessTrade(
      trade,
      note,
      boughtWithinEstimate,
      soldWithinEstimate,
      actualBuyPrice,
      actualSellPrice,
      actualSoldQuantity,
    );
    setActiveTrades((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      persistActiveTrades(updated);
      return updated;
    });
  }

  function removeFailedTrade(index: number) {
    setFailedTrades((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      persistFailedTrades(updated);
      return updated;
    });
  }

  function clearFailedTrades() {
    if (typeof window !== "undefined" && !window.confirm("Clear all failed trade logs?")) {
      return;
    }
    setFailedTrades(() => {
      persistFailedTrades([]);
      return [];
    });
  }

  function updateActiveNote(index: number) {
    const trade = activeTrades[index];
    if (!trade) return;
    const noteInput =
      typeof window !== "undefined"
        ? window.prompt("Add or update note for this trade:", trade.note ?? "")
        : null;
    const note = noteInput && noteInput.trim().length > 0 ? noteInput.trim() : null;
    setActiveTrades((prev) => {
      const updated = [...prev];
      if (updated[index]) {
        updated[index] = { ...updated[index], note };
        persistActiveTrades(updated);
      }
      return updated;
    });
  }

  function updateActiveQuantity(index: number) {
    const trade = activeTrades[index];
    if (!trade) return;
    const qtyInput =
      typeof window !== "undefined"
        ? window.prompt("Enter new quantity for this trade:", trade.quantity.toString())
        : null;
    if (qtyInput === null) return;
    const num = Number(qtyInput);
    if (!Number.isFinite(num) || num <= 0) {
      if (typeof window !== "undefined") {
        window.alert("Please enter a positive number.");
      }
      return;
    }
    const quantity = Math.round(num);
    setActiveTrades((prev) => {
      const updated = [...prev];
      if (updated[index]) {
        updated[index] = { ...updated[index], quantity };
        persistActiveTrades(updated);
      }
      return updated;
    });
  }

  function parseNumberInput(value: string | number | null) {
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    if (!value) return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  }

  function removeSuccessTrade(index: number) {
    setSuccessfulTrades((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      persistSuccessTrades(updated);
      return updated;
    });
  }

  function clearSuccessTrades() {
    if (typeof window !== "undefined" && !window.confirm("Clear all success trade logs?")) {
      return;
    }
    setSuccessfulTrades(() => {
      persistSuccessTrades([]);
      return [];
    });
  }

  function copyJsonToClipboard(label: string, payload: unknown) {
    const json = JSON.stringify(payload, null, 2);
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(json).catch(() => {
        window.prompt(`Copy ${label} JSON`, json);
      });
    } else if (typeof window !== "undefined") {
      window.prompt(`Copy ${label} JSON`, json);
    }
  }

  function scrollToSection(id: string) {
    if (typeof document === "undefined") return;
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function switchViewAndScroll(mode: ViewMode, anchorId: string) {
    setViewMode(mode);
    setTimeout(() => scrollToSection(anchorId), 80);
  }

  function showSection(mode: Exclude<ViewMode, "all">) {
    return viewMode === "all" || viewMode === mode;
  }

  function remainingTime(trade: ActiveTrade) {
    const elapsedHours = (now - trade.startedAt) / (1000 * 60 * 60);
    const target = trade.status === "buying" ? trade.estBuyHours : trade.estSellHours;
    const remainingRaw = target - elapsedHours;
    const remaining = Math.max(0, remainingRaw);
    const overdue = remainingRaw < 0;
    const percent = target > 0 ? Math.min(100, Math.max(0, (elapsedHours / target) * 100)) : 0;
    return { remaining, percent, overdue, overBy: overdue ? Math.abs(remainingRaw) : 0 };
  }

  return (
    <main className="min-h-screen px-4 py-10 sm:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <nav className="flex flex-col gap-4 rounded-2xl bg-slate-950/70 p-4 shadow-lg ring-1 ring-slate-800 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400/80 via-amber-500 to-orange-500 text-slate-950 shadow-lg shadow-amber-500/30 ring-2 ring-amber-300/50">
              ⇄
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-amber-300">OSRS Market Pulse</p>
              <p className="text-sm text-slate-200">Clean price moves, snapshots, and daily momentum.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => switchViewAndScroll("hot", "section-hot")}
              className="rounded-full border border-amber-500/50 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-200 transition hover:-translate-y-0.5 hover:border-amber-300"
            >
              Volume‑toppers
            </button>
            <button
              type="button"
              onClick={() => switchViewAndScroll("catalog", "section-catalog")}
              className="rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:-translate-y-0.5 hover:border-amber-400 hover:text-amber-200"
            >
              Browse items
            </button>
            <a
              href="/performance"
              className="rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:-translate-y-0.5 hover:border-amber-400 hover:text-amber-200"
            >
              Performance lab
            </a>
          </div>
        </nav>

        <div className="overflow-hidden rounded-3xl bg-slate-950/70 p-6 shadow-2xl ring-1 ring-slate-800 sm:p-8">
          <div className="grid gap-8 lg:grid-cols-12">
            <div className="space-y-5 lg:col-span-12">
              <div className="inline-flex items-center gap-2 rounded-full bg-slate-900/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-amber-300 ring-1 ring-amber-500/30">
                Live market radar
              </div>
              <h1 className="text-3xl font-semibold leading-tight text-slate-50 sm:text-4xl">
                Track the biggest 24h price moves without the noise.
              </h1>
              <p className="max-w-2xl text-base text-slate-300">
                See what spiked, what dipped, and where the market is shifting. Clean snapshots pulled from the OSRS Wiki, refreshed on demand.
              </p>
            </div>
          </div>
        </div>

        {viewMode !== "catalog" && (
        <section className="grid gap-6 lg:grid-cols-2">
          <div
            id="section-top-gainers"
            className="space-y-4 rounded-2xl bg-slate-950/70 p-6 shadow-2xl ring-1 ring-slate-800"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-50">Top 10 biggest gainers (24h)</h2>
                <p className="text-sm text-slate-400">Items with the largest price increase over the last 24 hours.</p>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className="rounded-full bg-slate-900 px-3 py-1 font-semibold text-slate-200">
                  {topGainers ? `${topGainers.length} items` : topGainersLoading ? "Loading…" : "Ready"}
                </span>
                <button
                  className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 font-semibold text-slate-100 transition hover:border-amber-400 hover:text-amber-200"
                  onClick={loadTopGainers}
                  disabled={topGainersLoading}
                >
                  {topGainersLoading ? "Refreshing…" : "Refresh"}
                </button>
              </div>
            </div>

            {topGainersError ? (
              <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                {topGainersError}
              </div>
            ) : null}

            {topGainersLoading && !topGainers ? (
              <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-3 text-sm text-slate-300">
                Loading biggest gainers…
              </div>
            ) : null}

            {topGainers && topGainers.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse text-xs sm:text-sm">
                  <thead>
                    <tr className="bg-slate-900 text-left text-[11px] uppercase tracking-wide text-slate-400 sm:text-xs">
                      <th className="px-2 py-2 text-left">Item</th>
                      <th className="px-2 py-2 text-right">Price now (M)</th>
                      <th className="px-2 py-2 text-right">Avg 24h (M)</th>
                      <th className="px-2 py-2 text-right text-emerald-300">Change (M)</th>
                      <th className="px-2 py-2 text-right text-emerald-300">Change %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {topGainers.map((gainer) => (
                      <tr key={gainer.id} className="hover:bg-slate-900/60 transition-colors">
                        <td className="px-2 py-2 text-left text-slate-100">
                          <a href={`/item/${gainer.id}`} className="flex items-center gap-2 text-amber-300 hover:underline">
                            <Image
                              src={itemIcon(gainer.id)}
                              alt={gainer.name}
                              width={28}
                              height={28}
                              className="h-7 w-7 rounded-md bg-slate-900 ring-1 ring-slate-800"
                            />
                            {gainer.name}
                          </a>
                        </td>
                        <td className="px-2 py-2 text-right font-mono text-slate-200">
                          {formatMillions(gainer.currentPrice)}
                        </td>
                        <td className="px-2 py-2 text-right font-mono text-slate-200">
                          {formatMillions(gainer.avg24hPrice)}
                        </td>
                        <td className="px-2 py-2 text-right font-mono text-emerald-300">
                          {formatMillionsSigned(gainer.change)}
                        </td>
                        <td className="px-2 py-2 text-right font-mono text-emerald-300">
                          {(gainer.changePct * 100).toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>

          <div
            id="section-top-losers"
            className="space-y-4 rounded-2xl bg-slate-950/70 p-6 shadow-2xl ring-1 ring-slate-800"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-50">Top 10 biggest losers (24h)</h2>
                <p className="text-sm text-slate-400">Items with the largest price drop over the last 24 hours.</p>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className="rounded-full bg-slate-900 px-3 py-1 font-semibold text-slate-200">
                  {topLosers ? `${topLosers.length} items` : topLosersLoading ? "Loading…" : "Ready"}
                </span>
                <button
                  className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 font-semibold text-slate-100 transition hover:border-amber-400 hover:text-amber-200"
                  onClick={loadTopLosers}
                  disabled={topLosersLoading}
                >
                  {topLosersLoading ? "Refreshing…" : "Refresh"}
                </button>
              </div>
            </div>

            {topLosersError ? (
              <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                {topLosersError}
              </div>
            ) : null}

            {topLosersLoading && !topLosers ? (
              <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-3 text-sm text-slate-300">
                Loading biggest losers…
              </div>
            ) : null}

            {topLosers && topLosers.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse text-xs sm:text-sm">
                  <thead>
                    <tr className="bg-slate-900 text-left text-[11px] uppercase tracking-wide text-slate-400 sm:text-xs">
                      <th className="px-2 py-2 text-left">Item</th>
                      <th className="px-2 py-2 text-right">Price now (M)</th>
                      <th className="px-2 py-2 text-right">Avg 24h (M)</th>
                      <th className="px-2 py-2 text-right text-rose-300">Change (M)</th>
                      <th className="px-2 py-2 text-right text-rose-300">Change %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {topLosers.map((loser) => (
                      <tr key={loser.id} className="hover:bg-slate-900/60 transition-colors">
                        <td className="px-2 py-2 text-left text-slate-100">
                          <a href={`/item/${loser.id}`} className="flex items-center gap-2 text-amber-300 hover:underline">
                            <Image
                              src={itemIcon(loser.id)}
                              alt={loser.name}
                              width={28}
                              height={28}
                              className="h-7 w-7 rounded-md bg-slate-900 ring-1 ring-slate-800"
                            />
                            {loser.name}
                          </a>
                        </td>
                        <td className="px-2 py-2 text-right font-mono text-slate-200">
                          {formatMillions(loser.currentPrice)}
                        </td>
                        <td className="px-2 py-2 text-right font-mono text-slate-200">
                          {formatMillions(loser.avg24hPrice)}
                        </td>
                        <td className="px-2 py-2 text-right font-mono text-rose-300">
                          {formatMillionsSigned(loser.change)}
                        </td>
                        <td className="px-2 py-2 text-right font-mono text-rose-300">
                          {(loser.changePct * 100).toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        </section>
        )}
