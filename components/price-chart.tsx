"use client";

import { useEffect, useMemo, useState } from "react";
import type { TimeseriesPoint } from "@/lib/osrs";

type Timeframe = "5m" | "1h" | "24h";

interface Props {
  itemId: number;
  defaultTimeframe?: Timeframe;
}

export function PriceChart({ itemId, defaultTimeframe = "1h" }: Props) {
  const [timeframe, setTimeframe] = useState<Timeframe>(defaultTimeframe);
  const [points, setPoints] = useState<TimeseriesPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const maxRows = 150;
  const [refreshTick, setRefreshTick] = useState(0);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/items/${itemId}/history?timestep=${timeframe}`);
        const data = await res.json();
        if (!res.ok || data.error) {
          throw new Error(data.error || "Failed to load history");
        }
        if (!cancelled) setPoints(data.points || []);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load history");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [itemId, timeframe, refreshTick]);

  // Auto-refresh frequently for fast intervals to pick up new buckets as soon as the API updates.
  useEffect(() => {
    const intervalMs =
      timeframe === "5m" ? 60_000 : timeframe === "1h" ? 5 * 60_000 : 10 * 60_000;
    const id = setInterval(() => setRefreshTick((n) => n + 1), intervalMs);
    return () => clearInterval(id);
  }, [timeframe]);

  const tableRows = useMemo(() => {
    if (!points || points.length === 0) return [];
    const derived = points.map((p, idx) => {
      const mid =
        typeof p.avgHighPrice === "number" && typeof p.avgLowPrice === "number"
          ? (p.avgHighPrice + p.avgLowPrice) / 2
          : p.avgHighPrice ?? p.avgLowPrice ?? null;
      const prev = points[idx - 1];
      const prevMid =
        prev && typeof prev.avgHighPrice === "number" && typeof prev.avgLowPrice === "number"
          ? (prev.avgHighPrice + prev.avgLowPrice) / 2
          : prev?.avgHighPrice ?? prev?.avgLowPrice ?? null;
      const delta = mid !== null && prevMid !== null ? mid - prevMid : null;
      const minutesBetween = prev ? Math.max(1, (p.timestamp - prev.timestamp) / 60) : null;
      const deltaPerMinute =
        delta !== null && minutesBetween && minutesBetween > 0 ? delta / minutesBetween : null;
      const volume = (p.highPriceVolume ?? 0) + (p.lowPriceVolume ?? 0);
      const volumePerMinute =
        volume > 0 && minutesBetween && minutesBetween > 0 ? volume / minutesBetween : null;
      return {
        ts: p.timestamp,
        low: p.avgLowPrice ?? null,
        high: p.avgHighPrice ?? null,
        mid,
        delta,
        deltaPerMinute,
        intervalMinutes: minutesBetween,
        volume,
        volumePerMinute,
      };
    });
    // Show newest first and cap rows for readability
    return derived.reverse().slice(0, maxRows);
  }, [points, maxRows]);

  const chartData = useMemo(() => {
    if (!points || points.length === 0) return null;
    const sorted = [...points].sort((a, b) => a.timestamp - b.timestamp);
    const xMargin = 3;
    const xRange = 100 - xMargin * 2;
    const values = sorted
      .map((p) => ({
        price:
          typeof p.avgLowPrice === "number" && typeof p.avgHighPrice === "number"
            ? (p.avgLowPrice + p.avgHighPrice) / 2
            : p.avgLowPrice ?? p.avgHighPrice ?? null,
        ts: p.timestamp,
        volume: (p.highPriceVolume ?? 0) + (p.lowPriceVolume ?? 0),
      }))
      .filter((v) => v.price !== null) as Array<{ price: number; ts: number; volume: number }>;
    if (values.length === 0) return null;
    const min = Math.min(...values.map((v) => v.price));
    const max = Math.max(...values.map((v) => v.price));
    const range = Math.max(1, max - min);
    const maxVolume = Math.max(1, ...values.map((v) => v.volume));
    const pts = values.map((v, idx) => {
      const x = xMargin + (idx / Math.max(values.length - 1, 1)) * xRange;
      const y = 100 - ((v.price - min) / range) * 100;
      const volHeight = (v.volume / maxVolume) * 16;
      return { ...v, x, y, volHeight };
    });
    return { pts, min, max, xMargin, xRange };
  }, [points]);

  const hoverPoint = hoverIdx !== null && chartData ? chartData.pts[hoverIdx] : null;

  function handleChartMove(e: React.PointerEvent<SVGSVGElement>) {
    if (!chartData || chartData.pts.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const xPct = ((e.clientX - rect.left) / rect.width) * 100;
    let nearest = 0;
    let best = Infinity;
    chartData.pts.forEach((p, i) => {
      const d = Math.abs(p.x - xPct);
      if (d < best) {
        best = d;
        nearest = i;
      }
    });
    setHoverIdx(nearest);
  }

  function handleChartLeave() {
    setHoverIdx(null);
  }

  const formatTs = (ts: number) =>
    new Date(ts * 1000).toLocaleString(undefined, {
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

  const formatDelta = (value: number | null) => {
    if (value === null) return "—";
    const formatted = value.toLocaleString("en-US", { maximumFractionDigits: 2 });
    if (value === 0) return "0";
    return value > 0 ? `+${formatted}` : formatted;
  };

  return (
    <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/70 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">Price history</h3>
          <p className="text-xs text-slate-400">Line + volume chart with per-interval deltas and throughput.</p>
        </div>
        <div className="flex gap-2">
          {(["5m", "1h", "24h"] as Timeframe[]).map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`rounded-lg px-3 py-1 text-xs font-semibold ${
                timeframe === tf ? "bg-amber-500 text-slate-950" : "bg-slate-800 text-slate-200"
              }`}
            >
              {tf === "24h" ? "1d" : tf}
            </button>
          ))}
        </div>
      </div>
      {loading ? (
        <div className="text-sm text-slate-300">Loading…</div>
      ) : error ? (
        <div className="text-sm text-red-300">{error}</div>
      ) : chartData ? (
        <div className="space-y-4">
          <div className="relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900/70 p-4">
            <div className="flex justify-between text-[11px] text-slate-500">
              <span>
                {chartData.min.toLocaleString("en-US")} gp → {chartData.max.toLocaleString("en-US")} gp
              </span>
              <span>{chartData.pts.length} points</span>
            </div>
            <svg
              viewBox="0 0 100 60"
              className="mt-2 h-56 w-full overflow-visible"
              onPointerMove={handleChartMove}
              onPointerLeave={handleChartLeave}
            >
              <rect x={0} y={0} width={100} height={60} fill="transparent" />
              <defs>
                <linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.05" />
                </linearGradient>
              </defs>
              {[20, 40, 60, 80].map((y) => (
                <line key={y} x1={0} x2={100} y1={y * 0.6} y2={y * 0.6} stroke="#1e293b" strokeWidth="0.3" />
              ))}
              {chartData.pts.map((p, idx) => {
                const width = chartData.xRange / Math.max(chartData.pts.length, 1);
                return (
                  <rect
                    key={`vol-${idx}`}
                    x={p.x - width / 2}
                    y={60 - Math.min(16, p.volHeight)}
                    width={width * 0.9}
                    height={Math.min(16, p.volHeight)}
                    fill="#334155"
                    opacity={0.7}
                  />
                );
              })}
              <path
                d={chartData.pts
                  .map((p, idx) => `${idx === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y * 0.6}`)
                  .join(" ")}
                fill="none"
                stroke="#f59e0b"
                strokeWidth="1.2"
              />
              <path
                d={`${chartData.pts
                  .map((p, idx) => `${idx === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y * 0.6}`)
                  .join(" ")} L ${chartData.pts[chartData.pts.length - 1]?.x ?? 100} 60 L ${
                  chartData.pts[0]?.x ?? 0
                } 60 Z`}
                fill="url(#priceFill)"
              />
              {hoverPoint ? (
                <>
                  <line
                    x1={hoverPoint.x}
                    y1={0}
                    x2={hoverPoint.x}
                    y2={60}
                    stroke="#94a3b8"
                    strokeDasharray="2 2"
                    strokeWidth="0.4"
                  />
                  <circle cx={hoverPoint.x} cy={hoverPoint.y * 0.6} r={1.1} fill="#f59e0b" />
                </>
              ) : null}
            </svg>
            {hoverPoint ? (
              <div className="absolute right-4 top-4 rounded-lg bg-slate-800/90 px-3 py-2 text-xs text-slate-100 shadow-lg">
                <div className="font-semibold">{hoverPoint.price.toLocaleString("en-US")} gp</div>
                <div className="text-[11px] text-slate-400">
                  Volume: {hoverPoint.volume ? hoverPoint.volume.toLocaleString("en-US") : "—"}
                </div>
                <div className="text-[11px] text-slate-400">
                  {new Date(hoverPoint.ts * 1000).toLocaleTimeString(undefined, {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>
            ) : null}
          </div>
          {tableRows.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-xs text-slate-100">
                <thead>
                  <tr className="bg-slate-950 text-[11px] uppercase tracking-wide text-slate-400">
                    <th className="px-2 py-2 text-left">Timestamp</th>
                    <th className="px-2 py-2 text-right">Interval (min)</th>
                    <th className="px-2 py-2 text-right">Low</th>
                    <th className="px-2 py-2 text-right">High</th>
                    <th className="px-2 py-2 text-right">Mid</th>
                    <th className="px-2 py-2 text-right">Δ vs prev</th>
                    <th className="px-2 py-2 text-right">Δ per min</th>
                    <th className="px-2 py-2 text-right">Volume</th>
                    <th className="px-2 py-2 text-right">Volume/min</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {tableRows.map((row, idx) => (
                    <tr key={row.ts ?? idx} className="hover:bg-slate-900/60">
                      <td className="px-2 py-2 text-left text-slate-200">{formatTs(row.ts)}</td>
                      <td className="px-2 py-2 text-right text-slate-300">
                        {row.intervalMinutes ? row.intervalMinutes.toFixed(1) : "—"}
                      </td>
                      <td className="px-2 py-2 text-right font-mono text-emerald-200">
                        {row.low !== null ? row.low.toLocaleString("en-US") : "—"}
                      </td>
                      <td className="px-2 py-2 text-right font-mono text-amber-200">
                        {row.high !== null ? row.high.toLocaleString("en-US") : "—"}
                      </td>
                      <td className="px-2 py-2 text-right font-mono text-slate-100">
                        {row.mid !== null ? row.mid.toLocaleString("en-US") : "—"}
                      </td>
                      <td
                        className={`px-2 py-2 text-right font-mono ${
                          row.delta === null ? "text-slate-300" : row.delta >= 0 ? "text-emerald-300" : "text-rose-300"
                        }`}
                      >
                        {formatDelta(row.delta)}
                      </td>
                      <td
                        className={`px-2 py-2 text-right font-mono ${
                          row.deltaPerMinute === null
                            ? "text-slate-300"
                            : row.deltaPerMinute >= 0
                              ? "text-emerald-300"
                              : "text-rose-300"
                        }`}
                      >
                        {row.deltaPerMinute === null
                          ? "—"
                          : formatDelta(Number(row.deltaPerMinute.toFixed(3)))}
                      </td>
                      <td className="px-2 py-2 text-right font-mono text-sky-200">
                        {row.volume ? row.volume.toLocaleString("en-US") : "—"}
                      </td>
                      <td className="px-2 py-2 text-right font-mono text-sky-200">
                        {row.volumePerMinute !== null
                          ? Number(row.volumePerMinute.toFixed(2)).toLocaleString("en-US")
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-[11px] text-slate-500">
                Newest rows first. Δ per min shows how quickly price moved during that interval.
              </p>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="text-sm text-slate-300">No historical data.</div>
      )}
    </div>
  );
}
