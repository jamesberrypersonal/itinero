// A trip's checklists, the traveller's library of templates, and the editor both share
// (docs/spec/web/screens.md §4.10, WEB:SCREENS-F11, WEB:SCREENS-F12). A checklist and a template are
// the traveller's own, so every control that changes one shows whenever the device is online (§4).

import { useEffect, useRef, useState } from "preact/hooks";
import { changeToText, placeAfter, progress, type Change, type Checklist, type Placed } from "@itinero/checklists";
import * as store from "../store/index.ts";
import type { Copy, Result } from "../store/index.ts";
import { go, Link } from "./router.tsx";
import { useCanChange, useLibrary } from "./state.ts";
import { TripMenu } from "./trip.tsx";
import { Button, Confirm, Empty, Field, Group, Refused, Row, Title } from "./ui.tsx";

const tripPath = (id: string, rest = "") => `/trips/${encodeURIComponent(id)}${rest}`;
export const checklistPath = (trip: string, checklist: string) => tripPath(trip, `/checklists/${encodeURIComponent(checklist)}`);
const templatePath = (template: string) => `/library/${encodeURIComponent(template)}`;

/** How far a checklist has got, such as "1 of 4". */
export function progressWords(checklist: Checklist): string {
  const { ticked, of } = progress(checklist);
  return `${ticked} of ${of}`;
}

const itemsWords = (checklist: Checklist) => (checklist.items.length === 1 ? "1 item" : `${checklist.items.length} items`);

/** How long a finger rests on an item's text before it is rewritten (§4.10). */
const HOLD = 500;

/**
 * Where a row dropped onto another goes. Dropped on a row above where it was, it goes before that
 * row. Dropped on a row below, it goes after it. Gives the identifier to put it after, or undefined
 * for the start, or "stay" for no move.
 */
function dropAfter(ids: readonly string[], moving: string, onto: string): string | undefined | "stay" {
  const from = ids.indexOf(moving);
  const to = ids.indexOf(onto);
  if (from < 0 || to < 0 || from === to) return "stay";
  return to < from ? ids[to - 1] : onto;
}

/** Dragging a row by its handle, onto another row (§4.10). */
function useDrag(onDrop: (moving: string, onto: string) => void) {
  const [held, setHeld] = useState<string>();
  const [over, setOver] = useState<string>();
  const pointer = (event: PointerEvent, id: string, phase: "down" | "move" | "up" | "cancel") => {
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
    if (phase === "up" && target && target !== id) onDrop(id, target);
  };
  return { held, over, pointer };
}

function Handle({ label, id, pointer, action }: { label: string; id: string; pointer: ReturnType<typeof useDrag>["pointer"]; action: string }) {
  return (
    <span
      class="drag-handle"
      role="button"
      aria-label={label}
      data-action={action}
      data-id={id}
      onPointerDown={(e) => pointer(e, id, "down")}
      onPointerMove={(e) => pointer(e, id, "move")}
      onPointerUp={(e) => pointer(e, id, "up")}
      onPointerCancel={(e) => pointer(e, id, "cancel")}
    >
      <svg aria-hidden="true" viewBox="0 0 16 16" width="16" height="16">
        <path d="M3 5h10M3 8h10M3 11h10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
      </svg>
    </span>
  );
}

/** A list of checklists or templates, each a row with its count, arranged by dragging. */
function Listed({
  checklists,
  href,
  detail,
  canChange,
  place,
}: {
  checklists: readonly Checklist[];
  href: (checklist: Checklist) => string;
  detail: (checklist: Checklist) => string;
  canChange: boolean;
  place: (change: Change) => Promise<void>;
}) {
  const drag = useDrag((moving, onto) => {
    const after = dropAfter(checklists.map((c) => c.id), moving, onto);
    if (after === "stay") return;
    const placed = placeAfter(checklists as readonly Placed[], moving, after);
    if (placed.ok) void place(placed.value);
  });
  return (
    <div class="group-rows" data-list>
      {checklists.map((checklist) => (
        <div key={checklist.id} class={`checklist-row${drag.over === checklist.id ? " drop-target" : ""}${drag.held === checklist.id ? " dragging" : ""}`} data-drop={checklist.id} data-checklist={checklist.id}>
          <Link class="row row-link" href={href(checklist)}>
            <span class="row-main">{checklist.title}</span>
            <span class="row-detail" data-progress>
              {detail(checklist)}
            </span>
          </Link>
          {canChange ? <Handle label={`Drag ${checklist.title} to move it`} id={checklist.id} pointer={drag.pointer} action="move-checklist" /> : null}
        </div>
      ))}
    </div>
  );
}

