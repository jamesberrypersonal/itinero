// What the screens offer a traveller (docs/spec/web/screens.md §4, What to offer): `authorise` is
// asked of the copy's grants. An admin's copy holds every grant; any other holds only the
// traveller's own, which is all `authorise` reads of them.

import { authorise, type Grants, type Request } from "@itinero/permissions";
import type { Copy } from "../store/index.ts";

/**
 * The grants `authorise` is asked of. A copy that is not an admin's is given its traveller's own
 * grant, in grants whose revision is 1, the lowest the permissions package reads.
 */
export function grantsOf(copy: Copy): Grants {
  return copy.grants ?? { format: 1, trip: copy.id, revision: 1, grants: [copy.you.grant] };
}

/** Whether the copy lets the traveller make a request. The copy held online still decides. */
export function allows(copy: Copy, account: string, request: Request): boolean {
  return authorise(grantsOf(copy), { traveller: account, admin: copy.you.admin }, copy.pages, request).ok;
}
