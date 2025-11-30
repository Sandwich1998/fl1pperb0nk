import { NextResponse } from "next/server";

const API_BASE = "https://prices.runescape.wiki/api/v1/osrs";
const USER_AGENT = "osrs-flip-finder/1.0 (contact@example.com)";

type MappingItem = {
  id: number;
  name: string;
  members?: boolean;
  limit?: number;
};

type LatestRecord = {
  high: number | null;
  low: number | null;
};

async function fetchJson<T>(path: string, init?: RequestInit & { revalidate?: number }) {
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

  if (!res.ok) {
    throw new Error(`Failed to fetch ${path}: ${res.status}`);
  }

  return res.json() as Promise<T>;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const membershipParam = searchParams.get("membership");
  const membership: "all" | "members" | "f2p" =
    membershipParam === "members" || membershipParam === "f2p" ? membershipParam : "all";

  try {
    const [mapping, latest, volumes] = await Promise.all([
      fetchJson<MappingItem[]>("/mapping", { revalidate: 3600 }),
      fetchJson<{ data: Record<string, LatestRecord> }>("/latest", { cache: "no-store" }),
      fetchJson<{ data: Record<string, number> }>("/volumes", { cache: "no-store" }),
    ]);

    const items = mapping
      .filter((item) => {
        if (membership === "all") return true;
        const isMembers = !!item.members;
        return membership === "members" ? isMembers : !isMembers;
      })
      .map((item) => {
        const latestRecord = (latest.data?.[item.id] ?? latest.data?.[item.id.toString()]) as
          | LatestRecord
          | undefined;
        const buy = latestRecord?.low ?? null;
        const sell = latestRecord?.high ?? null;
        const margin = buy !== null && sell !== null ? sell - buy : null;
        const marginPct = margin !== null && buy && buy > 0 ? margin / buy : null;
        const volume = volumes.data?.[item.id] ?? volumes.data?.[item.id.toString()] ?? null;
        return {
          id: item.id,
          name: item.name,
          members: !!item.members,
          limit: item.limit ?? null,
          buy,
          sell,
          margin,
          marginPct,
          volume,
        };
      });

    return NextResponse.json({ items });
  } catch (error) {
    console.error("/api/items/list error", error);
    return NextResponse.json({ error: "Failed to fetch item catalog" }, { status: 500 });
  }
}
