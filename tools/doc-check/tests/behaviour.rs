//! doc-check's behaviour across rules: what it reads, how a run ends, the summary, and the
//! quality attributes (`docs/spec/shared/doc-check.md` §3.1, §4.2, §4.4 to §4.6, and §6).

mod common;

use common::{REGISTRY, run, temp_dir, write};
use std::fs;
use std::time::{Duration, Instant};

/// A vault holding one broken link in `a.md`.
fn broken() -> std::path::PathBuf {
    let root = temp_dir("broken");
    write(
        &root,
        &[
            ("docs/components.md", REGISTRY),
            ("docs/a.md", "# A\n\nA missing [c](c.md).\n"),
        ],
    );
    root
}

fn clean() -> std::path::PathBuf {
    let root = temp_dir("clean");
    write(&root, &[("docs/components.md", REGISTRY)]);
    root
}

// SHR:DOC-CHECK-F1: every document in the vault, and nothing outside it.

#[test]
fn checks_documents_at_every_depth_and_nothing_outside_the_vault() {
    let root = clean();
    let bad = "# X\n\nA missing [c](c.md).\n";
    write(
        &root,
        &[
            ("docs/a.md", bad),
            ("docs/one/README.md", bad),
            ("docs/one/two/three/deep.md", bad),
            ("README.md", bad),
            ("packages/thing/docs/x.md", bad),
            ("docs/notes-draft.md", bad),
            ("docs/graveyard/old.md", bad),
            ("docs/one/graveyard/older/old.md", bad),
            ("docs/.obsidian/state.md", bad),
        ],
    );
    let out = run(&root, &[]).stdout;
    for reported in [
        "docs/a.md:3: links",
        "docs/one/README.md:3: links",
        "docs/one/two/three/deep.md:3: links",
    ] {
        assert!(out.contains(reported), "{reported} not reported in:\n{out}");
    }
    for skipped in [
        "packages/",
        "draft",
        "graveyard",
        ".obsidian",
        "\nREADME.md",
    ] {
        assert!(!out.contains(skipped), "{skipped} reported in:\n{out}");
    }
}

#[test]
fn a_link_broken_by_a_rename_is_reported_in_the_document_holding_it() {
    let root = clean();
    write(
        &root,
        &[
            ("docs/a.md", "# A\n\nSee [b](b.md).\n"),
            ("docs/b.md", "# B\n"),
        ],
    );
    assert_eq!(run(&root, &[]).status, 0);
    fs::rename(root.join("docs/b.md"), root.join("docs/c.md")).unwrap();
    let out = run(&root, &[]);
    assert_eq!(out.status, 1);
    assert!(
        out.stdout.starts_with("docs/a.md:3: links:"),
        "{}",
        out.stdout
    );
}

// SHR:DOC-CHECK-F2: clean, findings and could not run are told apart.

#[test]
fn a_clean_vault_exits_zero_and_prints_no_finding() {
    let out = run(&clean(), &[]);
    assert_eq!((out.status, out.stdout.as_str()), (0, "doc-check: clean\n"));
}

#[test]
fn a_vault_with_findings_exits_one() {
    let out = run(&broken(), &[]);
    assert_eq!(out.status, 1);
    assert!(
        out.stdout.ends_with("doc-check: 1 finding in 1 file\n"),
        "{}",
        out.stdout
    );
}

#[test]
fn a_run_that_cannot_check_the_vault_exits_two_and_says_why() {
    let no_vault = temp_dir("no-vault");
    let no_registry = temp_dir("no-registry");
    write(&no_registry, &[("docs/a.md", "# A\n")]);
    let not_utf8 = clean();
    fs::write(not_utf8.join("docs/bad.md"), [0xff, 0xfe, b'\n']).unwrap();
    for (root, why) in [
        (&no_vault, "no docs/ directory"),
        (&no_registry, "components.md is missing"),
        (&not_utf8, "not valid UTF-8"),
    ] {
        let out = run(root, &[]);
        assert_eq!(out.status, 2, "{why}");
        assert!(
            out.stderr.contains("could not run") && out.stderr.contains(why),
            "{why}: {}",
            out.stderr
        );
        assert!(out.stdout.is_empty(), "{why}: printed partial findings");
    }
}

#[test]
fn unknown_options_and_missing_values_cannot_run() {
    for args in [&["--quiet"][..], &["--summary"][..]] {
        assert_eq!(run(&clean(), args).status, 2, "{args:?}");
    }
}

#[cfg(unix)]
#[test]
fn a_symbolic_link_out_of_the_vault_cannot_run() {
    let root = clean();
    let outside = temp_dir("outside");
    write(&outside, &[("x.md", "# X\n")]);
    std::os::unix::fs::symlink(outside.join("x.md"), root.join("docs/x.md")).unwrap();
    let out = run(&root, &[]);
    assert_eq!(out.status, 2);
    assert!(
        out.stderr.contains("points outside the vault"),
        "{}",
        out.stderr
    );
}

// SHR:DOC-CHECK-F3: each finding says where, which rule, what was found and what would pass.

#[test]
fn a_finding_names_its_place_rule_text_passing_form_and_heading() {
    let root = clean();
    write(
        &root,
        &[
            ("docs/a.md", "# A\n\nAn absolute [b](/b.md).\n"),
            ("docs/b.md", "# B\n"),
        ],
    );
    let out = run(&root, &[]).stdout;
    assert_eq!(
        out.lines().next().unwrap(),
        "docs/a.md:3: links: link target /b.md is absolute. Link to b.md. (documentation-system.md, \"Markdown rules\")"
    );
}

