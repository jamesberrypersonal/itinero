// A trip's pages: their tree, one page drawn from its Markdown with the pages beneath and beside it,
// the editor, search, and the graveyard (docs/spec/web/screens.md §4.6, WEB:SCREENS-F5,
// WEB:SCREENS-F8, WEB:SCREENS-F14, WEB:SCREENS-F16, WEB:SCREENS-F17, WEB:SCREENS-F18).

import { useLayoutEffect, useMemo, useRef, useState } from "preact/hooks";
import { beneath, changeToText, forPhone, linkTarget, search, startingText, tree, type Branch, type Page, type Where } from "@itinero/pages";
import * as store from "../store/index.ts";
import { allows } from "./access.ts";
import { keepOpenBranches, openBranches } from "./branches.ts";
import type { Copy } from "../store/index.ts";
import { toHtml } from "./markdown.ts";
import { go, Link } from "./router.tsx";
import { useCanChange } from "./state.ts";
import { Button, Confirm, Empty, Field, Group, Refused, Row, Title } from "./ui.tsx";
import { TripMenu } from "./trip.tsx";

const tripPath = (id: string, rest = "") => `/trips/${encodeURIComponent(id)}${rest}`;
const pagePath = (copy: Copy, page: string, rest = "") => tripPath(copy.id, `/pages/${encodeURIComponent(page)}${rest}`);

/** Whether the copy lets the traveller make a change to the pages. */
function allowed(copy: Copy, account: string, change: Parameters<typeof changeToText>[0]): boolean {
  return allows(copy, account, { kind: "change-page", change });
}

/**
 * Where a page held over the tree would drop: before a row, after it, or beneath it, which the
 * row's top quarter, bottom quarter and middle give. The top of the tree is the row "" (§4.6).
 */
type Over = { id: string; zone: "before" | "into" | "after" };

/** Dragging a page in the tree: the page held, and where it would drop. */
type Drag = {
  /** Whether the traveller may move this page. */
  may: (id: string) => boolean;
  held: string | undefined;
  over: Over | undefined;
  pointer: (event: PointerEvent, id: string, phase: "down" | "move" | "up" | "cancel") => void;
};

/** The class a row takes while a page is held over it. */
function dropClass(over: Over | undefined, id: string): string {
  if (over?.id !== id) return "";
  return over.zone === "into" ? " drop-target" : ` drop-${over.zone}`;
}

function Branches({ copy, branches, open, toggle, drag }: { copy: Copy; branches: readonly Branch[]; open: Set<string>; toggle: (id: string) => void; drag: Drag }) {
  return (
    <ul class="tree" role="group">
      {branches.map(({ page, under }) => (
        <li key={page.id} role="treeitem" aria-expanded={under.length ? open.has(page.id) : undefined}>
          <div class={`tree-row${dropClass(drag.over, page.id)}${drag.held === page.id ? " dragging" : ""}`} data-drop={page.id}>
            {under.length ? (
              <button type="button" class="fold" aria-label={open.has(page.id) ? `Fold ${page.title}` : `Open ${page.title}`} onClick={() => toggle(page.id)}>
                <svg aria-hidden="true" viewBox="0 0 10 10" width="10" height="10" class={open.has(page.id) ? "folded-open" : ""}>
                  <path d="M3 1.5L7 5l-4 3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </button>
            ) : (
              <span class="fold" />
            )}
            <Link href={pagePath(copy, page.id)} class="tree-title">
              {page.title}
            </Link>
            {drag.may(page.id) ? (
              <span
                class="drag-handle"
                role="button"
                aria-label={`Drag ${page.title} to move it`}
                data-action="move-page"
                data-page={page.id}
                onPointerDown={(e) => drag.pointer(e, page.id, "down")}
                onPointerMove={(e) => drag.pointer(e, page.id, "move")}
                onPointerUp={(e) => drag.pointer(e, page.id, "up")}
                onPointerCancel={(e) => drag.pointer(e, page.id, "cancel")}
              >
                <svg aria-hidden="true" viewBox="0 0 16 16" width="16" height="16">
                  <path d="M3 5h10M3 8h10M3 11h10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
                </svg>
              </span>
            ) : null}
          </div>
          {under.length && open.has(page.id) ? <Branches copy={copy} branches={under} open={open} toggle={toggle} drag={drag} /> : null}
        </li>
      ))}
    </ul>
  );
}

