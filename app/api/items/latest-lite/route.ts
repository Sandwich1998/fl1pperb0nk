import { NextResponse } from "next/server";

const API_BASE = "https://prices.runescape.wiki/api/v1/osrs";
const USER_AGENT = "osrs-flip-finder/1.0 (contact@example.com)";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const idsParam = searchParams.get("ids");
  const ids =
    idsParam && idsParam.length > 0
      ? idsParam
          .split(",")
          .map((s) => Number(s.trim()))
          .filter((n) => Number.isFinite(n) && n > 0)
      : [];

  try {
    const res = await fetch(`${API_BASE}/latest`, {
      headers: { "User-Agent": USER_AGENT },
      next: { revalidate: 60 },
    });
    if (!res.ok) {
      return NextResponse.json({ error: "Failed latest" }, { status: 502 });
    }
    const body = (await res.json()) as {
      data: Record<string, { high: number | null; low: number | null }>;
    };
    const map: Record<number, { buy: number; sell: number }> = {};
    const source = body.data ?? {};
    if (ids.length === 0) {
      Object.entries(source).forEach(([k, v]) => {
        const id = Number(k);
        if (!Number.isFinite(id)) return;
        const buy = v.low ?? 0;
        const sell = v.high ?? 0;
        if (buy > 0 && sell > 0) map[id] = { buy, sell };
      });
    } else {
      ids.forEach((id) => {
        const rec = source[id];
        if (!rec) return;
        const buy = rec.low ?? 0;
        const sell = rec.high ?? 0;
        if (buy > 0 && sell > 0) map[id] = { buy, sell };
      });
    }
    return NextResponse.json({ latest: map });
  } catch (error) {
    return NextResponse.json({ error: "Failed latest" }, { status: 500 });
  }
}
