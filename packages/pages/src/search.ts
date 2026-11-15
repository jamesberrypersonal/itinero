// Search (spec §4.7). The words and each title and text are folded the same way on every device:
// white space runs become one space, each character is decomposed as NFD does and its combining
// marks dropped, and what is left takes its lower case by the Unicode default case mapping, which
// depends on no language. Each folded character remembers where it came from in the text as
// written, so the words around a match are given as written.

import { Index } from "./tree.ts";
import { attempt, fail, type Around, type Hit, type Pages, type Result } from "./types.ts";

const CONTEXT = 40;
const MAX_MATCHES = 3;

type Folded = { text: string; from: number[]; to: number[] };

/** Folds text, keeping for each folded code unit the code points of the original it came from. */
function fold(original: readonly string[]): Folded {
  let text = "";
  const from: number[] = [];
  const to: number[] = [];
  let inSpace = false;
  for (let i = 0; i < original.length; i++) {
    const char = original[i]!;
    if (/\s/u.test(char)) {
      if (inSpace) {
        to[to.length - 1] = i + 1;
        continue;
      }
      inSpace = true;
      text += " ";
      from.push(i);
      to.push(i + 1);
      continue;
    }
    inSpace = false;
    const plain = char.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
    for (let k = 0; k < plain.length; k++) {
      text += plain[k];
      from.push(i);
      to.push(i + 1);
    }
  }
  return { text, from, to };
}

function foldWords(words: string): string {
  return fold([...words]).text.trim();
}

function around(original: readonly string[], start: number, end: number): Around {
  let before = original.slice(Math.max(0, start - CONTEXT), start).join("");
  if (start > CONTEXT) {
    const space = before.search(/\s/u);
    before = space < 0 ? "" : before.slice(space + 1);
  }
  let after = original.slice(end, end + CONTEXT).join("");
  if (end + CONTEXT < original.length) {
    const last = Math.max(after.lastIndexOf(" "), after.lastIndexOf("\n"), after.lastIndexOf("\t"));
    after = last < 0 ? "" : after.slice(0, last);
  }
  return Object.freeze({ before, match: original.slice(start, end).join(""), after });
}

function matches(original: readonly string[], folded: Folded, words: string, limit: number): Around[] {
  const found: Around[] = [];
  let at = 0;
  while (found.length < limit) {
    const hit = folded.text.indexOf(words, at);
    if (hit < 0) break;
    const last = hit + words.length - 1;
    found.push(around(original, folded.from[hit]!, folded.to[last]!));
    at = hit + words.length;
  }
  return found;
}

export function search(pages: Pages, words: string): Result<readonly Hit[]> {
  return attempt(() => {
    if (typeof words !== "string") fail("malformed", "The words searched for are not text.");
    const wanted = foldWords(words);
    if (wanted === "") fail("no-words", "There are no words to search for.");
    const hits: Hit[] = [];
    for (const page of new Index(pages).treeOrder()) {
      const title = [...page.title];
      const text = [...page.text];
      const found = matches(title, fold(title), wanted, MAX_MATCHES);
      found.push(...matches(text, fold(text), wanted, MAX_MATCHES - found.length));
      if (found.length > 0) hits.push(Object.freeze({ page, around: Object.freeze(found) }));
    }
    return Object.freeze(hits);
  });
}
