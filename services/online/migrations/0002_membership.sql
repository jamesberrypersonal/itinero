-- The records of access/membership (docs/spec/access/membership.md §5). Times are milliseconds
-- since 1970, by the online side's own clock. An invitation's token is kept only as its digest.

CREATE TABLE members (
  trip TEXT NOT NULL,
  account TEXT NOT NULL REFERENCES accounts (id),
  admin INTEGER NOT NULL,
  creator INTEGER NOT NULL,
  joined INTEGER NOT NULL,
  removed INTEGER,
  PRIMARY KEY (trip, account)
);

-- A trip has exactly one creator.
CREATE UNIQUE INDEX members_one_creator ON members (trip) WHERE creator = 1;
CREATE INDEX members_by_account ON members (account);

CREATE TABLE invitations (
  id TEXT PRIMARY KEY,
  trip TEXT NOT NULL,
  email TEXT NOT NULL,
  trip_level TEXT NOT NULL CHECK (trip_level IN ('view', 'edit')),
  calendar TEXT NOT NULL CHECK (calendar IN ('none', 'view', 'edit')),
  sent_by TEXT NOT NULL REFERENCES accounts (id),
  token_digest TEXT NOT NULL,
  expires INTEGER NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('open', 'withdrawn', 'replaced', 'expired', 'accepted')),
  closed INTEGER,
  accepted_by TEXT
);

-- At most one open invitation to an address, on a trip: a second one replaces the first.
CREATE UNIQUE INDEX invitations_one_open ON invitations (trip, email) WHERE state = 'open';
CREATE INDEX invitations_by_state ON invitations (state, expires);
