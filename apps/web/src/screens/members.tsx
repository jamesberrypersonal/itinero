// The trip's members, by name, with the creator and the admins marked, and for an admin the open
// invitations and each member's access (docs/spec/web/screens.md §4.7, WEB:SCREENS-F6).

import { useMemo, useState } from "preact/hooks";
import { tree, type Branch } from "@itinero/pages";
import { grantChangeToText, pageLevel, type Grant, type GrantChange, type Level, type TripLevel } from "@itinero/permissions";
import * as store from "../store/index.ts";
import type { Copy, Member as MemberRecord } from "../store/index.ts";
import { go } from "./router.tsx";
import { useCanChange, useStyle } from "./state.ts";
import { TripMenu } from "./trip.tsx";
import { Button, Confirm, Field, Group, Refused, Row, Title } from "./ui.tsx";
import { dateWords } from "./words.ts";

const tripPath = (id: string, rest = "") => `/trips/${encodeURIComponent(id)}${rest}`;
const memberPath = (copy: Copy, account: string) => tripPath(copy.id, `/members/${encodeURIComponent(account)}`);

const TRIP_WORDS: Record<TripLevel, string> = { view: "Can view", edit: "Can edit" };
const LEVEL_WORDS: Record<Level, string> = { none: "No access", view: "Can view", edit: "Can edit" };

const role = (member: MemberRecord) => (member.creator ? "Creator" : member.admin ? "Admin" : undefined);

/** A grant change, sent to the trip (§4.7). */
async function grant(copy: Copy, change: GrantChange): Promise<string | undefined> {
  const result = await store.send(copy.id, "grants", grantChangeToText(change));
  return result.ok ? undefined : result.refusal.message;
}

/** A choice of one of a few values, drawn as a segmented control. */
function Segmented<T extends string>({ label, value, options, onChange, name }: { label: string; value: T; options: readonly { value: T; words: string }[]; onChange: (value: T) => void; name: string }) {
  return (
    <div class="segmented" role="radiogroup" aria-label={label} data-choice={name}>
      {options.map((option) => (
        <button key={option.value} type="button" role="radio" aria-checked={value === option.value} data-value={option.value} onClick={() => value !== option.value && onChange(option.value)}>
          {option.words}
        </button>
      ))}
    </div>
  );
}

const TRIP_OPTIONS = [
  { value: "view" as const, words: "View" },
  { value: "edit" as const, words: "Edit" },
];
const LEVEL_OPTIONS = [
  { value: "none" as const, words: "None" },
  { value: "view" as const, words: "View" },
  { value: "edit" as const, words: "Edit" },
];

/** Inviting an address, with view or edit access to the trip and a level for the calendar (ACC-F3). */
function Invite({ copy }: { copy: Copy }) {
  const [email, setEmail] = useState("");
  const [level, setLevel] = useState<TripLevel>("edit");
  const [calendar, setCalendar] = useState<Level>("none");
  const [error, setError] = useState<string>();
  const [sending, setSending] = useState(false);
  return (
    <form
      class="group-form"
      data-form="invite"
      onSubmit={async (event) => {
        event.preventDefault();
        setSending(true);
        const result = await store.invite(copy.id, email.trim(), level, calendar);
        setSending(false);
        if (!result.ok) return setError(result.refusal.message);
        setError(undefined);
        setEmail("");
      }}
    >
      <h2 class="group-heading">Invite a traveller</h2>
      <Field label="Email address">
        <input type="email" name="email" inputMode="email" autocomplete="off" autocapitalize="none" value={email} onInput={(e) => setEmail(e.currentTarget.value)} required />
      </Field>
      <div class="row segmented-row">
        <span>The trip</span>
        <Segmented label="Access to the trip" name="invite-trip" value={level} options={TRIP_OPTIONS} onChange={setLevel} />
      </div>
      <div class="row segmented-row">
        <span>The calendar</span>
        <Segmented label="Access to the calendar" name="invite-calendar" value={calendar} options={LEVEL_OPTIONS} onChange={setCalendar} />
      </div>
      <Refused message={error} />
      <Button type="submit" disabled={sending || !email.trim()} data-action="invite">
        Send the invitation
      </Button>
    </form>
  );
}

