// The branches of each trip's tree of pages a traveller opened, kept on the device in localStorage
// until they sign out (docs/spec/web/screens.md §4.6, §5.2, WEB:SCREENS-F18).

const KEY = "itinero-open-branches";

type Kept = Record<string, readonly string[]>;

function read(): Kept {
  try {
    const kept = JSON.parse(localStorage.getItem(KEY) ?? "null") as unknown;
    return kept && typeof kept === "object" && !Array.isArray(kept) ? (kept as Kept) : {};
  } catch {
    return {};
  }
}

/** The pages whose branches are open in a trip's tree. */
export function openBranches(trip: string): Set<string> {
  const ids = read()[trip];
  return new Set(Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string") : []);
}

/** Keeps the pages whose branches are open in a trip's tree, or forgets the trip's when none is. */
export function keepOpenBranches(trip: string, open: ReadonlySet<string>): void {
  const kept = read();
  if (open.size) kept[trip] = [...open].sort();
  else delete kept[trip];
  try {
    if (Object.keys(kept).length) localStorage.setItem(KEY, JSON.stringify(kept));
    else localStorage.removeItem(KEY);
  } catch {
    // Not kept: the branches stay open only while the tree is shown.
  }
}

/** Forgets every trip's open branches, on signing out. */
export function forgetOpenBranches(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing was kept.
  }
}