/** Where a page dropped beneath another goes: after the last page already beneath it. */
function dropAt(branches: readonly Branch[], parent: string, moving: string): Where {
  const under = parent === "" ? branches : findBranch(branches, parent)?.under ?? [];
  const last = under.filter((b) => b.page.id !== moving).at(-1);
  return { ...(parent ? { parent } : {}), ...(last ? { after: last.page.id } : {}) };
}

function findBranch(branches: readonly Branch[], id: string): Branch | undefined {
  for (const branch of branches) {
    if (branch.page.id === id) return branch;
    const found = findBranch(branch.under, id);
    if (found) return found;
  }
  return undefined;
}

/** The page above a page in the tree, if any, and the pages beside it there, in order. */
function findPlace(branches: readonly Branch[], id: string, parent?: string): { parent?: string; siblings: readonly Branch[] } | undefined {
  if (branches.some((b) => b.page.id === id)) return { ...(parent ? { parent } : {}), siblings: branches };
  for (const branch of branches) {
    const found = findPlace(branch.under, id, branch.page.id);
    if (found) return found;
  }
  return undefined;
}

/**
 * Where a page dropped goes, or undefined where it would stay as it is. Dropped before a row, it
 * goes before that page, among its siblings. Dropped after a row, it goes after that page, or first
 * beneath it where the row's branch is open, since its pages then show directly below it.
 */
function dropWhere(branches: readonly Branch[], open: ReadonlySet<string>, moving: string, over: Over): Where | undefined {
  if (over.id === moving) return undefined;
  const now = findPlace(branches, moving);
  if (over.zone === "into") return (now?.parent ?? "") === over.id ? undefined : dropAt(branches, over.id, moving);
  const target = findBranch(branches, over.id);
  const place = findPlace(branches, over.id);
  if (!target || !place) return undefined;
  let to: Where;
  if (over.zone === "after" && target.under.length && open.has(target.page.id)) {
    to = { parent: target.page.id };
  } else if (over.zone === "after") {
    to = { ...(place.parent ? { parent: place.parent } : {}), after: target.page.id };
  } else {
    const at = place.siblings.findIndex((b) => b.page.id === target.page.id);
    const before = place.siblings.slice(0, at).filter((b) => b.page.id !== moving).at(-1);
    to = { ...(place.parent ? { parent: place.parent } : {}), ...(before ? { after: before.page.id } : {}) };
  }
  if (now && now.parent === to.parent) {
    const at = now.siblings.findIndex((b) => b.page.id === moving);
    if (now.siblings[at - 1]?.page.id === to.after) return undefined;
  }
  return to;
}

/** Where on the tree a pointer is: the row under it, and which part of that row. */
function overAt(x: number, y: number): Over | undefined {
  const row = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-drop]");
  const id = row?.dataset["drop"];
  if (!row || id === undefined) return undefined;
  if (id === "") return { id, zone: "into" };
  const box = row.getBoundingClientRect();
  const down = (y - box.top) / box.height;
  return { id, zone: down < 0.25 ? "before" : down > 0.75 ? "after" : "into" };
}

