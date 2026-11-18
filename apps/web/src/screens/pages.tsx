// A trip's pages: their tree, one page drawn from its Markdown, the editor, search, and the
// graveyard (docs/spec/web/screens.md §4.6, WEB:SCREENS-F5, WEB:SCREENS-F8).

import { useLayoutEffect, useMemo, useRef, useState } from "preact/hooks";
import { beneath, changeToText, forPhone, linkTarget, search, tree, type Branch, type Page, type Where } from "@itinero/pages";
import * as store from "../store/index.ts";
import { allows } from "./access.ts";
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

/** Dragging a page in the tree: the page held, and the page it would go beneath ("" for the top). */
type Drag = {
  /** Whether the traveller may move this page. */
  may: (id: string) => boolean;
  held: string | undefined;
  over: string | undefined;
  pointer: (event: PointerEvent, id: string, phase: "down" | "move" | "up" | "cancel") => void;
};

function Branches({ copy, branches, open, toggle, drag }: { copy: Copy; branches: readonly Branch[]; open: Set<string>; toggle: (id: string) => void; drag: Drag }) {
  return (
    <ul class="tree" role="group">
      {branches.map(({ page, under }) => (
        <li key={page.id} role="treeitem" aria-expanded={under.length ? open.has(page.id) : undefined}>
          <div class={`tree-row${drag.over === page.id ? " drop-target" : ""}${drag.held === page.id ? " dragging" : ""}`} data-drop={page.id}>
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

/** The tree of pages, each branch folded or open, with search and the graveyard. */
export function PageTree({ copy, account }: { copy: Copy; account: string }) {
  const canChange = useCanChange();
  const branches = useMemo(() => tree(copy.pages), [copy]);
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const toggle = (id: string) => {
    const next = new Set(open);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setOpen(next);
  };
  const [held, setHeld] = useState<string>();
  const [over, setOver] = useState<string>();
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
      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-drop]")?.dataset["drop"];
      if (phase === "move") {
        if (target !== over) setOver(target);
        return;
      }
      setHeld(undefined);
      setOver(undefined);
      if (phase === "cancel" || target === undefined || target === id) return;
      const moving = copy.pages.pages.find((p) => p.id === id);
      if ((moving?.parent ?? "") === target) return;
      void move(id, dropAt(branches, target, id));
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
            <div class={`tree-row tree-top${over === "" ? " drop-target" : ""}`} data-drop="">
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
  useLayoutEffect(() => {
    for (const link of Array.from(host.current?.querySelectorAll("a") ?? [])) {
      const href = link.getAttribute("href") ?? "";
      const target = linkTarget(href);
      if (target !== undefined) {
        if (inTree.has(target)) {
          link.setAttribute("href", pagePath(copy, target));
          link.dataset["page"] = target;
        } else {
          // A page the traveller may not see, or in the graveyard: no title, no address (ACC-F8).
          const unavailable = document.createElement("span");
          unavailable.className = "unavailable";
          unavailable.textContent = "Page not available";
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
  }, [html, inTree]);
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
  const [text, setText] = useState(existing?.text ?? "");
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
