-- The records of access/accounts (docs/spec/access/accounts.md §5). Times are milliseconds since
-- 1970, by the online side's own clock. Sessions and nonces are kept only as SHA-256 digests.

CREATE TABLE accounts (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  sub TEXT NOT NULL,
  email TEXT NOT NULL,
  email_verified INTEGER NOT NULL,
  name TEXT NOT NULL,
  named INTEGER NOT NULL,
  made INTEGER NOT NULL,
  UNIQUE (provider, sub)
);

CREATE TABLE sessions (
  digest TEXT PRIMARY KEY,
  account TEXT NOT NULL REFERENCES accounts (id),
  last_used INTEGER NOT NULL
);

CREATE INDEX sessions_by_last_use ON sessions (last_used);

CREATE TABLE nonces (
  digest TEXT PRIMARY KEY,
  made INTEGER NOT NULL
);

CREATE INDEX nonces_by_age ON nonces (made);