/** The members screen (§4.7). */
export function Members({ copy, account }: { copy: Copy; account: string }) {
  const canChange = useCanChange();
  const style = useStyle();
  const [withdrawing, setWithdrawing] = useState<string>();
  const [error, setError] = useState<string>();
  const members = copy.members.filter((m) => !m.removed);
  const admin = copy.you.admin;
  const invitations = admin ? (copy.invitations ?? []) : [];
  return (
    <main class="screen" data-screen="members">
      <Title action={<TripMenu id={copy.id} />}>Members</Title>
      <Group note={admin ? "Open a member to set what they may see and change." : undefined}>
        {members.map((member) => {
          const held = admin ? copy.grants?.grants.find((g) => g.traveller === member.account) : undefined;
          const body = (
            <span data-member={member.account}>
              {member.name}
              {member.account === account ? <span class="you"> (you)</span> : null}
            </span>
          );
          const detail = role(member) ?? (held ? TRIP_WORDS[held.trip] : undefined);
          return admin ? (
            <Row key={member.account} href={memberPath(copy, member.account)} detail={detail}>
              {body}
            </Row>
          ) : (
            <Row key={member.account} detail={detail}>
              {body}
            </Row>
          );
        })}
      </Group>
      {admin ? (
        <Group heading="Invitations">
          {invitations.length === 0 ? <Row>No open invitations</Row> : null}
          {invitations.map((invitation) => (
            <div class="row" key={invitation.id} data-invitation={invitation.email}>
              <span class="row-main">
                {invitation.email}
                <span class="row-sub">
                  {TRIP_WORDS[invitation.trip]} · calendar: {LEVEL_WORDS[invitation.calendar].toLowerCase()} · until {dateWords(invitation.expires.slice(0, 10), style)}
                </span>
              </span>
              {canChange ? (
                <Button kind="plain" class="danger-text" onClick={() => setWithdrawing(invitation.id)} data-action="withdraw-invitation">
                  Withdraw
                </Button>
              ) : null}
            </div>
          ))}
        </Group>
      ) : null}
      <Refused message={error} />
      {admin && canChange ? <Invite copy={copy} /> : null}
      {withdrawing ? (
        <Confirm
          title="Withdraw the invitation?"
          message={`The invitation to ${invitations.find((i) => i.id === withdrawing)?.email ?? "this address"} will no longer let anyone join the trip.`}
          confirm="Withdraw"
          onCancel={() => setWithdrawing(undefined)}
          onConfirm={async () => {
            const id = withdrawing;
            setWithdrawing(undefined);
            const result = await store.withdraw(copy.id, id);
            setError(result.ok ? undefined : result.refusal.message);
          }}
        />
      ) : null}
    </main>
  );
}

/** The pages in the tree's order, each with how deep it lies. */
function flatten(branches: readonly Branch[], depth = 0, parent?: string, into: { id: string; title: string; depth: number; parent?: string }[] = []) {
  for (const { page, under } of branches) {
    into.push({ id: page.id, title: page.title, depth, ...(parent ? { parent } : {}) });
    flatten(under, depth + 1, page.id, into);
  }
  return into;
}

