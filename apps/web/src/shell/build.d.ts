// The module the build writes for the shell (docs/spec/web/shell.md §4.6): the version's own
// time-zone rules file, which the build copies from @itinero/trip-time into the version's files.
declare module "virtual:itinero-rules" {
  /** The address of the version's own rules file, named by a hash of its contents. */
  export const url: string;
  /** The IANA release the file holds, such as "2026f". */
  export const release: string;
}
