set positional-arguments

# Check every document in the docs/ vault against the documentation system.
check-docs *args:
    @cargo run --release --quiet --package doc-check -- "$@"

# Run the test suites of doc-check and doc-scaffold.
test-docs:
    @cargo test --quiet --package doc-check --package doc-scaffold

# Run the test suite of @itinero/trip-time (docs/spec/shared/trip-time.md §4.12).
test-trip-time:
    @npm test --workspace @itinero/trip-time

# Run the test suite of @itinero/itinerary (docs/spec/planner/itinerary.md §4.8).
test-itinerary:
    @npm test --workspace @itinero/itinerary

# Run the test suite of @itinero/pages (docs/spec/planner/pages.md §4.9).
test-pages:
    @npm test --workspace @itinero/pages

# Run the test suite of @itinero/checklists (docs/spec/planner/checklists.md §4.7).
test-checklists:
    @npm test --workspace @itinero/checklists

# Run the test suite of @itinero/bookings, with its four kinds (docs/spec/bookings/list.md §4.6).
test-bookings:
    @npm test --workspace @itinero/bookings

# Run the test suite of @itinero/permissions (docs/spec/access/permissions.md §4.8).
test-permissions:
    @npm test --workspace @itinero/permissions

# Run the test suite of the online side, in Wrangler (docs/spec/access/accounts.md §4.6).
test-online:
    @npm test --workspace @itinero/online

# Run the test suite of @itinero/web: unit tests, then browser tests in three engines (docs/spec/web/shell.md §4.5).
test-web:
    @npm test --workspace @itinero/web

# Write the skeleton documents and index rows for a new component.
new-component *args:
    @cargo run --release --quiet --package doc-scaffold -- component "$@"

# Write the skeleton documents and index rows a registered component is missing.
new-docs *args:
    @cargo run --release --quiet --package doc-scaffold -- docs "$@"

# Register a new system, and write its roadmap's skeleton.
new-system *args:
    @cargo run --release --quiet --package doc-scaffold -- system "$@"

# Write the skeleton of the next decision record, and its rows in both views of the index.
new-decision *args:
    @cargo run --release --quiet --package doc-scaffold -- decision "$@"

# Write the skeleton of a new guide, and its row in the guides' index.
new-guide *args:
    @cargo run --release --quiet --package doc-scaffold -- guide "$@"

# Install the pre-commit hook, which runs check-docs before every commit.
install-hook:
    @install -m 755 tools/hooks/pre-commit "$(git rev-parse --git-path hooks)/pre-commit"
    @echo "Installed the pre-commit hook. Every commit now runs just check-docs first."
