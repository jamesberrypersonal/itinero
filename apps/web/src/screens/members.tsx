// The trip's members, by name, with the creator and the admins marked (docs/spec/web/screens.md
// §4.7). Managing them, for an admin, is built in Milestone Web-1.5.

import type { Copy } from "../store/index.ts";
import { TripMenu } from "./trip.tsx";
import { Group, Row, Title } from "./ui.tsx";

export function Members({ copy, account }: { copy: Copy; account: string }) {
  const members = copy.members.filter((m) => !m.removed);
  return (
    <main class="screen" data-screen="members">
      <Title action={<TripMenu id={copy.id} />}>Members</Title>
      <Group>
        {members.map((member) => (
          <Row key={member.account} detail={member.creator ? "Creator" : member.admin ? "Admin" : undefined}>
            <span data-member={member.account}>
              {member.name}
              {member.account === account ? <span class="you"> (you)</span> : null}
            </span>
          </Row>
        ))}
      </Group>
    </main>
  );
}