/** A trip's checklists: the traveller's own, in their order, and starting a new one (§4.10, WEB:SCREENS-F11). */
export function Checklists({ copy }: { copy: Copy }) {
  const canChange = useCanChange();
  const library = useLibrary();
  const [choosing, setChoosing] = useState(false);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string>();

  const start = async (startWith: store.Start) => {
    const result = await store.addChecklist(copy.id, startWith);
    if (!result.ok) return setError(result.refusal.message);
    setError(undefined);
    setChoosing(false);
    setTitle("");
    go(checklistPath(copy.id, result.value.checklist));
  };

  return (
    <main class="screen" data-screen="checklists">
      <Title action={<TripMenu id={copy.id} />}>Checklists</Title>
      {copy.checklists.length ? (
        <section class="group">
          <Listed
            checklists={copy.checklists}
            href={(c) => checklistPath(copy.id, c.id)}
            detail={progressWords}
            canChange={canChange}
            place={async (change) => {
              const result = await store.send(copy.id, "checklists", changeToText(change));
              setError(result.ok ? undefined : result.refusal.message);
            }}
          />
          <p class="group-note">Only you see your checklists.</p>
        </section>
      ) : (
        <Empty>You have no checklists on this trip yet. Only you will see the ones you start.</Empty>
      )}
      {canChange && !choosing ? (
        <div class="actions">
          <Button onClick={() => setChoosing(true)} data-action="new-checklist">
            New checklist
          </Button>
        </div>
      ) : null}
      {canChange && choosing ? (
        <Group heading="Start from">
          <form
            class="row row-stack"
            data-form="empty-checklist"
            onSubmit={(event) => {
              event.preventDefault();
              void start({ title });
            }}
          >
            <Field label="Empty, titled">
              <input name="title" value={title} onInput={(e) => setTitle(e.currentTarget.value)} autocomplete="off" />
            </Field>
            <Button type="submit" disabled={!title.trim()} data-action="start-empty">
              Start an empty checklist
            </Button>
          </form>
          {(library?.templates ?? []).map((template) => (
            <Row key={template.id} onClick={() => void start({ from: template })} detail={itemsWords(template)}>
              <span data-template={template.id}>{template.title}</span>
            </Row>
          ))}
          <Row onClick={() => setChoosing(false)}>
            <span class="accent-text">Cancel</span>
          </Row>
        </Group>
      ) : null}
      <Refused message={error} />
      <Group>
        <Row href="/library">Your templates</Row>
      </Group>
    </main>
  );
}

/** The traveller's library of templates (§4.10, WEB:SCREENS-F12). */
export function Library() {
  const canChange = useCanChange();
  const library = useLibrary();
  const [title, setTitle] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string>();
  if (!library) return <main class="screen" aria-busy="true" />;
  return (
    <main class="screen" data-screen="library">
      <Title back={{ href: "/", label: "Trips" }}>Your templates</Title>
      {library.templates.length ? (
        <section class="group">
          <Listed
            checklists={library.templates}
            href={(t) => templatePath(t.id)}
            detail={itemsWords}
            canChange={canChange}
            place={async (change) => {
              const result = await store.changeTemplate(changeToText(change));
              setError(result.ok ? undefined : result.refusal.message);
            }}
          />
          <p class="group-note">Start a trip's checklist from any of these. Only you see them.</p>
        </section>
      ) : (
        <Empty>No templates yet. Make one here, or save a trip's checklist as one.</Empty>
      )}
      {canChange ? (
        adding ? (
          <form
            class="group-form"
            data-form="new-template"
            onSubmit={async (event) => {
              event.preventDefault();
              const result = await store.addTemplate({ title });
              if (!result.ok) return setError(result.refusal.message);
              setError(undefined);
              setAdding(false);
              setTitle("");
              go(templatePath(result.value.template));
            }}
          >
            <Field label="Title">
              <input name="title" value={title} onInput={(e) => setTitle(e.currentTarget.value)} autocomplete="off" />
            </Field>
            <Button type="submit" disabled={!title.trim()} data-action="add-template">
              Make the template
            </Button>
          </form>
        ) : (
          <div class="actions">
            <Button onClick={() => setAdding(true)} data-action="new-template">
              New template
            </Button>
          </div>
        )
      ) : null}
      <Refused message={error} />
    </main>
  );
}

/** One of a trip's checklists. */
export function ChecklistScreen({ copy, id }: { copy: Copy; id: string }) {
  const checklist = copy.checklists.find((c) => c.id === id);
  const [saved, setSaved] = useState<string>();
  if (!checklist) {
    return (
      <main class="screen" data-screen="checklist">
        <Title back={{ href: tripPath(copy.id, "/checklists"), label: "Checklists" }}>Checklist not here</Title>
        <Empty>This checklist was deleted, or has not reached this device yet.</Empty>
      </main>
    );
  }
  return (
    <Editor
      screen="checklist"
      checklist={checklist}
      back={{ href: tripPath(copy.id, "/checklists"), label: "Checklists" }}
      send={(change) => store.send(copy.id, "checklists", changeToText(change))}
      remove={async () => {
        const result = await store.deleteChecklist(copy.id, id);
        if (result.ok) go(tripPath(copy.id, "/checklists"), true);
        return result;
      }}
      save={async () => {
        const result = await store.addTemplate({ from: checklist });
        if (result.ok) setSaved("Saved to your templates.");
        return result;
      }}
      note={saved}
    />
  );
}

