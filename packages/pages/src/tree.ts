// The tree, worked out from every page's record (spec §4): the pages under a parent, whether a page
// is in the tree, beneath, the graveyard (§4.4), forPhone (§4.8) and countryPage (§4.1).

import type { Branch, Buried, Id, Page, Pages, State } from "./types.ts";

/** An index of a trip's pages, built once per call. */
export class Index {
  readonly byId: ReadonlyMap<Id, Page>;
  private readonly children = new Map<Id | undefined, Page[]>();

  constructor(pages: Pages) {
    this.byId = new Map(pages.pages.map((p) => [p.id, p]));
    for (const page of pages.pages) {
      const list = this.children.get(page.parent) ?? [];
      list.push(page);
      this.children.set(page.parent, list);
    }
    for (const list of this.children.values()) list.sort(byOrder);
  }

  /** Every page under a parent, in the tree or not, in their order. */
  under(parent: Id | undefined): readonly Page[] {
    return this.children.get(parent) ?? [];
  }

  /** The pages in the tree under a parent, in their order. */
  inTreeUnder(parent: Id | undefined): readonly Page[] {
    return this.under(parent).filter((p) => p.buried === undefined);
  }

  /** A page is in the tree when neither it nor any page above it has `buried`. */
  inTree(id: Id): boolean {
    const seen = new Set<Id>();
    let page = this.byId.get(id);
    while (page) {
      if (page.buried !== undefined || seen.has(page.id)) return false;
      seen.add(page.id);
      if (page.parent === undefined) return true;
      page = this.byId.get(page.parent);
    }
    return false;
  }

  state(id: Id): State {
    if (!this.byId.has(id)) return "absent";
    return this.inTree(id) ? "tree" : "graveyard";
  }

  /** The pages above a page, nearest first. */
  above(id: Id): Page[] {
    const list: Page[] = [];
    const seen = new Set<Id>([id]);
    let parent = this.byId.get(id)?.parent;
    while (parent !== undefined && !seen.has(parent)) {
      const page = this.byId.get(parent);
      if (!page) break;
      list.push(page);
      seen.add(parent);
      parent = page.parent;
    }
    return list;
  }

  /** Whether `graveyard` lists a page: it has `buried`, and its parent is in the tree or it has none. */
  listed(page: Page): boolean {
    return page.buried !== undefined && (page.parent === undefined || this.inTree(page.parent));
  }

  /** The pages beneath a page that share its fate: every one down to, and not past, a page with `buried` of its own. */
  countWithout(id: Id): number {
    let count = 0;
    const stack = [...this.under(id)];
    while (stack.length > 0) {
      const page = stack.pop()!;
      if (page.buried !== undefined) continue;
      count++;
      stack.push(...this.under(page.id));
    }
    return count;
  }

  /** Every page in the tree, in the order of the tree: each page, then the pages under it. */
  treeOrder(): Page[] {
    const list: Page[] = [];
    const visit = (parent: Id | undefined) => {
      for (const page of this.inTreeUnder(parent)) {
        list.push(page);
        visit(page.id);
      }
    };
    visit(undefined);
    return list;
  }
}

export function byOrder(a: Page, b: Page): number {
  if (a.order !== b.order) return a.order < b.order ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function tree(pages: Pages): readonly Branch[] {
  const index = new Index(pages);
  const build = (parent: Id | undefined): readonly Branch[] =>
    Object.freeze(index.inTreeUnder(parent).map((page) => Object.freeze({ page, under: build(page.id) })));
  return build(undefined);
}

export function state(pages: Pages, id: Id): State {
  return new Index(pages).state(id);
}

export function page(pages: Pages, id: Id): Page | undefined {
  return pages.pages.find((p) => p.id === id);
}

export function beneath(pages: Pages, id: Id): number {
  const index = new Index(pages);
  return index.inTree(id) ? index.countWithout(id) : 0;
}

export function graveyard(pages: Pages): readonly Buried[] {
  const index = new Index(pages);
  return Object.freeze(
    pages.pages
      .filter((p) => index.listed(p))
      .sort((a, b) => b.buried! - a.buried!)
      .map((p) => Object.freeze({ page: p, went: index.countWithout(p.id) })),
  );
}

export function forPhone(pages: Pages): Pages {
  const index = new Index(pages);
  return Object.freeze({ trip: pages.trip, pages: Object.freeze(pages.pages.filter((p) => index.inTree(p.id))) });
}

export function countryPage(pages: Pages, country: string): Page | undefined {
  return new Index(pages).treeOrder().find((p) => p.country === country);
}
