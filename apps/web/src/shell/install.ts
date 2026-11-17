// Whether to say how to add Itinero to an iPhone's home screen (docs/spec/web/shell.md §4.3). Kept
// apart from the browser's APIs, so that Node's test runner tests it.

/**
 * True on an iPhone or an iPad not opened from the home screen. Safari there clears a site's stored
 * data after some days unused, unless the site was opened from the home screen (`WEB:SHELL-F3`).
 * Safari sets `navigator.standalone` to true only in an app opened from the home screen.
 */
export function suggestInstall(userAgent: string, standalone: boolean | undefined): boolean {
  return /\b(iPhone|iPad)\b/.test(userAgent) && standalone !== true;
}
