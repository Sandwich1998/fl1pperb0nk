"use client";

import { useEffect, useMemo, useState } from "react";

type MembershipFilter = "all" | "members" | "f2p";
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
  settings: TradeSettings;
  actualBuyPrice: number | null;
  actualSellPrice: number | null;
  actualSoldQuantity: number | null;
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
  volume?: number;
  margin?: number;
  marginPct?: number;
  estimatedProfit?: number;
  profitPerHour?: number;
  settings: TradeSettings;
};

type WindowKey = "5m" | "1h" | "4h" | "24h" | "7d" | "all";

const numberFormatter = new Intl.NumberFormat("en-US");

function parseStored<T>(key: string): T[] {
  if (typeof localStorage === "undefined") return [];
  const raw = localStorage.getItem(key);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as T[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function calcProfit(trade: SuccessTrade) {
  const qty = trade.actualSoldQuantity ?? trade.quantity;
  const buy = trade.actualBuyPrice ?? trade.buyPrice;
  const sell = trade.actualSellPrice ?? trade.sellPrice;
  const profit = (sell - buy) * qty;
  const invested = buy * qty;
  const roi = invested > 0 ? profit / invested : 0;
  return { profit, invested, roi };
}

function calcSimulatedReturn(trade: SuccessTrade, stake: number) {
  const { roi } = calcProfit(trade);
  return stake + stake * roi;
}

const windowMinutes: Record<WindowKey, number> = {
  "5m": 5,
  "1h": 60,
  "4h": 240,
  "24h": 24 * 60,
  "7d": 7 * 24 * 60,
  all: Number.POSITIVE_INFINITY,
};

export default function PerformancePage() {
  const [successTrades, setSuccessTrades] = useState<SuccessTrade[]>([]);
  const [failedTrades, setFailedTrades] = useState<FailedTrade[]>([]);
  const [stakeInput, setStakeInput] = useState("1000000");
  const [windowKey, setWindowKey] = useState<WindowKey>("24h");

  useEffect(() => {
    setSuccessTrades(parseStored<SuccessTrade>("osrs-success-trades"));
    setFailedTrades(parseStored<FailedTrade>("osrs-failed-trades"));
  }, []);

  const stake = useMemo(() => {
    const num = Number(stakeInput);
    return Number.isFinite(num) && num > 0 ? num : 0;
  }, [stakeInput]);

  const filtered = useMemo(() => {
    const minutes = windowMinutes[windowKey];
    if (!Number.isFinite(minutes)) {
      return {
        successes: successTrades,
        failures: failedTrades,
      };
    }
    const now = Date.now();
    const cutoff = now - minutes * 60 * 1000;
    return {
      successes: successTrades.filter((t) => t.completedAt >= cutoff),
      failures: failedTrades.filter((t) => (t.failedAt ?? t.startedAt) >= cutoff),
    };
  }, [successTrades, failedTrades, windowKey]);

  const successMetrics = useMemo(() => {
    if (filtered.successes.length === 0) {
      return { totalProfit: 0, totalInvested: 0, roi: 0, avgRoi: 0 };
    }
    const sums = filtered.successes.reduce(
      (acc, t) => {
        const { profit, invested, roi } = calcProfit(t);
        return {
          totalProfit: acc.totalProfit + profit,
          totalInvested: acc.totalInvested + invested,
          roiSum: acc.roiSum + roi,
        };
      },
      { totalProfit: 0, totalInvested: 0, roiSum: 0 },
    );
    const roi = sums.totalInvested > 0 ? sums.totalProfit / sums.totalInvested : 0;
    const avgRoi = sums.roiSum / filtered.successes.length;
    return { totalProfit: sums.totalProfit, totalInvested: sums.totalInvested, roi, avgRoi };
  }, [filtered.successes]);

  const simulated = useMemo(() => {
    if (stake <= 0) return { optimistic: 0, pessimistic: 0 };
    const optimistic = filtered.successes.reduce((acc, t) => acc + calcSimulatedReturn(t, stake), 0);
    const pessimistic = optimistic - filtered.failures.length * stake;
    return { optimistic, pessimistic };
  }, [filtered.successes, filtered.failures.length, stake]);

  const hitRate = useMemo(() => {
    const total = filtered.successes.length + filtered.failures.length;
    return total === 0 ? 0 : filtered.successes.length / total;
  }, [filtered.successes.length, filtered.failures.length]);

  const windows: { key: WindowKey; label: string }[] = [
    { key: "5m", label: "Last 5m" },
    { key: "1h", label: "Last 1h" },
    { key: "4h", label: "Last 4h" },
    { key: "24h", label: "Last 24h" },
    { key: "7d", label: "Last 7d" },
    { key: "all", label: "All" },
  ];

  return (
    <main className="min-h-screen px-4 py-10 sm:px-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 rounded-2xl bg-slate-950/70 p-6 shadow-2xl ring-1 ring-slate-800">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-amber-400">Performance lab</p>
            <h1 className="text-3xl font-semibold text-slate-50">How past flips would have paid</h1>
            <p className="text-sm text-slate-400">
              Crunch your success + failed logs, pick a window, and see hit rate plus simulated returns for a fixed stake per flip.
            </p>
          </div>
          <a
            href="/"
            className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-100 ring-1 ring-slate-700 transition hover:bg-slate-700"
          >
            ← Back to flips
          </a>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
            <div className="text-xs uppercase tracking-wide text-slate-400">Time window</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {windows.map((w) => {
                const active = windowKey === w.key;
                return (
                  <button
                    key={w.key}
                    onClick={() => setWindowKey(w.key)}
                    className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                      active
                        ? "bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20"
                        : "bg-slate-800 text-slate-100 hover:bg-slate-700"
                    }`}
                  >
                    {w.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
            <div className="text-xs uppercase tracking-wide text-slate-400">Simulated stake per flip</div>
            <div className="mt-2 flex items-center gap-3">
              <input
                type="number"
                min={0}
                value={stakeInput}
                onChange={(e) => setStakeInput(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/30"
              />
              <span className="text-xs text-slate-400">gp</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">We’ll apply each flip’s ROI to this stake. Fails subtract the stake in pessimistic mode.</p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Metric
            label="Hit rate"
            value={`${(hitRate * 100).toFixed(1)}%`}
            detail={`${filtered.successes.length} wins / ${filtered.failures.length} fails`}
          />
          <Metric
            label="Total profit (actual)"
            value={`${numberFormatter.format(Math.round(successMetrics.totalProfit))} gp`}
            detail={`Avg ROI ${ (successMetrics.avgRoi * 100).toFixed(2)}%`}
          />
          <Metric
            label="Simulated bank (stake x flips)"
            value={stake > 0 ? `${numberFormatter.format(Math.round(simulated.optimistic))} gp` : "Set stake"}
            detail={
              stake > 0
                ? `Pessimistic (fails = -stake): ${numberFormatter.format(Math.round(simulated.pessimistic))} gp`
                : ""
            }
          />
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-slate-100">Recent winners</div>
              <div className="text-xs text-slate-400">Sorted by completion time, showing ROI and simulated payout.</div>
            </div>
            <div className="text-xs text-slate-500">{filtered.successes.length} shown</div>
          </div>
          {filtered.successes.length === 0 ? (
            <div className="rounded-lg border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-slate-300">
              No successful flips in this window yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2">
              {filtered.successes
                .slice()
                .sort((a, b) => b.completedAt - a.completedAt)
                .map((t) => {
                  const { profit, invested, roi } = calcProfit(t);
                  const simulatedPayout = stake > 0 ? calcSimulatedReturn(t, stake) : null;
                  return (
                    <div
                      key={`${t.id}-${t.completedAt}`}
                      className="flex flex-col gap-2 rounded-lg border border-emerald-900/60 bg-slate-900/80 p-3 text-sm text-slate-200"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-emerald-300">{t.name}</span>
                          <span className="text-xs text-slate-500">Qty {numberFormatter.format(t.quantity)}</span>
                        </div>
                        <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-200">
                          ROI {(roi * 100).toFixed(2)}%
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-[12px] text-slate-400">
                        <span>Profit {numberFormatter.format(Math.round(profit))} gp</span>
                        <span>Invested {numberFormatter.format(Math.round(invested))} gp</span>
                        <span>Completed {new Date(t.completedAt).toLocaleString()}</span>
                        {simulatedPayout !== null ? (
                          <span className="text-amber-200">Stake → {numberFormatter.format(Math.round(simulatedPayout))} gp</span>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-slate-100">Recent misses</div>
              <div className="text-xs text-slate-400">Fails don’t have realized profit; pessimistic sim subtracts stake per miss.</div>
            </div>
            <div className="text-xs text-slate-500">{filtered.failures.length} shown</div>
          </div>
          {filtered.failures.length === 0 ? (
            <div className="rounded-lg border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-slate-300">
              No failed flips in this window.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2">
              {filtered.failures
                .slice()
                .sort((a, b) => b.failedAt - a.failedAt)
                .map((t) => (
                  <div
                    key={`${t.id}-${t.failedAt}`}
                    className="flex flex-col gap-2 rounded-lg border border-amber-900/60 bg-slate-900/80 p-3 text-sm text-slate-200"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-amber-300">{t.name}</span>
                        <span className="text-xs text-slate-500">Qty {numberFormatter.format(t.quantity)}</span>
                      </div>
                      <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-200">
                        Failed
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-[12px] text-slate-400">
                      <span>Logged {new Date(t.failedAt).toLocaleString()}</span>
                      {t.reason ? <span className="text-amber-200">{t.reason}</span> : null}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
      <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
      <div className="text-2xl font-semibold text-slate-50">{value}</div>
      {detail ? <div className="text-sm text-slate-400">{detail}</div> : null}
    </div>
  );
}
