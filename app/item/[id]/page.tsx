import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PriceChart } from "@/components/price-chart";
import type { TimeseriesPoint, OfficialGuidePrice } from "@/lib/osrs";
import { getGuidePriceFresh } from "@/lib/live-price-cache";

const API_BASE = "https://prices.runescape.wiki/api/v1/osrs";
const USER_AGENT = "osrs-flip-finder/1.0 (contact@example.com)";

type ItemSnapshot = {
  id: number;
  name: string;
  buy: number | null;
  sell: number | null;
  volume: number | null;
  margin: number | null;
  marginPct: number | null;
  official: OfficialGuidePrice | null;
};

async function fetchJson<T>(
  path: string,
  init?: RequestInit & { revalidate?: number },
): Promise<T> {
  const { revalidate, next, ...rest } = init ?? {};
  const nextOptions =
    rest.cache === "no-store"
      ? undefined
      : revalidate !== undefined
        ? { revalidate }
        : next ?? { revalidate: 300 };
  const res = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers: {
      "User-Agent": USER_AGENT,
      ...(rest.headers || {}),
    },
    next: nextOptions,
  });
  if (!res.ok) throw new Error(`Failed to fetch ${path}: ${res.status}`);
  return res.json();
}

async function getItemSnapshot(id: number): Promise<ItemSnapshot | null> {
  const [mapping, latest, volumes, official] = await Promise.all([
    fetchJson<Array<{ id: number; name: string }>>("/mapping", { revalidate: 3600 }),
    fetchJson<{ data: Record<string, { high: number | null; low: number | null }> }>("/latest", {
      cache: "no-store",
    }),
    fetchJson<{ data: Record<string, number> }>("/volumes", { cache: "no-store" }),
    getGuidePriceFresh(id).catch(() => null),
  ]);

  const meta = mapping.find((m) => m.id === id);
  if (!meta) return null;
  const rec = latest.data[id.toString()];
  const volume = volumes.data?.[id.toString()] ?? null;
  const buy = rec?.low ?? null;
  const sell = rec?.high ?? null;
  const margin = buy !== null && sell !== null ? sell - buy : null;
  const marginPct = margin !== null && buy && buy > 0 ? margin / buy : null;
  return { id, name: meta.name, buy, sell, volume, margin, marginPct, official };
}

export default async function ItemPage({ params }: { params: { id: string } }) {
  const idNum = Number(params.id);
  if (!Number.isFinite(idNum)) notFound();

  const snapshot = await getItemSnapshot(idNum);
  if (!snapshot) notFound();

  return (
    <main className="min-h-screen px-4 py-12 sm:px-8">
      <div className="mx-auto flex max-w-4xl flex-col gap-6 rounded-2xl bg-slate-900/70 p-8 shadow-2xl ring-1 ring-slate-800">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Image
              src={`https://secure.runescape.com/m=itemdb_oldschool/obj_sprite.gif?id=${snapshot.id}`}
              alt={snapshot.name}
              width={48}
              height={48}
              className="h-12 w-12 rounded-xl bg-slate-900 ring-1 ring-slate-800"
            />
            <div className="space-y-1">
              <p className="text-sm font-medium uppercase tracking-[0.12em] text-amber-400">Item overview</p>
              <h1 className="text-3xl font-semibold text-slate-50 sm:text-4xl">{snapshot.name}</h1>
              <p className="text-slate-300">
                Live buy/sell snapshot, official guide price, and recent moves. Switch intervals to see how it’s trending.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-100 ring-1 ring-slate-700 transition hover:bg-slate-700"
            >
              ← Back to flips
            </Link>
          </div>
        </div>

        <div className="grid gap-4 rounded-xl bg-slate-950/60 p-4 ring-1 ring-slate-800 sm:grid-cols-2">
          <Stat label="Buy (low)" value={snapshot.buy} />
          <Stat label="Sell (high)" value={snapshot.sell} />
          <Stat label="Margin" value={snapshot.margin} />
          <Stat
            label="Margin %"
            value={snapshot.marginPct !== null ? `${(snapshot.marginPct * 100).toFixed(2)}%` : null}
          />
          <Stat label="Volume/day" value={snapshot.volume} />
          <Stat
            label="Official GE guide"
            value={
              snapshot.official && snapshot.official.price !== null
                ? `${snapshot.official.price.toLocaleString("en-US")} gp`
                : "—"
            }
            hint={snapshot.official?.trend ? `Trend: ${snapshot.official.trend}` : undefined}
          />
        </div>

        <PriceChart itemId={snapshot.id} />
      </div>
    </main>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: number | string | null;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
      <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
      <div className="text-lg font-semibold text-slate-100">
        {value === null ? "—" : typeof value === "number" ? value.toLocaleString("en-US") : value}
      </div>
      {hint ? <div className="text-[11px] text-slate-500">{hint}</div> : null}
    </div>
  );
}