/** The tree of pages, each branch folded or open, with search and the graveyard. */
export function PageTree({ copy, account }: { copy: Copy; account: string }) {
  const canChange = useCanChange();
  const branches = useMemo(() => tree(copy.pages), [copy]);
  // The branches the traveller opened stay open on the device, for each trip, until they sign out
  // (WEB:SCREENS-F18).
  const [open, setOpenNow] = useState<Set<string>>(() => openBranches(copy.id));
  const setOpen = (next: Set<string>) => {
    const pages = new Set(copy.pages.pages.map((p) => p.id));
    const kept = new Set([...next].filter((id) => pages.has(id)));
    keepOpenBranches(copy.id, kept);
    setOpenNow(kept);
  };
  const toggle = (id: string) => {
    const next = new Set(open);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setOpen(next);
  };
  const [held, setHeld] = useState<string>();
  const [over, setOver] = useState<Over>();
  const [agreeing, setAgreeing] = useState<{ id: string; to: Where; count: number; message: string }>();
  const [error, setError] = useState<string>();

  /**
   * Sends a move with no `agreed`. Where the copy held online says the move lets more travellers see
   * the page, the screen asks first, and sends it again with that number (§4.6, ACC-F9).
   */
  const move = async (id: string, to: Where, agreed?: number) => {
    const result = await store.send(copy.id, "pages", changeToText({ op: "move", id, to }), agreed);
    if (result.ok) {
      setError(undefined);
      if (to.parent) setOpen(new Set([...open, to.parent]));
      return;
    }
    if (result.refusal.code === "agree-first") {
      return setAgreeing({ id, to, count: Number(result.refusal.details?.["count"] ?? 0), message: result.refusal.message });
    }
    setError(result.refusal.message);
  };

  const drag: Drag = {
    may: (id) => canChange && allowed(copy, account, { op: "move", id, to: {} }),
    held,
    over,
    pointer(event, id, phase) {
      if (phase === "down") {
        event.preventDefault();
        (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
        setHeld(id);
        return;
      }
      if (held !== id) return;
      const target = overAt(event.clientX, event.clientY);
      if (phase === "move") {
        if (target?.id !== over?.id || target?.zone !== over?.zone) setOver(target);
        return;
      }
      setHeld(undefined);
      setOver(undefined);
      if (phase === "cancel" || target === undefined) return;
      const to = dropWhere(branches, open, id, target);
      if (to) void move(id, to);
    },
  };
  return (
    <main class="screen" data-screen="pages">
      <Title action={<TripMenu id={copy.id} />}>Pages</Title>
      <Link class="search-field" href={tripPath(copy.id, "/search")}>
        <svg aria-hidden="true" viewBox="0 0 20 20" width="16" height="16">
          <circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" stroke-width="1.8" />
          <path d="M13 13l4.5 4.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
        </svg>
        Search the pages
      </Link>
      {branches.length ? (
        <div class="group tree-group" aria-label="Pages" role="tree">
          <Branches copy={copy} branches={branches} open={open} toggle={toggle} drag={drag} />
          {held ? (
            <div class={`tree-row tree-top${over?.id === "" ? " drop-target" : ""}`} data-drop="">
              To the top of the tree
            </div>
          ) : null}
        </div>
      ) : (
        <Empty>No pages yet.</Empty>
      )}
      {canChange && allowed(copy, account, { op: "add", id: "new", title: "New", at: {} }) ? (
        <Button kind="plain" class="wide" onClick={() => go(tripPath(copy.id, "/pages/new"))} data-action="new-page">
          New page
        </Button>
      ) : null}
      <Refused message={error} />
      {copy.graveyard.length ? (
        <Group>
          <Row href={tripPath(copy.id, "/graveyard")} detail={String(copy.graveyard.length)}>
            Deleted pages
          </Row>
        </Group>
      ) : null}
      {agreeing ? (
        <Confirm
          title={agreeing.count === 1 ? "1 more traveller will see this page" : `${agreeing.count} more travellers will see this page`}
          message={agreeing.message.replace(/ Confirm, and move it again\.$/, " Move it anyway?")}
          confirm="Move"
          onCancel={() => setAgreeing(undefined)}
          onConfirm={() => {
            const { id, to, count } = agreeing;
            setAgreeing(undefined);
            void move(id, to, count);
          }}
        />
      ) : null}
    </main>
  );
}

/** A page's text, drawn, with its links to other pages opened here or shown as not available (§4.6). */
function Drawn({ copy, text }: { copy: Copy; text: string }) {
  const host = useRef<HTMLDivElement>(null);
  const html = useMemo(() => toHtml(text), [text]);
  const inTree = useMemo(() => new Set(forPhone(copy.pages).pages.map((p) => p.id)), [copy]);
  const deleted = useMemo(() => new Set(copy.graveyard.map((entry) => entry.id)), [copy]);
  useLayoutEffect(() => {
    for (const link of Array.from(host.current?.querySelectorAll("a") ?? [])) {
      const href = link.getAttribute("href") ?? "";
      const target = linkTarget(href);
      if (target !== undefined) {
        if (inTree.has(target)) {
          link.setAttribute("href", pagePath(copy, target));
          link.dataset["page"] = target;
        } else {
          // A page in the graveyard the traveller could see is shown as deleted (PLN-F9). Any other
          // is shown as not available, with no title and no address (ACC-F8).
          const unavailable = document.createElement("span");
          unavailable.className = "unavailable";
          if (deleted.has(target)) {
            unavailable.textContent = "Page deleted";
            unavailable.dataset["graveyard"] = target;
          } else {
            unavailable.textContent = "Page not available";
          }
          link.replaceWith(unavailable);
        }
      } else if (href === "" || href.startsWith("#")) {
        link.removeAttribute("href");
      } else {
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.referrerPolicy = "no-referrer";
      }
    }
  }, [html, inTree, deleted]);
  return (
    <div
      class="prose"
      ref={host}
      dangerouslySetInnerHTML={{ __html: html }}
      onClick={(event) => {
        const link = (event.target as HTMLElement).closest("a[data-page]");
        if (!link || event.metaKey || event.ctrlKey) return;
        event.preventDefault();
        go(link.getAttribute("href")!);
      }}
    />
  );
}

/** One page, drawn, with its actions where the traveller may take them. */
export function PageView({ copy, account, id }: { copy: Copy; account: string; id: string }) {
  const canChange = useCanChange();
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string>();
  const page = forPhone(copy.pages).pages.find((p) => p.id === id);
  if (!page) {
    return (
      <main class="screen narrow" data-screen="page">
        <Title back={{ href: tripPath(copy.id, "/pages"), label: "Pages" }}>Page not available</Title>
        <p class="lead">This page has been deleted, or you may not see it.</p>
      </main>
    );
  }
  const parent = page.parent ? copy.pages.pages.find((p) => p.id === page.parent) : undefined;
  const going = beneath(copy.pages, page.id) + 1;
  const branches = tree(copy.pages);
  const under = findBranch(branches, page.id)?.under ?? [];
  const siblings = findPlace(branches, page.id)?.siblings ?? [];
  const at = siblings.findIndex((b) => b.page.id === page.id);
  const before = siblings[at - 1]?.page;
  const after = siblings[at + 1]?.page;
  const may = (change: Parameters<typeof changeToText>[0]) => canChange && allowed(copy, account, change);
  return (
    <main class="screen" data-screen="page">
      <Title
        back={parent ? { href: pagePath(copy, parent.id), label: parent.title } : { href: tripPath(copy.id, "/pages"), label: "Pages" }}
        action={
          may({ op: "write", id, text: "", base: page.revision }) ? (
            <Button kind="plain" onClick={() => go(pagePath(copy, id, "/edit"))} data-action="edit-page">
              Edit
            </Button>
          ) : undefined
        }
      >
        {page.title}
      </Title>
      {page.text.trim() ? <Drawn copy={copy} text={page.text} /> : <Empty>Nothing written here yet.</Empty>}
      {under.length ? (
        <section class="group beneath" aria-label={`Pages beneath ${page.title}`}>
          <h2 class="group-heading">Pages beneath</h2>
          <div class="group-rows">
            {under.map(({ page: child }) => (
              <Link key={child.id} class="row row-link" href={pagePath(copy, child.id)} data-beneath={child.id}>
                <span class="row-main">{child.title}</span>
                <svg class="chevron" aria-hidden="true" viewBox="0 0 8 14" width="7" height="12">
                  <path d="M1.5 1.5L6.5 7l-5 5.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
      {before || after ? (
        <nav class="neighbours" aria-label="Pages beside this one">
          {before ? (
            <Link class="neighbour" href={pagePath(copy, before.id)} data-neighbour="before">
              <span class="neighbour-label">Previous</span>
              <span class="neighbour-title">{before.title}</span>
            </Link>
          ) : (
            <span />
          )}
          {after ? (
            <Link class="neighbour neighbour-after" href={pagePath(copy, after.id)} data-neighbour="after">
              <span class="neighbour-label">Next</span>
              <span class="neighbour-title">{after.title}</span>
            </Link>
          ) : null}
        </nav>
      ) : null}
      <div class="actions">
        {may({ op: "add", id: "new", title: "New", at: { parent: id } }) ? (
          <Button kind="plain" onClick={() => go(`${tripPath(copy.id, "/pages/new")}?parent=${encodeURIComponent(id)}`)}>
            Add a page beneath
          </Button>
        ) : null}
        {may({ op: "bury", id }) ? (
          <Button kind="plain" class="danger-text" onClick={() => setAsking(true)} data-action="delete-page">
            Delete
          </Button>
        ) : null}
      </div>
      <Refused message={error} />
      {asking ? (
        <Confirm
          title={`Delete ${page.title}?`}
          message={
            going === 1
              ? "The page goes to the trip's deleted pages, where an admin can restore it."
              : `${going} pages will go: this one and the ${going - 1} beneath it. They go to the trip's deleted pages, where an admin can restore them.`
          }
          confirm="Delete"
          onCancel={() => setAsking(false)}
          onConfirm={async () => {
            setAsking(false);
            const result = await store.send(copy.id, "pages", changeToText({ op: "bury", id }));
            if (!result.ok) return setError(result.refusal.message);
            go(parent ? pagePath(copy, parent.id) : tripPath(copy.id, "/pages"), true);
          }}
        />
      ) : null}
    </main>
  );
}

/**
 * The editor: a page's Markdown, in a plain text box, with the page drawn beside it on a computer
 * and a tab to switch on a phone. A save from an older version shows both texts (PLN-F16).
 */
export function PageEditor({ copy, id, parent }: { copy: Copy; id?: string; parent?: string }) {
  const canChange = useCanChange();
  const existing: Page | undefined = id ? copy.pages.pages.find((p) => p.id === id) : undefined;
  const [title, setTitle] = useState(existing?.title ?? "");
  // A new page starts with the headings a traveller researches under (WEB:SCREENS-F14).
  const [text, setText] = useState(existing?.text ?? (id ? "" : startingText("page")));
  const [base, setBase] = useState(existing?.revision ?? 0);
  const [theirs, setTheirs] = useState<string>();
  const [tab, setTab] = useState<"write" | "see">("write");
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const back = existing ? pagePath(copy, existing.id) : parent ? pagePath(copy, parent) : tripPath(copy.id, "/pages");

  const save = async (event: Event) => {
    event.preventDefault();
    setSaving(true);
    let result;
    if (existing) {
      if (title !== existing.title) {
        const renamed = await store.send(copy.id, "pages", changeToText({ op: "rename", id: existing.id, title }));
        if (!renamed.ok) {
          setSaving(false);
          return setError(renamed.refusal.message);
        }
      }
      result = await store.send(copy.id, "pages", changeToText({ op: "write", id: existing.id, text, base }));
    } else {
      const made = `p-${crypto.randomUUID().slice(0, 12)}`;
      result = await store.send(copy.id, "pages", changeToText({ op: "add", id: made, title, text, at: parent ? { parent } : {} }));
      if (result.ok) {
        setSaving(false);
        return go(pagePath(copy, made), true);
      }
    }
    setSaving(false);
    if (result.ok) return go(back, true);
    if (result.refusal.code === "stale") {
      // Another traveller saved meanwhile: show both, and save again from their version.
      setTheirs(result.refusal.details?.["text"] ?? "");
      setBase(Number(result.refusal.details?.["revision"] ?? base));
      return setError("Another traveller changed this page while you were writing. Their text is beside yours: combine the two, and save again.");
    }
    setError(result.refusal.message);
  };

  return (
    <main class="screen wide-screen" data-screen="page-editor">
      <Title back={{ href: back, label: "Cancel" }}>{existing ? "Edit page" : "New page"}</Title>
      <form class="form" onSubmit={save}>
        <Field label="Title">
          <input name="title" value={title} maxLength={200} onInput={(e) => setTitle(e.currentTarget.value)} required />
        </Field>
        <div class="tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === "write"} onClick={() => setTab("write")}>
            Write
          </button>
          <button type="button" role="tab" aria-selected={tab === "see"} onClick={() => setTab("see")}>
            See
          </button>
        </div>
        <div class={`editor editor-${tab}`}>
          <textarea name="text" aria-label="Text" value={text} onInput={(e) => setText(e.currentTarget.value)} spellcheck />
          <div class="editor-preview">
            <Drawn copy={copy} text={text} />
          </div>
        </div>
        {theirs !== undefined ? (
          <section class="theirs" data-theirs>
            <h2 class="group-heading">The page as it now stands</h2>
            <textarea readOnly aria-label="The page as it now stands" value={theirs} />
          </section>
        ) : null}
        <Refused message={error} />
        <Button type="submit" disabled={!canChange || saving || !title.trim()} data-action="save-page">
          Save
        </Button>
      </form>
    </main>
  );
}

/** Searching the pages, with or without a connection (PLN-F12). */
export function Search({ copy }: { copy: Copy }) {
  const [words, setWords] = useState("");
  const hits = useMemo(() => {
    if (!words.trim()) return [];
    const found = search(copy.pages, words);
    return found.ok ? found.value : [];
  }, [copy, words]);
  return (
    <main class="screen" data-screen="search">
      <Title back={{ href: tripPath(copy.id, "/pages"), label: "Pages" }}>Search</Title>
      <input class="search-input" type="search" name="words" aria-label="Search the pages" placeholder="Words to find" enterkeyhint="search" value={words} onInput={(e) => setWords(e.currentTarget.value)} autofocus />
      {words.trim() && hits.length === 0 ? <Empty>No page holds those words.</Empty> : null}
      {hits.length ? (
        <Group>
          {hits.map((hit) => (
            <Link key={hit.page.id} class="row row-link hit" href={pagePath(copy, hit.page.id)} data-hit={hit.page.id}>
              <span class="row-main">
                <span class="hit-title">{hit.page.title}</span>
                {hit.around.slice(0, 2).map((around, i) => (
                  <span class="hit-around" key={i}>
                    …{around.before}
                    <mark>{around.match}</mark>
                    {around.after}…
                  </span>
                ))}
              </span>
            </Link>
          ))}
        </Group>
      ) : null}
    </main>
  );
}

/** The deleted pages the traveller could see, which an admin reads and restores online (PLN-F13). */
export function Graveyard({ copy }: { copy: Copy }) {
  const canChange = useCanChange();
  const [reading, setReading] = useState<Page>();
  const [error, setError] = useState<string>();
  return (
    <main class="screen" data-screen="graveyard">
      <Title back={{ href: tripPath(copy.id, "/pages"), label: "Pages" }}>Deleted pages</Title>
      {copy.graveyard.length === 0 ? <Empty>No deleted pages.</Empty> : null}
      <Group note={copy.you.admin ? "An admin can open a deleted page, and restore it, while online." : undefined}>
        {copy.graveyard.map((entry) => (
          <Row
            key={entry.id}
            detail={entry.went ? `and ${entry.went} beneath` : undefined}
            {...(copy.you.admin && canChange
              ? {
                  onClick: async () => {
                    const page = await store.buried(copy.id, entry.id);
                    if (!page.ok) return setError(page.refusal.message);
                    setReading(page.value);
                  },
                }
              : {})}
          >
            {entry.title}
          </Row>
        ))}
      </Group>
      <Refused message={error} />
      {reading ? (
        <section class="buried" data-buried={reading.id}>
          <h2 class="title-small">{reading.title}</h2>
          {reading.text.trim() ? <Drawn copy={copy} text={reading.text} /> : <Empty>Nothing was written here.</Empty>}
          <Button
            onClick={async () => {
              const result = await store.send(copy.id, "pages", changeToText({ op: "restore", id: reading.id }));
              if (!result.ok) return setError(result.refusal.message);
              go(pagePath(copy, reading.id));
            }}
          >
            Restore
          </Button>
        </section>
      ) : null}
    </main>
  );
}