/** One member, for an admin: their access to the trip, the calendar and each branch of pages, and making them an admin or removing them (ACC-F5, ACC-F7, ACC-F11). */
export function Member({ copy, account, id }: { copy: Copy; account: string; id: string }) {
  const canChange = useCanChange();
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string>();
  const pages = useMemo(() => flatten(tree(copy.pages)), [copy]);
  const member = copy.members.find((m) => m.account === id && !m.removed);
  const held: Grant | undefined = copy.grants?.grants.find((g) => g.traveller === id);
  const back = { href: tripPath(copy.id, "/members"), label: "Members" };
  if (!copy.you.admin || !member || !held || !copy.grants) {
    return (
      <main class="screen narrow" data-screen="member">
        <Title back={back}>Member not available</Title>
        <p class="lead">Only an admin sees a member's access, and this traveller may have left the trip.</p>
      </main>
    );
  }
  const grants = copy.grants;
  const exceptions = new Map(held.pages.map((e) => [e.page, e.level]));
  const run = async (change: GrantChange) => setError(await grant(copy, change));

  return (
    <main class="screen" data-screen="member">
      <Title back={back}>{member.name}</Title>
      {role(member) ? <p class="lead">{role(member)}. An admin sees and changes the whole trip, whatever is set here.</p> : null}
      <Group heading="Access">
        <div class="row segmented-row">
          <span>The trip</span>
          {canChange ? (
            <Segmented label="Access to the trip" name="trip" value={held.trip} options={TRIP_OPTIONS} onChange={(level) => run({ op: "trip", traveller: id, level })} />
          ) : (
            <span class="row-detail">{TRIP_WORDS[held.trip]}</span>
          )}
        </div>
        <div class="row segmented-row">
          <span>The calendar</span>
          {canChange ? (
            <Segmented label="Access to the calendar" name="calendar" value={held.calendar} options={LEVEL_OPTIONS} onChange={(level) => run({ op: "calendar", traveller: id, level })} />
          ) : (
            <span class="row-detail">{LEVEL_WORDS[held.calendar]}</span>
          )}
        </div>
      </Group>
      <Group heading="Pages" note="A page's level covers the branch beneath it, unless a page lower down has a level of its own.">
        {pages.length === 0 ? <Row>No pages yet</Row> : null}
        {pages.map((page) => {
          const own = exceptions.get(page.id);
          const level = pageLevel(grants, { traveller: id, admin: false }, copy.pages, page.id);
          // The level the page takes from the page above it, or from the trip at the top of the tree.
          const above: Level = page.parent ? pageLevel(grants, { traveller: id, admin: false }, copy.pages, page.parent) : held.trip;
          return (
            <div class="row" key={page.id} data-access-page={page.id}>
              <span class="row-main" style={{ paddingLeft: `${page.depth}rem` }}>
                {page.title}
              </span>
              {canChange ? (
                <select
                  aria-label={`${member.name}'s access to ${page.title}`}
                  name={`page-${page.id}`}
                  value={own ?? ""}
                  onChange={(e) => {
                    const value = e.currentTarget.value;
                    void run(value === "" ? { op: "unpage", traveller: id, page: page.id } : { op: "page", traveller: id, page: page.id, level: value as Level });
                  }}
                >
                  <option value="">{`As above (${LEVEL_WORDS[above].toLowerCase()})`}</option>
                  <option value="none">No access</option>
                  <option value="view">Can view</option>
                  <option value="edit">Can edit</option>
                </select>
              ) : (
                <span class="row-detail">{LEVEL_WORDS[level]}</span>
              )}
            </div>
          );
        })}
      </Group>
      <Refused message={error} />
      {canChange ? (
        <div class="actions">
          {!member.admin ? (
            <Button kind="plain" onClick={async () => {
              const result = await store.makeAdmin(copy.id, id);
              setError(result.ok ? undefined : result.refusal.message);
            }} data-action="make-admin">
              Make an admin
            </Button>
          ) : null}
          {!member.creator && id !== account ? (
            <Button kind="plain" class="danger-text" onClick={() => setAsking(true)} data-action="remove-member">
              Remove from the trip
            </Button>
          ) : null}
        </div>
      ) : null}
      {asking ? (
        <Confirm
          title={`Remove ${member.name}?`}
          message={`${member.name} will be removed from the trip, and will no longer see any of it.`}
          confirm="Remove"
          onCancel={() => setAsking(false)}
          onConfirm={async () => {
            setAsking(false);
            const result = await store.remove(copy.id, id);
            if (!result.ok) return setError(result.refusal.message);
            go(tripPath(copy.id, "/members"), true);
          }}
        />
      ) : null}
    </main>
  );
}