// SHR:DOC-CHECK-F12: the summary a pull request shows.

#[test]
fn the_summary_lists_every_finding() {
    let root = clean();
    let many: String = (1..=30)
        .map(|i| format!("Missing [x{i}](x{i}.md).\n\n"))
        .collect();
    write(
        &root,
        &[
            ("docs/a.md", &format!("# A\n\n{many}")),
            ("docs/b.md", &format!("# B\n\n{many}")),
        ],
    );
    let summary = root.join("summary.md");
    let out = run(&root, &["--summary", summary.to_str().unwrap()]);
    assert_eq!(out.status, 1);
    let text = fs::read_to_string(&summary).unwrap();
    assert!(
        text.starts_with("## Documentation check\n\n60 findings in 2 files.\n"),
        "{text}"
    );
    assert_eq!(
        text.lines().filter(|l| l.starts_with("| `docs/")).count(),
        60
    );
}

#[test]
fn the_summary_says_when_the_vault_is_clean_or_could_not_be_checked() {
    let root = clean();
    let summary = root.join("summary.md");
    run(&root, &["--summary", summary.to_str().unwrap()]);
    assert_eq!(
        fs::read_to_string(&summary).unwrap(),
        "## Documentation check\n\nThe vault is clean.\n"
    );

    let empty = temp_dir("empty");
    let summary = empty.join("summary.md");
    assert_eq!(
        run(&empty, &["--summary", summary.to_str().unwrap()]).status,
        2
    );
    assert!(
        fs::read_to_string(&summary)
            .unwrap()
            .contains("The vault could not be checked:")
    );
}

#[test]
fn a_summary_that_cannot_be_written_cannot_run() {
    let root = clean();
    let out = run(
        &root,
        &[
            "--summary",
            root.join("missing/dir/summary.md").to_str().unwrap(),
        ],
    );
    assert_eq!(out.status, 2);
}

// SHR:DOC-CHECK-F14: nothing but a fenced code block keeps a finding from being reported.

#[test]
fn only_a_fenced_code_block_silences_a_finding() {
    let root = clean();
    let doc = "# A\n\n```\n[c](c.md)\n```\n\n````\n```\n[c](c.md)\n```\n````\n\n[c](c.md) <!-- doc-check: ignore -->\n";
    write(&root, &[("docs/a.md", doc)]);
    let out = run(&root, &[]).stdout;
    assert!(
        !out.contains("docs/a.md:4:") && !out.contains("docs/a.md:9:"),
        "{out}"
    );
    assert!(out.contains("docs/a.md:13: links:"), "{out}");
    assert!(out.contains("docs/a.md:13: raw-html:"), "{out}");
}

// SHR:DOC-CHECK-NFR2: the same vault always gives the same findings, in the same order.

#[test]
fn the_same_vault_gives_the_same_output_however_it_was_written() {
    let root = clean();
    write(
        &root,
        &[
            ("docs/b.md", "# B\n\n[x](x.md) and [[y]].\n"),
            ("docs/a.md", "# A\n\n> [!INFO]\n> x\n"),
            ("docs/sub/README.md", "# Sub\n\n[z](z.md)\n"),
        ],
    );
    let first = run(&root, &[]);
    assert_eq!(first.stdout, run(&root, &[]).stdout);
    let reversed = temp_dir("reversed");
    common::copy_dir(&root, &reversed, true);
    assert_eq!(first.stdout, run(&reversed, &[]).stdout);
}

// SHR:DOC-CHECK-NFR3: doc-check never changes a file.

#[test]
fn a_run_changes_no_file_and_adds_none() {
    let cases = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/rules");
    let root = temp_dir("read-only");
    for rule in fs::read_dir(&cases).unwrap() {
        let breaks = rule.unwrap().path().join("breaks/docs");
        common::copy_dir(&breaks, &root.join("docs"), false);
    }
    let before = common::snapshot(&root);
    assert_ne!(run(&root, &[]).status, 2);
    assert_eq!(before, common::snapshot(&root));
}

// SHR:DOC-CHECK-NFR1: a whole-vault run of 1,000 documents finishes within two seconds on the
// reference laptop. Run with `cargo test --release --package doc-check -- --ignored`.

#[test]
#[ignore]
fn a_vault_of_a_thousand_documents_is_checked_within_two_seconds() {
    let root = clean();
    let mut index = String::from("# Notes\n\n| Note | About |\n|---|---|\n");
    for i in 0..999 {
        let next = (i + 1) % 999;
        let doc = format!(
            "# Note {i}\n\n## 1. Purpose\n\nNote {i} links to [note {next}](note-{next}.md#^n{next}) and cites §2.1. ^n{i}\n\n\
             ## 2. Detail\n\n### 2.1 More\n\nA `code span`, **bold text**, and > [!NOTE] nothing.\n\n\
             | Column | Value |\n|---|---|\n| one | [back](README.md) |\n\n> [!TIP]\n> A tip.\n"
        );
        write(&root, &[(&format!("docs/notes/note-{i}.md"), &doc)]);
        index.push_str(&format!("| [note-{i}](note-{i}.md) | Note {i} |\n"));
    }
    write(
        &root,
        &[
            ("docs/notes/README.md", &index),
            ("docs/README.md", "# Vault\n\n- [notes](notes/README.md)\n"),
        ],
    );
    assert_eq!(
        run(&root, &[]).stdout,
        "doc-check: clean\n",
        "the generated vault must be clean"
    );
    for _ in 0..5 {
        let start = Instant::now();
        run(&root, &[]);
        let took = start.elapsed();
        assert!(took < Duration::from_secs(2), "a run took {took:?}");
    }
}
