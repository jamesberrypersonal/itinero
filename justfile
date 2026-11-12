set positional-arguments

# Check every document in the docs/ vault against the documentation system.
check-docs *args:
    @cargo run --release --quiet --package doc-check -- "$@"

# Run the test suites of doc-check and doc-scaffold.
test-docs:
    @cargo test --quiet --package doc-check --package doc-scaffold

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
