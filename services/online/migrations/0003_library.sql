-- The records of planner/library (docs/spec/planner/library.md §4.1, §5): each traveller's
-- library, with its sequence, and each template, in the checklists' text form. `ord` holds the
-- template's order, also held in its text, so that a library is placed and caught up without
-- reading any template's text.

CREATE TABLE libraries (
  account TEXT PRIMARY KEY REFERENCES accounts (id),
  sequence INTEGER NOT NULL
);

CREATE TABLE templates (
  account TEXT NOT NULL REFERENCES accounts (id),
  id TEXT NOT NULL,
  changed INTEGER NOT NULL,
  ord TEXT NOT NULL,
  text TEXT NOT NULL,
  PRIMARY KEY (account, id)
);
