set positional-arguments

# Check every document in the docs/ vault against the documentation system.
check-docs *args:
    cargo run --release --quiet --package doc-check -- "$@"

# Run doc-check's test suite.
test-docs:
    cargo test --package doc-check
