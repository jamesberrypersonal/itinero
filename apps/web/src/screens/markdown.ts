// A page's text, drawn from Markdown (docs/spec/web/screens.md §4.6). micromark writes no HTML
// found in the text, which is shown as the text it is, and empties the destination of every link
// that is not an http:, https: or mailto: address, or an address within the page. Its settings for
// both are left as they are (WEB:SCREENS-NR4).

import { micromark } from "micromark";
import { gfm, gfmHtml } from "micromark-extension-gfm";

export function toHtml(text: string): string {
  return micromark(text, { extensions: [gfm()], htmlExtensions: [gfmHtml()] });
}
