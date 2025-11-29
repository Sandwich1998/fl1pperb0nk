"use client";

import { useEffect, useMemo, useState } from "react";
import type { FlipCandidate } from "@/lib/osrs";

type ApiResponse =
  | {
      budget: number;
      minVolume: number;
      count: number;
      flips: FlipCandidate[];
      slots: number | null;
      maxFillHours: number | null;
      buyAggro: number | null;
      sellAggro: number | null;
      limit: number | null;
      totalSlots: number | null;
      favorites: number[];
      membership: MembershipFilter;
      error?: undefined;
    }
  | { error: string };

const numberFormatter = new Intl.NumberFormat("en-US");

type SortKey =
  | "margin"
  | "marginPct"
  | "volume"
  | "effectiveQty"
  | "estimatedFillHours"
  | "estimatedSellHours"
  | "profitPerHour"
  | "estimatedProfit";

type MembershipFilter = "all" | "members" | "f2p";
type ViewMode = "finder" | "active" | "success" | "failed" | "all";

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

export default function HomePage() {
  const [budgetInput, setBudgetInput] = useState("10m");
  const [minVolumeInput, setMinVolumeInput] = useState("500");
  const [maxFillHoursInput, setMaxFillHoursInput] = useState("6");
  const [buyAggroInput, setBuyAggroInput] = useState("0.2");
  const [sellAggroInput, setSellAggroInput] = useState("0.2");
  const [limitInput, setLimitInput] = useState("25");
  const [membershipFilter, setMembershipFilter] = useState<MembershipFilter>("all");
  const [favoriteIds, setFavoriteIds] = useState<number[]>([]);
  const [flips, setFlips] = useState<FlipCandidate[] | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("estimatedProfit");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [filterTerm, setFilterTerm] = useState("");
  const [activeTrades, setActiveTrades] = useState<ActiveTrade[]>([]);
  const [failedTrades, setFailedTrades] = useState<FailedTrade[]>([]);
  const [successfulTrades, setSuccessfulTrades] = useState<SuccessTrade[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("finder");
  const [latestMap, setLatestMap] = useState<Record<number, { buy: number; sell: number }>>({});
  const [now, setNow] = useState(() => Date.now());
  const [usedBudget, setUsedBudget] = useState<number | null>(null);
  const [usedMinVolume, setUsedMinVolume] = useState<number | null>(null);
  const [usedMaxFillHours, setUsedMaxFillHours] = useState<number | null>(null);
  const [usedBuyAggro, setUsedBuyAggro] = useState<number | null>(null);
  const [usedSellAggro, setUsedSellAggro] = useState<number | null>(null);
  const [usedLimit, setUsedLimit] = useState<number | null>(null);
  const [usedMembership, setUsedMembership] = useState<MembershipFilter>("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const storedBudget = localStorage.getItem("osrs-budget");
    const storedVolume = localStorage.getItem("osrs-min-volume");
    const storedMaxFill = localStorage.getItem("osrs-max-fill-hours");
    const storedBuyAggro = localStorage.getItem("osrs-buy-aggro");
    const storedSellAggro = localStorage.getItem("osrs-sell-aggro");
    const storedLimit = localStorage.getItem("osrs-limit");
    const storedFavorites = localStorage.getItem("osrs-favorites");
    const storedTrades = localStorage.getItem("osrs-active-trades");
    const storedFailedTrades = localStorage.getItem("osrs-failed-trades");
    const storedSuccessTrades = localStorage.getItem("osrs-success-trades");
    const storedMembership = localStorage.getItem("osrs-membership-filter");
    if (storedBudget) setBudgetInput(storedBudget);
    if (storedVolume) setMinVolumeInput(storedVolume);
    if (storedMaxFill) setMaxFillHoursInput(storedMaxFill);
    if (storedBuyAggro) setBuyAggroInput(storedBuyAggro);
    if (storedSellAggro) setSellAggroInput(storedSellAggro);
    if (storedLimit) setLimitInput(storedLimit);
    if (storedFavorites) {
      try {
        const parsed = JSON.parse(storedFavorites) as number[];
        setFavoriteIds(parsed);
      } catch {
        // ignore
      }
    }
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
    if (storedMembership === "members" || storedMembership === "f2p" || storedMembership === "all") {
      setMembershipFilter(storedMembership);
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


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    localStorage.setItem("osrs-budget", budgetInput);
    localStorage.setItem("osrs-min-volume", minVolumeInput);
    localStorage.setItem("osrs-max-fill-hours", maxFillHoursInput);
    localStorage.setItem("osrs-buy-aggro", buyAggroInput);
    localStorage.setItem("osrs-sell-aggro", sellAggroInput);
    localStorage.setItem("osrs-limit", limitInput);
    localStorage.setItem("osrs-favorites", JSON.stringify(favoriteIds));
    localStorage.setItem("osrs-membership-filter", membershipFilter);

    try {
      const params = new URLSearchParams({
        budget: budgetInput,
        minVolume: minVolumeInput,
        maxFillHours: maxFillHoursInput,
        buyAggro: buyAggroInput,
        sellAggro: sellAggroInput,
        limit: limitInput,
        totalSlots: "6",
        favorites: favoriteIds.join(","),
        membership: membershipFilter,
      });
      const res = await fetch(`/api/best-flips?${params.toString()}`);
      const data: ApiResponse = await res.json();

      if (!res.ok || "error" in data) {
        throw new Error(
          data && "error" in data ? data.error : "Failed to fetch flips",
        );
      }

      setFlips(data.flips);
      setUsedBudget(data.budget);
      setUsedMinVolume(data.minVolume);
      setUsedMaxFillHours(data.maxFillHours);
      setUsedBuyAggro(data.buyAggro);
      setUsedSellAggro(data.sellAggro);
      setUsedLimit(data.limit);
      setUsedMembership(data.membership);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      setFlips(null);
      setUsedBudget(null);
      setUsedMinVolume(null);
      setUsedMaxFillHours(null);
      setUsedBuyAggro(null);
      setUsedSellAggro(null);
      setUsedLimit(null);
      setUsedMembership("all");
    } finally {
      setLoading(false);
    }
  };

  const statusText = useMemo(() => {
    if (loading) return "Calculating best flips...";
    if (error) return error;
    if (flips && flips.length === 0) return "No matching flips found.";
    return null;
  }, [loading, error, flips]);

  const filteredFlips = useMemo(() => {
    if (!flips) return null;
    const term = filterTerm.trim().toLowerCase();
    if (!term) return flips;
    return flips.filter((f) => f.name.toLowerCase().includes(term));
  }, [flips, filterTerm]);

  const sortedFlips = useMemo(() => {
    if (!filteredFlips) return null;
    const arr = [...filteredFlips];
    arr.sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      if (va === vb) return 0;
      if (sortDir === "asc") return va < vb ? -1 : 1;
      return va > vb ? -1 : 1;
    });
    return arr;
  }, [filteredFlips, sortDir, sortKey]);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "estimatedProfit" || key === "profitPerHour" ? "desc" : "asc");
    }
  }

  const sortIndicator = (key: SortKey) =>
    sortKey === key ? (sortDir === "asc" ? " ↑" : " ↓") : "";

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
      budget: usedBudget ?? parseBudgetInput(budgetInput),
      minVolume: usedMinVolume ?? parseNumberInput(minVolumeInput),
      maxFillHours: usedMaxFillHours ?? parseNumberInput(maxFillHoursInput),
      buyAggro: usedBuyAggro ?? parseNumberInput(buyAggroInput),
      sellAggro: usedSellAggro ?? parseNumberInput(sellAggroInput),
      limit: usedLimit ?? parseNumberInput(limitInput),
      membership: usedMembership ?? membershipFilter,
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

  function parseBudgetInput(value: string | number | null) {
    if (typeof value === "number") return value;
    if (!value) return null;
    const normalized = value.trim().toLowerCase().replace(/,/g, "");
    const match = normalized.match(/^(\d+)([mk])?$/);
    if (!match) return null;
    const [, numPart, suffix] = match;
    let num = Number(numPart);
    if (!Number.isFinite(num) || num <= 0) return null;
    if (suffix === "m") num *= 1_000_000;
    if (suffix === "k") num *= 1_000;
    return num;
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

  const totalSuccessProfit = useMemo(
    () =>
      successfulTrades.reduce((sum, t) => {
        const qty = t.actualSoldQuantity ?? t.quantity;
        const buy = t.actualBuyPrice ?? t.buyPrice;
        const sell = t.actualSellPrice ?? t.sellPrice;
        return sum + Math.max(0, (sell - buy) * qty);
      }, 0),
    [successfulTrades],
  );

  function remainingTime(trade: ActiveTrade) {
    const elapsedHours = (now - trade.startedAt) / (1000 * 60 * 60);
    const target = trade.status === "buying" ? trade.estBuyHours : trade.estSellHours;
    const remainingRaw = target - elapsedHours;
    const remaining = Math.max(0, remainingRaw);
    const overdue = remainingRaw < 0;
    const percent = target > 0 ? Math.min(100, Math.max(0, (elapsedHours / target) * 100)) : 0;
    return { remaining, percent, overdue, overBy: overdue ? Math.abs(remainingRaw) : 0 };
  }

  function toggleFavorite(id: number) {
    setFavoriteIds((prev) => {
      const exists = prev.includes(id);
      const next = exists ? prev.filter((x) => x !== id) : [...prev, id];
      localStorage.setItem("osrs-favorites", JSON.stringify(next));
      return next;
    });
  }

  const highlightStats = [
    {
      label: "Live flips",
      value: flips ? flips.length : "—",
      detail: statusText ?? "Ready to scan",
      tone: "amber",
    },
    {
      label: "Active trades",
      value: activeTrades.length,
      detail: `${successfulTrades.length} successes logged`,
      tone: "sky",
    },
    {
      label: "Lifetime profit",
      value: `${numberFormatter.format(Math.round(totalSuccessProfit))} gp`,
      detail: "Tracked via your logs",
      tone: "emerald",
    },
    {
      label: "Failed log",
      value: failedTrades.length,
      detail: "Learn and tighten filters",
      tone: "rose",
    },
  ];

  return (
    <main className="min-h-screen px-4 py-10 sm:px-8">
      <div className="pointer-events-none fixed right-4 top-4 z-40 flex items-center gap-3 rounded-xl bg-slate-900/90 px-4 py-3 shadow-2xl ring-1 ring-amber-500/40">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-b from-amber-300 to-amber-600 shadow-lg ring-2 ring-amber-500/60">
          <svg viewBox="0 0 64 64" className="h-8 w-8 text-amber-950" aria-hidden>
            <ellipse cx="32" cy="16" rx="16" ry="8" fill="currentColor" opacity="0.8" />
            <ellipse cx="32" cy="28" rx="16" ry="8" fill="currentColor" opacity="0.7" />
            <ellipse cx="32" cy="40" rx="16" ry="8" fill="currentColor" opacity="0.6" />
          </svg>
        </div>
        <div className="pointer-events-auto">
          <div className="text-xs uppercase tracking-wide text-amber-300">Total profit</div>
          <div className="text-lg font-bold text-amber-100">
            {numberFormatter.format(Math.round(totalSuccessProfit))} gp
          </div>
        </div>
      </div>

      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <nav className="flex flex-col gap-4 rounded-2xl bg-slate-950/70 p-4 shadow-lg ring-1 ring-slate-800 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400/80 via-amber-500 to-orange-500 text-slate-950 shadow-lg shadow-amber-500/30 ring-2 ring-amber-300/50">
              ⇄
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-amber-300">OSRS Trading Desk</p>
              <p className="text-sm text-slate-200">Clean signals, quick sizing, no fluff.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => switchViewAndScroll("finder", "section-finder")}
              className="rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 shadow-md shadow-amber-500/30 transition hover:-translate-y-0.5 hover:bg-amber-400"
            >
              Start scanning
            </button>
            <button
              type="button"
              onClick={() => switchViewAndScroll("active", "section-active")}
              className="rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:-translate-y-0.5 hover:border-amber-400 hover:text-amber-200"
            >
              My trades
            </button>
            <button
              type="button"
              onClick={() => switchViewAndScroll("success", "section-success")}
              className="rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:-translate-y-0.5 hover:border-amber-400 hover:text-amber-200"
            >
              Logs
            </button>
          </div>
        </nav>

        <div className="overflow-hidden rounded-3xl bg-slate-950/70 p-6 shadow-2xl ring-1 ring-slate-800 sm:p-8">
          <div className="grid gap-8 lg:grid-cols-12">
            <div className="space-y-5 lg:col-span-7">
              <div className="inline-flex items-center gap-2 rounded-full bg-slate-900/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-amber-300 ring-1 ring-amber-500/30">
                Live trading cockpit
              </div>
              <h1 className="text-3xl font-semibold leading-tight text-slate-50 sm:text-4xl">
                Flip slimmer, sell faster, log everything.
              </h1>
              <p className="max-w-2xl text-base text-slate-300">
                Scan the Grand Exchange with tuned guardrails, track fills in one place, and see which items fit your budget, time window, and appetite. Built for speed—no filler UI.
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => switchViewAndScroll("finder", "section-finder")}
                  className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-amber-500/30 transition hover:-translate-y-0.5 hover:bg-amber-400"
                >
                  🚀 Find flips now
                </button>
                <button
                  type="button"
                  onClick={() => switchViewAndScroll("active", "section-active")}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-slate-100 transition hover:-translate-y-0.5 hover:border-amber-400 hover:text-amber-200"
                >
                  📊 View my trades
                </button>
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {highlightStats.map((stat) => {
                  const tones: Record<string, string> = {
                    amber: "from-amber-500/30 via-amber-500/10 to-amber-500/0 ring-amber-400/40",
                    sky: "from-sky-400/30 via-sky-400/10 to-sky-400/0 ring-sky-300/30",
                    emerald: "from-emerald-400/30 via-emerald-400/10 to-emerald-400/0 ring-emerald-300/30",
                    rose: "from-rose-400/30 via-rose-400/10 to-rose-400/0 ring-rose-300/30",
                  };
                  const tone = tones[stat.tone] ?? tones.amber;
                  return (
                    <div
                      key={stat.label}
                      className={`relative overflow-hidden rounded-xl bg-slate-900/70 p-4 shadow-lg ring-1 ${tone}`}
                    >
                      <div className="absolute inset-0 bg-gradient-to-br from-transparent to-slate-900/60" />
                      <div className="relative space-y-1">
                        <p className="text-xs uppercase tracking-wide text-slate-400">{stat.label}</p>
                        <p className="text-2xl font-bold text-slate-50">{stat.value}</p>
                        <p className="text-sm text-slate-400">{stat.detail}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-slate-950/70 p-4 shadow-lg ring-1 ring-slate-800">
          <span className="text-sm font-semibold text-slate-200">Workspace view:</span>
          <div className="flex flex-wrap gap-2">
            {([
              { key: "finder", label: "Finder" },
              { key: "active", label: "Active trades" },
              { key: "success", label: "Success log" },
              { key: "failed", label: "Failed log" },
              { key: "all", label: "Show all" },
            ] as { key: ViewMode; label: string }[]).map((opt) => {
              const active = viewMode === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => switchViewAndScroll(opt.key, `section-${opt.key === "all" ? "finder" : opt.key}`)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    active
                      ? "border-amber-400 bg-amber-500/10 text-amber-200"
                      : "border-slate-800 bg-slate-900 text-slate-100 hover:border-amber-400 hover:text-amber-200"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-200 shadow-lg">
          <p className="font-semibold text-slate-50">How to trade fast</p>
          <p className="text-slate-300">
            Scan with your budget and volume, track only the items you actually place, and log outcomes. Keep fill time realistic and trim stacks if you’re in a hurry.
          </p>
        </div>

        {showSection("finder") && (
        <section
          id="section-finder"
          className="rounded-xl bg-slate-950/60 p-6 shadow-lg ring-1 ring-slate-800 scroll-mt-28"
        >
          <form
            onSubmit={handleSubmit}
            className="grid grid-cols-1 gap-4 md:grid-cols-3 md:items-end"
          >
            <div className="flex flex-col gap-2 md:col-span-3">
              <label className="text-sm font-medium text-slate-200">Item type</label>
              <p className="text-[11px] text-slate-500">
                Switch between members-only or free-to-play items. “All” mixes both.
              </p>
              <div className="flex flex-wrap gap-2">
                {(["all", "members", "f2p"] as MembershipFilter[]).map((opt) => {
                  const labels: Record<MembershipFilter, string> = {
                    all: "All items",
                    members: "Members only",
                    f2p: "F2P only",
                  };
                  const active = membershipFilter === opt;
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setMembershipFilter(opt)}
                      className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                        active
                          ? "bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20"
                          : "bg-slate-800 text-slate-100 hover:bg-slate-700"
                      }`}
                    >
                      {labels[opt]}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-slate-200">
                Budget (gp)
              </label>
              <p className="text-[11px] text-slate-500">
                Your bankroll for this run; caps how much you can buy.
              </p>
              <input
                type="text"
                inputMode="numeric"
                value={budgetInput}
                onChange={(e) => setBudgetInput(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-50 shadow-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-400/30"
                placeholder="10m"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-slate-200">
                Min volume (items/day)
              </label>
              <p className="text-[11px] text-slate-500">
                Filters out thin items; lower volume opens more options but slower fills.
              </p>
              <input
                type="text"
                inputMode="numeric"
                value={minVolumeInput}
                onChange={(e) => setMinVolumeInput(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-50 shadow-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-400/30"
                placeholder="500"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-slate-200">
                Max fill time (hours)
              </label>
              <p className="text-[11px] text-slate-500">
                Maximum fill time you’re willing to wait; slower items get filtered out.
              </p>
              <input
                type="number"
                min={0.25}
                step={0.25}
                value={maxFillHoursInput}
                onChange={(e) => setMaxFillHoursInput(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-50 shadow-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-400/30"
                placeholder="6"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-slate-200">
                Buy aggressiveness (0-0.4 of spread)
              </label>
              <p className="text-[11px] text-slate-500">
                How much above low you bid from the spread; higher = faster fills, thinner margin.
              </p>
              <input
                type="number"
                min={0}
                max={0.4}
                step={0.05}
                value={buyAggroInput}
                onChange={(e) => setBuyAggroInput(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-50 shadow-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-400/30"
                placeholder="0.2"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-slate-200">
                Sell aggressiveness (0-0.4 of spread)
              </label>
              <p className="text-[11px] text-slate-500">
                How much below high you undercut; higher = faster sells, thinner margin.
              </p>
              <input
                type="number"
                min={0}
                max={0.4}
                step={0.05}
                value={sellAggroInput}
                onChange={(e) => setSellAggroInput(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-50 shadow-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-400/30"
                placeholder="0.2"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-slate-200">
                Results limit
              </label>
              <p className="text-[11px] text-slate-500">
                Max results to show; higher = more options.
              </p>
              <input
                type="number"
                min={1}
                max={200}
                value={limitInput}
                onChange={(e) => setLimitInput(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-50 shadow-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-400/30"
                placeholder="25"
              />
            </div>

            {/* Removed min profit/hour, auto-tune, and risk profile */}

            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-slate-200">
                Actions
              </span>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center justify-center rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-amber-500/25 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Calculating…" : "Find best flips"}
              </button>
            </div>
          </form>
        </section>
        )}

        {showSection("finder") && (
        <section
          id="section-finder-results"
          className="space-y-4 rounded-xl bg-slate-950/60 p-6 shadow-lg ring-1 ring-slate-800 scroll-mt-28"
        >
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-slate-400">
              {usedBudget !== null ? (
                <>
                  Results for budget:{" "}
                  <span className="font-semibold text-slate-100">
                    {numberFormatter.format(usedBudget)} gp
                  </span>
                  {usedMembership ? (
                    <span className="text-slate-400">
                      {" "}
                      • Items:{" "}
                      {usedMembership === "members"
                        ? "Members only"
                        : usedMembership === "f2p"
                          ? "F2P only"
                          : "All"}
                    </span>
                  ) : null}
                  {usedMinVolume !== null ? (
                    <span className="text-slate-400">
                      {" "}
                      • Min volume: {numberFormatter.format(usedMinVolume)}
                    </span>
                  ) : null}
                  {usedMaxFillHours !== null ? (
                    <span className="text-slate-400">
                      {" "}
                      • Max fill: {usedMaxFillHours}h
                    </span>
                  ) : null}
                  {usedBuyAggro !== null ? (
                    <span className="text-slate-400">
                      {" "}
                      • Buy aggro: {usedBuyAggro}
                    </span>
                  ) : null}
                  {usedSellAggro !== null ? (
                    <span className="text-slate-400">
                      {" "}
                      • Sell aggro: {usedSellAggro}
                    </span>
                  ) : null}
                </>
              ) : (
                "No results yet. Enter a budget to begin."
              )}
            </div>
            {statusText ? (
              <div className="text-sm font-medium text-amber-300">{statusText}</div>
            ) : null}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <label className="text-sm text-slate-300">Filter items:</label>
              <input
                type="text"
                value={filterTerm}
                onChange={(e) => setFilterTerm(e.target.value)}
                className="w-64 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/30"
                placeholder="Search by name"
              />
            </div>
            <div className="text-xs text-slate-400">
              {filteredFlips ? `${filteredFlips.length} shown` : ""}
            </div>
          </div>

          {error ? (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          {sortedFlips && sortedFlips.length > 0 ? (
            <div className="overflow-x-visible">
              <table className="min-w-full border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="bg-slate-900 text-left text-[11px] uppercase tracking-wide text-slate-400 sm:text-xs">
                    <th className="px-2 py-2 text-left">Fav</th>
                    <th className="px-2 py-2 text-left">Item</th>
                    <th className="px-2 py-2 text-right">Buy (low)</th>
                    <th className="px-2 py-2 text-right">Sell (high)</th>
                    <th className="px-2 py-2 text-right">Live price</th>
                    <th className="px-2 py-2 text-right">Rec. buy</th>
                    <th className="px-2 py-2 text-right">Rec. sell</th>
                    <th
                      className="px-2 py-2 text-right cursor-pointer"
                      onClick={() => handleSort("margin")}
                    >
                      Margin{sortIndicator("margin")}
                    </th>
                    <th
                      className="px-2 py-2 text-right cursor-pointer"
                      onClick={() => handleSort("marginPct")}
                    >
                      Margin %{sortIndicator("marginPct")}
                    </th>
                    <th
                      className="px-2 py-2 text-right cursor-pointer"
                      onClick={() => handleSort("volume")}
                    >
                      Volume/day{sortIndicator("volume")}
                    </th>
                    <th
                      className="px-2 py-2 text-right cursor-pointer"
                      onClick={() => handleSort("effectiveQty")}
                    >
                      Suggested qty{sortIndicator("effectiveQty")}
                    </th>
                    <th
                      className="px-2 py-2 text-right cursor-pointer"
                      onClick={() => handleSort("estimatedFillHours")}
                    >
                      Fill time (h){sortIndicator("estimatedFillHours")}
                    </th>
                    <th
                      className="px-2 py-2 text-right cursor-pointer"
                      onClick={() => handleSort("estimatedSellHours")}
                    >
                      Sell time (h){sortIndicator("estimatedSellHours")}
                    </th>
                    <th
                      className="px-2 py-2 text-right cursor-pointer text-amber-300"
                      onClick={() => handleSort("estimatedProfit")}
                    >
                      Estimated profit{sortIndicator("estimatedProfit")}
                    </th>
                    <th className="px-2 py-2 text-right">Track</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {sortedFlips.map((flip) => (
                    <tr
                      key={flip.id}
                      className="hover:bg-slate-900/60 transition-colors"
                    >
                      <td className="px-2 py-2 text-left">
                        <button
                          aria-label="Toggle favorite"
                          onClick={() => toggleFavorite(flip.id)}
                          className={`text-lg ${favoriteIds.includes(flip.id) ? "text-amber-300" : "text-slate-500"} hover:text-amber-200`}
                        >
                          ★
                        </button>
                      </td>
                      <td className="px-2 py-2 text-slate-100">
                        <a
                          href={`/item/${flip.id}`}
                          className="text-amber-300 hover:underline"
                        >
                          {flip.name}
                        </a>
                      </td>
                      <td className="px-2 py-2 text-right font-mono text-slate-200">
                        {numberFormatter.format(flip.buyPrice)}
                      </td>
                      <td className="px-2 py-2 text-right font-mono text-slate-200">
                        {numberFormatter.format(flip.sellPrice)}
                      </td>
                      <td className="px-2 py-2 text-right font-mono text-sky-300">
                        {numberFormatter.format(Math.round((flip.buyPrice + flip.sellPrice) / 2))}
                      </td>
                      <td className="px-2 py-2 text-right font-mono text-emerald-300">
                        {numberFormatter.format(flip.recommendedBuyPrice)}
                      </td>
                      <td className="px-2 py-2 text-right font-mono text-amber-300">
                        {numberFormatter.format(flip.recommendedSellPrice)}
                      </td>
                      <td className="px-2 py-2 text-right font-mono text-slate-200">
                        {numberFormatter.format(flip.margin)}
                      </td>
                      <td className="px-2 py-2 text-right font-mono text-slate-200">
                        {(flip.marginPct * 100).toFixed(2)}%
                      </td>
                      <td className="px-2 py-2 text-right font-mono text-slate-200">
                        {numberFormatter.format(flip.volume)}
                      </td>
                      <td className="px-2 py-2 text-right font-mono text-slate-200">
                        {numberFormatter.format(flip.effectiveQty)}
                      </td>
                      <td className="px-2 py-2 text-right font-mono text-slate-200">
                        {flip.estimatedFillHours.toFixed(2)}h
                      </td>
                      <td className="px-2 py-2 text-right font-mono text-slate-200">
                        {flip.estimatedSellHours.toFixed(2)}h
                      </td>
                      <td className="px-2 py-2 text-right font-mono text-amber-300">
                        {numberFormatter.format(flip.estimatedProfit)}
                      </td>
                      <td className="px-2 py-2 text-right">
                        <button
                          onClick={() => addTrade(flip)}
                          className="rounded-lg bg-slate-800 px-2 py-1 text-[11px] font-semibold text-amber-300 hover:bg-slate-700"
                        >
                          Track
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
        )}

        {showSection("active") && (
        <section
          id="section-active"
          className="space-y-4 rounded-xl bg-slate-950/60 p-6 shadow-lg ring-1 ring-slate-800 scroll-mt-28"
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-50">Active trades</h2>
              <p className="text-sm text-slate-400">
                Track buys and sells with live countdowns. Click stage to move from buying → selling → done.
              </p>
            </div>
            <div className="text-sm text-slate-400">
              Total tracked: {activeTrades.length}
            </div>
          </div>

          {activeTrades.length === 0 ? (
            <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-3 text-sm text-slate-300">
              No active trades. Use the “Track” button in the table to add one.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {activeTrades.map((trade, idx) => {
                const { remaining, percent, overdue, overBy } = remainingTime(trade);
                const stageLabel =
                  trade.status === "buying" ? "Buying" : trade.status === "selling" ? "Selling" : "Done";
                const live = latestMap[trade.id];
                const targetHit = live && live.sell >= trade.sellPrice;
                return (
                  <div
                    key={`${trade.id}-${trade.startedAt}-${idx}`}
                    className={`rounded-lg border ${targetHit ? "border-rose-500/60" : "border-slate-800"} bg-slate-900/80 p-4 shadow`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold text-slate-100">
                          <a href={`/item/${trade.id}`} className="text-amber-300 hover:underline">
                            {trade.name}
                          </a>
                        </div>
                        <div className="text-xs text-slate-400">
                          Qty {numberFormatter.format(trade.quantity)} • Buy {numberFormatter.format(trade.buyPrice)} • Sell {numberFormatter.format(trade.sellPrice)}
                        </div>
                        <div className="text-xs text-slate-400">
                          Est profit: {numberFormatter.format(trade.estimatedProfit)}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {targetHit ? (
                          <span className="rounded-full bg-rose-500/30 px-3 py-1 text-xs font-semibold text-rose-100">
                            Sell target hit
                          </span>
                        ) : null}
                        <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold text-amber-300">
                          {stageLabel}
                        </span>
                      </div>
                    </div>
                    <div className="mt-3">
                      <div className="flex justify-between text-xs text-slate-400">
                        <span>Remaining</span>
                        <span className={overdue ? "text-red-300" : ""}>
                          {overdue ? `Overdue by ${overBy.toFixed(2)}h` : `${remaining.toFixed(2)}h`}
                        </span>
                      </div>
                      <div className="mt-1 h-2 rounded-full bg-slate-800">
                        <div
                          className={`h-2 rounded-full ${overdue ? "bg-red-400" : "bg-emerald-400"}`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                    <div className="mt-3 flex gap-2 text-xs">
                      <button
                        className="rounded-lg bg-slate-800 px-3 py-2 font-semibold text-slate-100 hover:bg-slate-700"
                        onClick={() => markTradeNextStage(idx)}
                        >
                        {trade.status === "buying"
                          ? "Mark selling"
                          : trade.status === "selling"
                            ? "Mark done"
                            : "Done"}
                      </button>
                      <button
                        className="rounded-lg bg-amber-900/60 px-3 py-2 font-semibold text-amber-100 hover:bg-amber-800/70"
                        onClick={() => markTradeFailed(idx)}
                      >
                        Mark failed
                      </button>
                      <button
                        className="rounded-lg bg-emerald-900/60 px-3 py-2 font-semibold text-emerald-100 hover:bg-emerald-800/70"
                        onClick={() => markTradeSuccess(idx)}
                      >
                        Mark success
                      </button>
                          <button
                            className="rounded-lg bg-red-900/50 px-3 py-2 font-semibold text-red-200 hover:bg-red-800/70"
                            onClick={() => removeTrade(idx)}
                          >
                            Remove
                          </button>
                          <button
                            className="rounded-lg bg-slate-800 px-3 py-2 font-semibold text-slate-100 hover:bg-slate-700"
                            onClick={() => updateActiveNote(idx)}
                          >
                            Add/edit note
                          </button>
                          <button
                            className="rounded-lg bg-slate-800 px-3 py-2 font-semibold text-slate-100 hover:bg-slate-700"
                            onClick={() => updateActiveQuantity(idx)}
                          >
                            Edit quantity
                          </button>
                        </div>
                        {trade.note ? (
                          <div className="mt-2 rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2 text-xs text-slate-200">
                            Note: {trade.note}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
        </section>
        )}

        {showSection("success") && (
        <section
          id="section-success"
          className="space-y-4 rounded-xl bg-slate-950/60 p-6 shadow-lg ring-1 ring-slate-800 scroll-mt-28"
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-50">Success trades log</h2>
              <p className="text-sm text-slate-400">
                Capture wins, what worked, and how much filled/sold within the estimated windows.
              </p>
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-400">
              <span>Total logged: {successfulTrades.length}</span>
              {successfulTrades.length > 0 ? (
                <>
                  <button
                    className="rounded-lg bg-slate-800 px-3 py-2 font-semibold text-slate-100 hover:bg-slate-700"
                    onClick={() => copyJsonToClipboard("success trades", successfulTrades)}
                  >
                    Copy JSON
                  </button>
                  <button
                    className="rounded-lg bg-slate-800 px-3 py-2 font-semibold text-slate-100 hover:bg-slate-700"
                    onClick={clearSuccessTrades}
                  >
                    Clear log
                  </button>
                </>
              ) : null}
            </div>
          </div>

          {successfulTrades.length === 0 ? (
            <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-3 text-sm text-slate-300">
              No successes logged yet. Use “Mark success” on an active trade to capture it here.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {successfulTrades.map((s, idx) => {
                const ranHours = (s.completedAt - s.startedAt) / (1000 * 60 * 60);
                return (
                  <div
                    key={`${s.id}-${s.completedAt}-${idx}`}
                    className="rounded-lg border border-emerald-900/60 bg-slate-900/80 p-4 shadow"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-100">
                          <a href={`/item/${s.id}`} className="text-emerald-300 hover:underline">
                            {s.name}
                          </a>
                        </div>
                        <div className="text-xs text-slate-400">
                          Qty {numberFormatter.format(s.quantity)} • Buy {numberFormatter.format(s.buyPrice)} • Sell {numberFormatter.format(s.sellPrice)}
                        </div>
                        <div className="text-xs text-slate-400">
                          Est buy {s.estBuyHours.toFixed(2)}h • Est sell {s.estSellHours.toFixed(2)}h
                        </div>
                        <div className="text-xs text-slate-400">
                          Volume/day {numberFormatter.format(s.volume)} • Margin {numberFormatter.format(s.margin)} ({(s.marginPct * 100).toFixed(2)}%)
                        </div>
                        <div className="text-xs text-slate-400">
                          Est profit {numberFormatter.format(s.estimatedProfit)} • Profit/hr {numberFormatter.format(Math.round(s.profitPerHour))}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Run inputs — Budget: {s.settings.budget ? numberFormatter.format(s.settings.budget) : "N/A"} gp, Min vol:{" "}
                          {s.settings.minVolume !== null ? numberFormatter.format(s.settings.minVolume) : "N/A"}, Max fill:{" "}
                          {s.settings.maxFillHours ?? "N/A"}h, Buy aggro: {s.settings.buyAggro ?? "N/A"}, Sell aggro:{" "}
                          {s.settings.sellAggro ?? "N/A"}, Limit: {s.settings.limit ?? "N/A"}, Items: {s.settings.membership}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2 text-right">
                        <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-[11px] font-semibold text-emerald-200">
                          Completed
                        </span>
                        <span className="text-[11px] text-slate-400">
                          Logged {new Date(s.completedAt).toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-slate-300">
                      <div className="rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2">
                        <div className="text-slate-400">Bought within est.</div>
                        <div className="font-semibold text-slate-100">
                          {s.boughtWithinEstimate !== null
                            ? numberFormatter.format(s.boughtWithinEstimate)
                            : "Unknown"}
                        </div>
                      </div>
                      <div className="rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2">
                        <div className="text-slate-400">Sold within est.</div>
                        <div className="font-semibold text-slate-100">
                          {s.soldWithinEstimate !== null
                            ? numberFormatter.format(s.soldWithinEstimate)
                            : "Unknown"}
                        </div>
                      </div>
                      <div className="rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2">
                        <div className="text-slate-400">Actual buy</div>
                        <div className="font-semibold text-slate-100">
                          {s.actualBuyPrice !== null
                            ? numberFormatter.format(s.actualBuyPrice)
                            : numberFormatter.format(s.buyPrice)}
                        </div>
                      </div>
                      <div className="rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2">
                        <div className="text-slate-400">Actual sell</div>
                        <div className="font-semibold text-slate-100">
                          {s.actualSellPrice !== null
                            ? numberFormatter.format(s.actualSellPrice)
                            : numberFormatter.format(s.sellPrice)}
                        </div>
                      </div>
                      <div className="rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2">
                        <div className="text-slate-400">Actual sold qty</div>
                        <div className="font-semibold text-slate-100">
                          {s.actualSoldQuantity !== null
                            ? numberFormatter.format(s.actualSoldQuantity)
                            : numberFormatter.format(s.quantity)}
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs text-slate-300">
                      <span className="font-semibold text-slate-200">
                        Ran for {ranHours.toFixed(2)}h
                      </span>
                      <span className="text-slate-400">
                        Started {new Date(s.startedAt).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="mt-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-50">
                      {s.note ? (
                        <span className="block">
                          Note: <span className="text-emerald-100">{s.note}</span>
                        </span>
                      ) : (
                        <span className="block text-emerald-100/80">No note added.</span>
                      )}
                    </div>
                    <div className="mt-3 flex justify-end text-xs">
                      <button
                        className="rounded-lg bg-slate-800 px-3 py-2 font-semibold text-slate-100 hover:bg-slate-700"
                        onClick={() => removeSuccessTrade(idx)}
                      >
                        Remove from log
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
        )}

        {showSection("failed") && (
        <section
          id="section-failed"
          className="space-y-4 rounded-xl bg-slate-950/60 p-6 shadow-lg ring-1 ring-slate-800"
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-50">Failed trades log</h2>
              <p className="text-sm text-slate-400">
                Keep a running list of flips that missed so we can spot patterns and improve the algorithm.
              </p>
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-400">
              <span>Total logged: {failedTrades.length}</span>
              {failedTrades.length > 0 ? (
                <>
                  <button
                    className="rounded-lg bg-slate-800 px-3 py-2 font-semibold text-slate-100 hover:bg-slate-700"
                    onClick={() => copyJsonToClipboard("failed trades", failedTrades)}
                  >
                    Copy JSON
                  </button>
                  <button
                    className="rounded-lg bg-slate-800 px-3 py-2 font-semibold text-slate-100 hover:bg-slate-700"
                    onClick={clearFailedTrades}
                  >
                    Clear log
                  </button>
                </>
              ) : null}
            </div>
          </div>

          {failedTrades.length === 0 ? (
            <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-3 text-sm text-slate-300">
              No failed trades logged yet. Use “Mark failed” on an active trade to capture it here.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {failedTrades.map((fail, idx) => {
                const ranHours = (fail.failedAt - fail.startedAt) / (1000 * 60 * 60);
                const stageLabel =
                  fail.failedStage === "buying"
                    ? "During buy"
                    : fail.failedStage === "selling"
                      ? "During sell"
                      : "After close";
                return (
                  <div
                    key={`${fail.id}-${fail.failedAt}-${idx}`}
                    className="rounded-lg border border-amber-900/60 bg-slate-900/80 p-4 shadow"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-100">
                          <a href={`/item/${fail.id}`} className="text-amber-300 hover:underline">
                            {fail.name}
                          </a>
                        </div>
                        <div className="text-xs text-slate-400">
                          Qty {numberFormatter.format(fail.quantity)} • Buy {numberFormatter.format(fail.buyPrice)} • Sell {numberFormatter.format(fail.sellPrice)}
                        </div>
                        <div className="text-xs text-slate-400">
                          Est buy {fail.estBuyHours.toFixed(2)}h • Est sell {fail.estSellHours.toFixed(2)}h
                        </div>
                        <div className="text-xs text-slate-400">
                          Volume/day {numberFormatter.format(fail.volume)} • Margin {numberFormatter.format(fail.margin)} ({(fail.marginPct * 100).toFixed(2)}%)
                        </div>
                        <div className="text-xs text-slate-400">
                          Est profit {numberFormatter.format(fail.estimatedProfit)} • Profit/hr {numberFormatter.format(Math.round(fail.profitPerHour))}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Run inputs — Budget: {fail.settings.budget ? numberFormatter.format(fail.settings.budget) : "N/A"} gp, Min vol:{" "}
                          {fail.settings.minVolume !== null ? numberFormatter.format(fail.settings.minVolume) : "N/A"}, Max fill:{" "}
                          {fail.settings.maxFillHours ?? "N/A"}h, Buy aggro: {fail.settings.buyAggro ?? "N/A"}, Sell aggro:{" "}
                          {fail.settings.sellAggro ?? "N/A"}, Limit: {fail.settings.limit ?? "N/A"}, Items: {fail.settings.membership}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2 text-right">
                        <span className="rounded-full bg-amber-500/20 px-3 py-1 text-[11px] font-semibold text-amber-200">
                          {stageLabel}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          Logged {new Date(fail.failedAt).toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs text-slate-300">
                      <span className="font-semibold text-slate-200">
                        Ran for {ranHours.toFixed(2)}h
                      </span>
                      <span className="text-slate-400">
                        Started {new Date(fail.startedAt).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-50">
                      {fail.reason ? (
                        <span className="block">
                          Note: <span className="text-amber-100">{fail.reason}</span>
                        </span>
                      ) : (
                        <span className="block text-amber-100/80">No note added.</span>
                      )}
                    </div>
                    <div className="mt-3 flex justify-end text-xs">
                      <button
                        className="rounded-lg bg-slate-800 px-3 py-2 font-semibold text-slate-100 hover:bg-slate-700"
                        onClick={() => removeFailedTrade(idx)}
                      >
                        Remove from log
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
        )}
      </div>
    </main>
  );
}
