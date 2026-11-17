// Choosing the newer of two time-zone rules files (docs/spec/web/shell.md §4.4). Kept apart from
// the browser's APIs, so that Node's test runner tests it.

/** The release a rules file names, such as "2026f", read without loading the file into trip-time. */
export function releaseOf(file: string): string | undefined {
  try {
    const parsed: unknown = JSON.parse(file);
    if (typeof parsed !== "object" || parsed === null) return undefined;
    const version = (parsed as { version?: unknown }).version;
    return typeof version === "string" ? version : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Whether release `a` is newer than release `b`. IANA releases sort as text, such as 2026a before
 * 2026f before 2027a, so the later as text is the newer. Any release is newer than none.
 */
export function isNewer(a: string, b: string | undefined): boolean {
  if (b === undefined || b === "") return a !== "";
  return a > b;
}

/** Which of the two rules files the shell loads at start: the version's own, or the newest fetched. */
export function chooseRules(built: string, fetched: string | undefined): "built" | "fetched" {
  return fetched !== undefined && isNewer(fetched, built) ? "fetched" : "built";
}
