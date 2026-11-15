// Links to a page (spec §4.6): a Markdown link whose destination is #page: and the page's identifier.

import type { Id } from "./types.ts";

const TARGET = /^#page:([A-Za-z0-9_-]{1,64})$/;

export function pageLink(id: Id, words: string): string {
  return `[${words.replace(/[\\[\]]/g, (c) => `\\${c}`)}](#page:${id})`;
}

export function linkTarget(href: string): Id | undefined {
  return TARGET.exec(href)?.[1];
}