/** One of the traveller's templates. */
export function TemplateScreen({ id }: { id: string }) {
  const library = useLibrary();
  if (!library) return <main class="screen" aria-busy="true" />;
  const template = library.templates.find((t) => t.id === id);
  if (!template) {
    return (
      <main class="screen" data-screen="template">
        <Title back={{ href: "/library", label: "Your templates" }}>Template not here</Title>
        <Empty>This template was deleted, or has not reached this device yet.</Empty>
      </main>
    );
  }
  return (
    <Editor
      screen="template"
      checklist={template}
      back={{ href: "/library", label: "Your templates" }}
      send={(change) => store.changeTemplate(changeToText(change))}
      remove={async () => {
        const result = await store.deleteTemplate(id);
        if (result.ok) go("/library", true);
        return result;
      }}
    />
  );
}

/** A checklist or a template: its title, then its items, edited in place (§4.10). */
function Editor({
  screen,
  checklist,
  back,
  send,
  remove,
  save,
  note,
}: {
  screen: "checklist" | "template";
  checklist: Checklist;
  back: { href: string; label: string };
  send: (change: Change) => Promise<Result<unknown>>;
  remove: () => Promise<Result<unknown>>;
  save?: () => Promise<Result<unknown>>;
  note?: string | undefined;
}) {
  const canChange = useCanChange();
  const tickable = checklist.trip !== undefined;
  const [error, setError] = useState<string>();
  const [renaming, setRenaming] = useState<string>();
  const [editing, setEditing] = useState<{ id: string; text: string }>();
  const [menu, setMenu] = useState<string>();
  const [adding, setAdding] = useState("");
  const [deleting, setDeleting] = useState(false);
  const holding = useRef<ReturnType<typeof setTimeout>>(undefined);
  const held = useRef(false);

  // Leaving edits behind once the device goes offline: no control that changes it shows then.
  useEffect(() => {
    if (!canChange) {
      setRenaming(undefined);
      setEditing(undefined);
      setMenu(undefined);
    }
  }, [canChange]);

  const apply = async (change: Change): Promise<boolean> => {
    const result = await send(change);
    setError(result.ok ? undefined : result.refusal.message);
    return result.ok;
  };
  const id = checklist.id;
  const ids = checklist.items.map((i) => i.id);
  const drag = useDrag((moving, onto) => {
    const after = dropAfter(ids, moving, onto);
    if (after === "stay") return;
    void apply(after === undefined ? { op: "move", checklist: id, item: moving } : { op: "move", checklist: id, item: moving, after });
  });

  const tick = (item: string, ticked: boolean) => {
    if (held.current) return;
    void apply({ op: "tick", checklist: id, item, ticked });
  };
  const startHold = (item: { id: string; text: string }) => {
    held.current = false;
    holding.current = setTimeout(() => {
      held.current = true;
      setEditing({ id: item.id, text: item.text });
    }, HOLD);
  };
  const endHold = () => clearTimeout(holding.current);

  return (
    <main class="screen" data-screen={screen} data-id={id}>
      <Title back={back}>
        {renaming !== undefined ? (
          <form
            class="rename"
            onSubmit={async (event) => {
              event.preventDefault();
              if (await apply({ op: "rename", checklist: id, title: renaming })) setRenaming(undefined);
            }}
          >
            <input name="title" aria-label="Title" value={renaming} onInput={(e) => setRenaming(e.currentTarget.value)} autoFocus />
            <Button type="submit" data-action="save-title">
              Save
            </Button>
          </form>
        ) : canChange ? (
          <button type="button" class="title-button" onClick={() => setRenaming(checklist.title)} data-action="rename">
            {checklist.title}
          </button>
        ) : (
          checklist.title
        )}
      </Title>
      {tickable ? (
        <p class="lead" data-progress>
          {progressWords(checklist)} done
        </p>
      ) : null}

      <section class="group">
        <ul class="group-rows checklist-items">
          {checklist.items.map((item) => {
            const ticked = item.ticked === true;
            const rowClass = `checklist-item${ticked ? " ticked" : ""}${drag.over === item.id ? " drop-target" : ""}${drag.held === item.id ? " dragging" : ""}`;
            if (editing?.id === item.id) {
              return (
                <li key={item.id} class={rowClass} data-item={item.id}>
                  <form
                    class="item-edit"
                    onSubmit={async (event) => {
                      event.preventDefault();
                      if (await apply({ op: "write", checklist: id, item: item.id, text: editing.text })) setEditing(undefined);
                    }}
                  >
                    <input name="item-text" aria-label="Item" value={editing.text} onInput={(e) => setEditing({ id: item.id, text: e.currentTarget.value })} autoFocus />
                    <Button type="submit" data-action="save-item">
                      Save
                    </Button>
                    <Button kind="plain" onClick={() => setEditing(undefined)}>
                      Cancel
                    </Button>
                  </form>
                </li>
              );
            }
            return (
              <li key={item.id} class={rowClass} data-drop={item.id} data-item={item.id} data-ticked={ticked ? "yes" : "no"}>
                {tickable && canChange ? (
                  <input type="checkbox" class="tick" checked={ticked} aria-label={item.text} data-action="tick" onChange={() => tick(item.id, !ticked)} />
                ) : tickable ? (
                  <span class="tick-mark" aria-hidden="true">
                    {ticked ? "✓" : ""}
                  </span>
                ) : null}
                <span
                  class="item-text"
                  onClick={() => tickable && canChange && tick(item.id, !ticked)}
                  onPointerDown={() => canChange && startHold(item)}
                  onPointerUp={endHold}
                  onPointerLeave={endHold}
                  onPointerCancel={endHold}
                >
                  {item.text}
                </span>
                {canChange ? (
                  <>
                    <div class="menu">
                      <button type="button" class="icon-button" aria-label={`More for ${item.text}`} aria-expanded={menu === item.id} onClick={() => setMenu(menu === item.id ? undefined : item.id)} data-action="item-menu">
                        <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20">
                          <circle cx="5" cy="12" r="1.6" fill="currentColor" />
                          <circle cx="12" cy="12" r="1.6" fill="currentColor" />
                          <circle cx="19" cy="12" r="1.6" fill="currentColor" />
                        </svg>
                      </button>
                      {menu === item.id ? (
                        <div class="menu-list" role="menu">
                          <button type="button" role="menuitem" data-action="edit-item" onClick={() => (setMenu(undefined), setEditing({ id: item.id, text: item.text }))}>
                            Edit
                          </button>
                          <button type="button" role="menuitem" class="danger-text" data-action="remove-item" onClick={() => (setMenu(undefined), void apply({ op: "remove", checklist: id, item: item.id }))}>
                            Remove
                          </button>
                        </div>
                      ) : null}
                    </div>
                    <Handle label={`Drag ${item.text} to move it`} id={item.id} pointer={drag.pointer} action="move-item" />
                  </>
                ) : null}
              </li>
            );
          })}
        </ul>
        {checklist.items.length === 0 ? <p class="group-note">No items yet.</p> : null}
      </section>

      {canChange ? (
        <form
          class="group-form"
          data-form="add-item"
          onSubmit={async (event) => {
            event.preventDefault();
            const last = checklist.items.at(-1)?.id;
            const item = crypto.randomUUID();
            const text = adding;
            const change: Change = last === undefined ? { op: "add", checklist: id, item, text } : { op: "add", checklist: id, item, text, after: last };
            // The field clears at once, so the next item can be typed while this one is sent. A
            // refused item's text comes back, unless the traveller has typed another meanwhile.
            setAdding("");
            if (!(await apply(change))) setAdding((now) => (now === "" ? text : now));
          }}
        >
          <Field label="Add item">
            <input name="new-item" value={adding} onInput={(e) => setAdding(e.currentTarget.value)} autocomplete="off" />
          </Field>
          <Button type="submit" disabled={!adding.trim()} data-action="add-item">
            Add
          </Button>
        </form>
      ) : null}

      <Refused message={error} />
      {note ? (
        <p class="group-note" role="status" data-saved>
          {note}
        </p>
      ) : null}

      {canChange ? (
        <div class="actions">
          {save ? (
            <Button kind="plain" onClick={async () => setError(((r) => (r.ok ? undefined : r.refusal.message))(await save()))} data-action="save-template">
              Save as template
            </Button>
          ) : null}
          <Button kind="danger" onClick={() => setDeleting(true)} data-action="delete">
            {screen === "template" ? "Delete template" : "Delete checklist"}
          </Button>
        </div>
      ) : null}

      {deleting ? (
        <Confirm
          title={screen === "template" ? `Delete ${checklist.title}?` : `Delete ${checklist.title}?`}
          message={`${checklist.title} and its ${itemsWords(checklist)} go for good. Nothing restores them.`}
          confirm="Delete"
          onCancel={() => setDeleting(false)}
          onConfirm={async () => {
            setDeleting(false);
            const result = await remove();
            if (!result.ok) setError(result.refusal.message);
          }}
        />
      ) : null}
    </main>
  );
}
