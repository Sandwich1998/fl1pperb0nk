const API_BASE = "https://prices.runescape.wiki/api/v1/osrs";

export async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    next: init?.cache === "no-store" ? undefined : { revalidate: 60 },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch ${path}: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as T;
}
