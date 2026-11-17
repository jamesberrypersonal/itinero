// The form of request and record this version was built to send and to read (docs/spec/web/shell.md
// §4.7). Every request to the online side sends it, in the header `Itinero-Api`.
//
// A maintainer raises it, and `OLDEST_API` in services/online/src/answer.ts, in the same change, and
// only when an older version could not read what the online side would give it, or would send what
// the online side could not read.

/** Set only by the browser tests, to build a version newer than the one in the source. */
declare const __ITINERO_API__: number | undefined;

export const API: number = typeof __ITINERO_API__ === "number" ? __ITINERO_API__ : 1;

/** The header every request to the online side carries `API` in. */
export const API_HEADER = "Itinero-Api";
