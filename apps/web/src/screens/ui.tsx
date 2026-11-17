// The parts every screen is made of: a screen's title, grouped lists, buttons, fields, and the
// dialog that asks before something goes (docs/spec/web/screens.md §4, WEB:SCREENS-F8).

import type { ComponentChildren, JSX } from "preact";
import { useEffect, useRef } from "preact/hooks";
import { Link } from "./router.tsx";

/** A screen's large title, with a way back where it has one. */
export function Title({ children, back, action }: { children: ComponentChildren; back?: { href: string; label: string }; action?: ComponentChildren }) {
  return (
    <header class="title-bar">
      {back ? (
        <Link class="back" href={back.href}>
          <svg aria-hidden="true" viewBox="0 0 12 20" width="10" height="17">
            <path d="M10 2L2 10l8 8" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          {back.label}
        </Link>
      ) : null}
      <div class="title-row">
        <h1 class="title">{children}</h1>
        {action}
      </div>
    </header>
  );
}

/** A group of rows, with an optional heading and footnote. */
export function Group({ heading, note, children }: { heading?: string; note?: ComponentChildren; children: ComponentChildren }) {
  return (
    <section class="group">
      {heading ? <h2 class="group-heading">{heading}</h2> : null}
      <div class="group-rows">{children}</div>
      {note ? <p class="group-note">{note}</p> : null}
    </section>
  );
}

/** A row of a group, which opens a screen where it has an address. */
export function Row({
  href,
  children,
  detail,
  sub,
  onClick,
}: {
  href?: string;
  children: ComponentChildren;
  detail?: ComponentChildren;
  /** A second line beneath the row's own, such as when a booking starts. */
  sub?: ComponentChildren;
  onClick?: () => void;
}) {
  const body = (
    <>
      <span class="row-main">
        {children}
        {sub !== undefined ? <span class="row-sub">{sub}</span> : null}
      </span>
      {detail !== undefined ? <span class="row-detail">{detail}</span> : null}
      {href || onClick ? (
        <svg class="chevron" aria-hidden="true" viewBox="0 0 8 14" width="7" height="12">
          <path d="M1.5 1.5L6.5 7l-5 5.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      ) : null}
    </>
  );
  if (href) return <Link class="row row-link" href={href}>{body}</Link>;
  if (onClick) return <button type="button" class="row row-link" onClick={onClick}>{body}</button>;
  return <div class="row">{body}</div>;
}

export function Button({
  children,
  kind = "primary",
  ...rest
}: { children: ComponentChildren; kind?: "primary" | "plain" | "danger" } & JSX.IntrinsicElements["button"]) {
  return (
    <button type="button" {...rest} class={`button button-${kind} ${rest.class ?? ""}`}>
      {children}
    </button>
  );
}

/** A labelled field, its label above it, and what went wrong beneath it. */
export function Field({ label, error, children, hint }: { label: string; error?: string | undefined; hint?: string; children: ComponentChildren }) {
  return (
    <label class="field">
      <span class="field-label">{label}</span>
      {children}
      {hint ? <span class="field-hint">{hint}</span> : null}
      {error ? (
        <span class="field-error" role="alert">
          {error}
        </span>
      ) : null}
    </label>
  );
}

export function Empty({ children }: { children: ComponentChildren }) {
  return <p class="empty">{children}</p>;
}

/**
 * Asks before something goes, drawn by the web app rather than the browser's own, with Cancel
 * first (§4, WEB:SCREENS-F8). It closes with Escape or a tap outside, as Cancel.
 */
export function Confirm({
  title,
  message,
  confirm,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: ComponentChildren;
  confirm: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const cancel = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    cancel.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [onCancel]);
  return (
    <div class="scrim" onClick={(event) => event.target === event.currentTarget && onCancel()}>
      <div class="dialog" role="alertdialog" aria-modal="true" aria-labelledby="dialog-title" aria-describedby="dialog-message">
        <h2 id="dialog-title">{title}</h2>
        <p id="dialog-message">{message}</p>
        <div class="dialog-actions">
          <Button kind="plain" ref={cancel} onClick={onCancel} data-dialog="cancel">
            Cancel
          </Button>
          <Button kind="danger" onClick={onConfirm} data-dialog="confirm">
            {confirm}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** A refusal's message, shown where the traveller acted. */
export function Refused({ message }: { message: string | undefined }) {
  if (!message) return null;
  return (
    <p class="refused" role="alert">
      {message}
    </p>
  );
}
