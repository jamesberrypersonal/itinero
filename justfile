set positional-arguments

# Check every document in the docs/ vault against the documentation system.
check-docs *args:
    @cargo run --release --quiet --package doc-check -- "$@"

# Run doc-check's test suite.
test-docs:
    @cargo test --quiet --package doc-check

# Install the pre-commit hook, which runs check-docs before every commit.
install-hook:
    @install -m 755 tools/hooks/pre-commit "$(git rev-parse --git-path hooks)/pre-commit"
    @echo "Installed the pre-commit hook. Every commit now runs just check-docs first."
