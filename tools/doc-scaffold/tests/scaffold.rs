//! doc-scaffold's behaviour, run against copies of this repository's own vault and against a small
//! vault built here (`docs/spec/shared/doc-scaffold.md` §4.8). Each test runs doc-check over the
//! result, through its library, so what doc-scaffold writes is held to the vault's rules.

use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::atomic::{AtomicUsize, Ordering};

static NEXT: AtomicUsize = AtomicUsize::new(0);

fn temp_dir(tag: &str) -> PathBuf {
    let n = NEXT.fetch_add(1, Ordering::SeqCst);
    let dir = std::env::temp_dir().join(format!("doc-scaffold-{tag}-{}-{n}", std::process::id()));
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(&dir).unwrap();
    dir
}

fn copy_dir(from: &Path, to: &Path) {
    fs::create_dir_all(to).unwrap();
    for entry in fs::read_dir(from).unwrap() {
        let entry = entry.unwrap();
        let dest = to.join(entry.file_name());
        if entry.file_type().unwrap().is_dir() {
            copy_dir(&entry.path(), &dest);
        } else {
            fs::copy(entry.path(), dest).unwrap();
        }
    }
}

/// A copy of this repository's vault, in a fresh root.
fn real_vault() -> PathBuf {
    let root = temp_dir("real");
    let docs = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../docs");
    copy_dir(&docs, &root.join("docs"));
    let _ = fs::remove_dir_all(root.join("docs/.obsidian"));
    root
}

/// The smallest vault with every index doc-scaffold edits, and one concern, numbered at §5.1.
fn small_vault() -> PathBuf {
    let root = temp_dir("small");
    let files: &[(&str, &str)] = &[
        (
            "docs/README.md",
            "# Docs\n\n| Folder | Answers |\n|---|---|\n| [requirements/](requirements/README.md) | What |\n| [spec/](spec/README.md) | How |\n| [decisions/](decisions/README.md) | Why |\n| [guides/](guides/README.md) | Steps |\n| [roadmap/](roadmap/README.md) | When |\n",
        ),
        (
            "docs/components.md",
            "# Components\n\n## Systems\n\n| System | Prefix | Outside the vault | Is |\n|---|---|---|---|\n| trips | TRP | | The trips |\n\n## Components\n\n| Component | System | Prefix | Packages | Outside the vault | Is |\n|---|---|---|---|---|---|\n\n## Booking kinds\n\n| Kind | Prefix | Imported | Manual | In `@itinero/bookings` | Is |\n|---|---|---|---|---|---|\n\n## Cross-cutting concerns\n\n| Concern | Prefix | Covered in each specification at | Is |\n|---|---|---|---|\n| personal-data | PII | `§5.1` | Personal details |\n",
        ),
        (
            "docs/TODO.md",
            "# The live work list\n\n*Next free:* TODO-1\n\n## Tags\n\n| Tag | Means |\n|---|---|\n| concerns/personal-data | Personal details |\n| trips | The trips |\n| docs | The documents |\n\n## Items\n",
        ),
        (
            "docs/requirements/README.md",
            "# Requirements\n\n## Folders\n\n| Folder | Its documents promise about |\n|---|---|\n",
        ),
        (
            "docs/spec/README.md",
            "# Specifications\n\n| Folder | Its documents specify |\n|---|---|\n",
        ),
        (
            "docs/decisions/README.md",
            "# Decision records\n\n## Ledger\n\n| ADR | Title | Scope | Status |\n|---|---|---|---|\n\n## By subject\n",
        ),
        ("docs/guides/README.md", "# Guides\n"),
        (
            "docs/roadmap/README.md",
            "# Roadmaps\n\n| Roadmap | Plans | Kept by |\n|---|---|---|\n",
        ),
    ];
    for (rel, text) in files {
        let path = root.join(rel);
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, text).unwrap();
    }
    root
}

struct Run {
    status: i32,
    stdout: String,
    stderr: String,
}

fn scaffold(root: &Path, args: &[&str]) -> Run {
    let out = Command::new(env!("CARGO_BIN_EXE_doc-scaffold"))
        .arg("--root")
        .arg(root)
        .args(args)
        .output()
        .expect("doc-scaffold runs");
    Run {
        status: out.status.code().unwrap_or(-1),
        stdout: String::from_utf8(out.stdout).unwrap(),
        stderr: String::from_utf8(out.stderr).unwrap(),
    }
}

/// doc-check's findings, rendered one per line.
fn findings(root: &Path) -> Vec<String> {
    doc_check::check(root)
        .expect("doc-check runs")
        .iter()
        .map(|f| f.render())
        .collect()
}

/// Every file under `dir` with its contents, in path order.
fn snapshot(dir: &Path) -> Vec<(PathBuf, String)> {
    let mut out = Vec::new();
    let mut stack = vec![dir.to_path_buf()];
    while let Some(d) = stack.pop() {
        for entry in fs::read_dir(&d).unwrap() {
            let entry = entry.unwrap();
            if entry.file_type().unwrap().is_dir() {
                stack.push(entry.path());
            } else {
                out.push((entry.path(), fs::read_to_string(entry.path()).unwrap()));
            }
        }
    }
    out.sort();
    out
}

/// A registry row with its first cell's link taken out, so a row whose slug was linked to its
/// new specification compares equal to the row before.
fn unlinked(line: &str) -> String {
    let Some(rest) = line.strip_prefix("| [") else {
        return line.to_string();
    };
    match (rest.find("]("), rest.find(") |")) {
        (Some(a), Some(b)) if a < b => format!("| {}{}", &rest[..a], &rest[b + 1..]),
        _ => line.to_string(),
    }
}

/// Runs a command that must succeed, and confirms it changes no line, apart from linking a
/// registered component's slug to its new specification.
fn scaffold_keeping_lines(root: &Path, args: &[&str]) -> Run {
    let files_before = snapshot(root);
    let run = scaffold(root, args);
    assert_eq!(run.status, 0, "{args:?} failed:\n{}", run.stderr);
    // SHR:DOC-SCAFFOLD-F4: every line of every existing file is still there, in order.
    for (path, old) in files_before {
        let new = fs::read_to_string(&path).unwrap();
        let registry = path.ends_with("docs/components.md");
        let same = |a: &str, b: &str| a == b || (registry && unlinked(a) == unlinked(b));
        let mut new_lines = new.lines();
        for line in old.lines() {
            assert!(
                new_lines.any(|n| same(n, line)),
                "{} lost or changed the line {line:?}",
                path.display()
            );
        }
    }
    run
}

/// Runs a command that must succeed, and confirms it adds no finding and changes no line.
fn scaffold_cleanly(root: &Path, args: &[&str]) -> String {
    let before = findings(root);
    let run = scaffold_keeping_lines(root, args);
    let after = findings(root);
    assert_eq!(after, before, "{args:?} changed what doc-check finds");
    run.stdout
}

/// The number the next decision record takes: one past the highest on disk.
fn next_record(root: &Path) -> String {
    let highest = fs::read_dir(root.join("docs/decisions"))
        .unwrap()
        .filter_map(|e| {
            e.unwrap()
                .file_name()
                .to_str()?
                .get(..4)?
                .parse::<u32>()
                .ok()
        })
        .max()
        .unwrap_or(0);
    format!("{:04}", highest + 1)
}

fn read(root: &Path, rel: &str) -> String {
    fs::read_to_string(root.join("docs").join(rel)).unwrap()
}

// SHR:DOC-SCAFFOLD-F1 and F2: each command writes what doc-check passes.

#[test]
fn a_shared_component_joins_the_registry_the_tags_and_both_indexes() {
    let root = real_vault();
    assert!(
        findings(&root).is_empty(),
        "this repository's vault has findings"
    );
    let out = scaffold_cleanly(
        &root,
        &[
            "component",
            "shared",
            "money",
            "SHR:MONEY",
            "Amounts of money in a currency",
        ],
    );
    for line in [
        "created docs/requirements/shared/money.md",
        "created docs/spec/shared/money.md",
        "changed docs/TODO.md",
        "changed docs/components.md",
        "changed docs/requirements/shared/README.md",
        "changed docs/spec/shared/README.md",
    ] {
        assert!(out.contains(line), "{line} missing from:\n{out}");
    }
    let reg = read(&root, "components.md");
    let at = |s: &str| reg.find(s).unwrap();
    assert!(at("| [doc-check]") < at("| [money](spec/shared/money.md)"));
    assert!(at("| [money]") < at("| [trip-time]"));
    let todo = read(&root, "TODO.md");
    assert!(todo.find("| shared/doc-check |") < todo.find("| shared/money |"));
    assert!(todo.find("| shared/money |") < todo.find("| shared/trip-time |"));
}

#[test]
fn a_component_of_a_system_with_no_folder_gets_its_folders_and_their_indexes() {
    let root = real_vault();
    scaffold_cleanly(
        &root,
        &[
            "component",
            "web",
            "offline-copy",
            "WEB:OFFLINE",
            "The copy of a trip a phone keeps",
        ],
    );
    let req = read(&root, "requirements/README.md");
    assert!(req.find("| [web/](web/README.md)") < req.find("| [shared/]"));
    assert!(read(&root, "spec/web/README.md").contains("| [offline-copy.md](offline-copy.md) |"));
    let reg = read(&root, "components.md");
    assert!(reg.find("| [pages]") < reg.find("| [offline-copy]"));
    assert!(reg.find("| [offline-copy]") < reg.find("| [doc-check]"));
}

#[test]
fn a_registered_component_gets_both_its_documents_and_a_linked_registry_row() {
    let root = real_vault();
    let out = scaffold_cleanly(&root, &["docs", "planner", "itinerary"]);
    for line in [
        "created docs/requirements/planner/itinerary.md",
        "created docs/spec/planner/itinerary.md",
        "created docs/requirements/planner/README.md",
        "created docs/spec/planner/README.md",
        "changed docs/components.md",
        "changed docs/requirements/README.md",
        "changed docs/spec/README.md",
    ] {
        assert!(out.contains(line), "{line} missing from:\n{out}");
    }
    // The address already has its tag, so the live list is left alone.
    assert!(!out.contains("docs/TODO.md"), "{out}");
    let reg = read(&root, "components.md");
    assert!(
        reg.contains("| [itinerary](spec/planner/itinerary.md) | planner | PLN:ITINERARY | | | ")
    );
    assert!(read(&root, "requirements/planner/itinerary.md").contains("### PLN:ITINERARY-F1 — "));
    assert!(read(&root, "spec/planner/README.md").contains("| [itinerary.md](itinerary.md) | "));
}

#[test]
fn a_registered_component_with_one_document_gets_the_other() {
    let root = real_vault();
    fs::remove_file(root.join("docs/spec/shared/trip-time.md")).unwrap();
    let before = findings(&root);
    assert!(
        !before.is_empty(),
        "removing a specification leaves findings"
    );
    let out = scaffold_keeping_lines(&root, &["docs", "shared", "trip-time"]).stdout;
    assert!(
        out.contains("created docs/spec/shared/trip-time.md"),
        "{out}"
    );
    assert!(!out.contains("requirements/shared/trip-time.md"), "{out}");
    // The index row and the registry link are already there, so neither file changes.
    assert!(!out.contains("docs/spec/shared/README.md"), "{out}");
    assert!(!out.contains("docs/components.md"), "{out}");
    // SHR:DOC-SCAFFOLD-F2: on a vault with findings, the command adds none.
    let after = findings(&root);
    let added: Vec<_> = after.iter().filter(|f| !before.contains(f)).collect();
    assert!(added.is_empty(), "new findings: {added:#?}");
    assert!(
        after.len() < before.len(),
        "the new specification claims F1"
    );
}

#[test]
fn a_document_without_f1_is_not_given_a_skeleton_beside_it() {
    let root = real_vault();
    fs::remove_file(root.join("docs/spec/shared/trip-time.md")).unwrap();
    let req = root.join("docs/requirements/shared/trip-time.md");
    let text = fs::read_to_string(&req)
        .unwrap()
        .replace("^shr-trip-time-f1", "");
    fs::write(&req, text).unwrap();
    let before = snapshot(&root);
    let run = scaffold(&root, &["docs", "shared", "trip-time"]);
    assert_eq!(run.status, 1);
    assert!(
        run.stderr.contains("holds no SHR:TRIP-TIME-F1"),
        "{}",
        run.stderr
    );
    assert!(snapshot(&root) == before);
}

#[test]
fn a_new_system_takes_components_decisions_and_guides() {
    let root = real_vault();
    scaffold_cleanly(
        &root,
        &[
            "system",
            "bookings",
            "BKG",
            "Bookings, and the trips they belong to",
            "A Keeper",
        ],
    );
    assert!(read(&root, "roadmap/bookings.md").contains("Milestone Bookings-0.1"));
    assert!(read(&root, "roadmap/README.md").contains("| A Keeper |"));
    scaffold_cleanly(
        &root,
        &[
            "component",
            "bookings",
            "email-parser",
            "BKG:PARSER",
            "Reads a confirmation email",
        ],
    );
    let n = next_record(&root);
    scaffold_cleanly(
        &root,
        &[
            "decision",
            "Bookings are matched to trips by date",
            "bookings",
            "shared/trip-time",
            "--date",
            "2026-11-11",
        ],
    );
    let record = read(
        &root,
        &format!("decisions/{n}-bookings-are-matched-to-trips-by-date.md"),
    );
    assert!(record.contains("- **Date:** 2026-11-11\n- **Scope:** bookings, shared/trip-time\n"));
    // The new subject sorts after web, the last system, and before the components.
    let index = read(&root, "decisions/README.md");
    assert!(index.find("### web") < index.find("### bookings"));
    assert!(index.find("### bookings") < index.find("### shared/doc-check"));
    assert!(index.find("### shared/doc-check") < index.find("### shared/trip-time"));
    scaffold_cleanly(
        &root,
        &[
            "guide",
            "bookings",
            "forwarding-a-booking",
            "Forwarding a booking",
            "Sending a confirmation email to a trip",
        ],
    );
    assert!(read(&root, "guides/README.md").contains("## Bookings\n\n| Guide | Covers |"));
}

#[test]
fn a_decision_joins_an_existing_subject_and_takes_its_slug_and_number() {
    let root = real_vault();
    let n = next_record(&root);
    let out = scaffold_cleanly(
        &root,
        &[
            "decision",
            "Findings are grouped by file",
            "shared/doc-check",
            "--slug",
            "findings-by-file",
        ],
    );
    let index = read(&root, "decisions/README.md");
    assert!(
        !out.contains("components.md"),
        "the registry was only read:\n{out}"
    );
    let link = format!("[{n}]({n}-findings-by-file.md)");
    assert!(index.contains(&format!(
        "| {link} | Findings are grouped by file | shared/doc-check | Proposed |"
    )));
    let section = &index[index.find("### shared/doc-check").unwrap()..];
    assert!(section.contains(&format!(
        "| {link} | Findings are grouped by file | Proposed |"
    )));
}

#[test]
fn a_guide_joins_an_existing_group() {
    let root = real_vault();
    scaffold_cleanly(
        &root,
        &[
            "guide",
            "workspace",
            "writing-a-guide",
            "Writing a guide",
            "Writing a new guide",
        ],
    );
    let index = read(&root, "guides/README.md");
    assert!(index.find("| [documenting-a-component.md]") < index.find("| [writing-a-guide.md]"));
    assert_eq!(index.matches("## Workspace").count(), 1);
}

#[test]
fn a_component_specification_has_every_concern_subsection() {
    let root = small_vault();
    assert_eq!(findings(&root), Vec::<String>::new());
    scaffold_cleanly(
        &root,
        &[
            "component",
            "trips",
            "itinerary",
            "TRP:ITINERARY",
            "The days of a trip",
        ],
    );
    let spec = read(&root, "spec/trips/itinerary.md");
    let at = |s: &str| spec.find(s).unwrap();
    assert!(at("## 5. Resources") < at("### 5.1 Personal data"));
    assert!(at("### 5.1 Personal data") < at("## 6. Quality attributes"));
    scaffold_cleanly(&root, &["decision", "A first record", "workspace"]);
    assert!(root.join("docs/decisions/0001-a-first-record.md").is_file());
    scaffold_cleanly(
        &root,
        &["guide", "workspace", "first", "First", "The first guide"],
    );
}

#[test]
fn the_date_defaults_to_today() {
    let root = small_vault();
    scaffold_cleanly(&root, &["decision", "Dated today", "trips"]);
    let record = read(&root, "decisions/0001-dated-today.md");
    let date = record
        .lines()
        .find_map(|l| l.strip_prefix("- **Date:** "))
        .unwrap();
    assert_eq!(date.len(), 10);
    assert!(date.starts_with("20"));
}

// SHR:DOC-SCAFFOLD-F3: a refused command writes nothing, and says why.

#[test]
fn a_refused_command_writes_nothing_and_says_why() {
    let root = real_vault();
    let cases: &[(&[&str], &str)] = &[
        (
            &["component", "bookings", "parser", "BKG:PARSER", "x"],
            "the system bookings is not registered",
        ),
        (
            &["component", "shared", "doc-check", "SHR:DOC-CHECK2", "x"],
            "already registered",
        ),
        (
            &["component", "shared", "lint", "SHR:DOC-CHECK", "x"],
            "the prefix SHR:DOC-CHECK is already registered",
        ),
        (
            &["component", "planner", "budget", "SHR:BUDGET", "x"],
            "does not open with PLN:",
        ),
        (
            &["component", "planner", "budget", "PLN:BU", "x"],
            "three to twelve",
        ),
        (
            &["component", "planner", "Budget", "PLN:BUDGET", "x"],
            "not lower-case",
        ),
        (
            &["component", "planner", "budget", "PLN:BUDGET", "a | b"],
            "pipe",
        ),
        (
            &["component", "planner", "budget", "PLN:BUDGET", "a <b>"],
            "HTML",
        ),
        (
            &["component", "concerns", "privacy", "SHR:PRIVACY", "x"],
            "not a component",
        ),
        (&["system", "planner", "PL", "x", "k"], "already registered"),
        (
            &["system", "shared", "SH", "x", "k"],
            "never the slug of a system",
        ),
        (&["system", "money", "PLN", "x", "k"], "already in use"),
        (
            &["system", "money", "MONEY", "x", "k"],
            "two to four capital letters",
        ),
        (
            &["decision", "A choice", "nowhere"],
            "neither workspace nor a registered address",
        ),
        (
            &["decision", "A choice", "workspace", "web"],
            "the only scope",
        ),
        (
            &["decision", "A choice", "planner", "planner/pages"],
            "name the system alone",
        ),
        (&["decision", "A choice", "web", "web"], "named twice"),
        (
            &["decision", "A choice", "web", "--date", "2026-02-30"],
            "not a real date",
        ),
        (
            &["guide", "nowhere", "a-guide", "A guide", "x"],
            "neither workspace nor a registered system",
        ),
        (
            &["guide", "workspace", "documenting-a-component", "A", "x"],
            "already exists",
        ),
        (&["docs", "planner", "budget"], "is not registered"),
        (
            &["docs", "shared", "doc-check"],
            "already has both its documents",
        ),
        (&["docs", "concerns", "privacy"], "not a component"),
        (&["docs", "planner"], "wrong number of arguments"),
        (&["concern", "privacy"], "unknown command"),
    ];
    let before = snapshot(&root);
    for (args, why) in cases {
        let run = scaffold(&root, args);
        assert_eq!(run.status, 1, "{args:?} was not refused");
        assert!(run.stderr.contains(why), "{args:?} said:\n{}", run.stderr);
        assert!(run.stderr.contains("Nothing was written."), "{args:?}");
        assert!(run.stdout.is_empty(), "{args:?} printed:\n{}", run.stdout);
        assert!(snapshot(&root) == before, "{args:?} changed a file");
    }
}

#[test]
fn a_directory_without_a_vault_is_refused() {
    let root = temp_dir("empty");
    let run = scaffold(&root, &["guide", "workspace", "a", "A", "x"]);
    assert_eq!(run.status, 1);
    assert!(run.stderr.contains("not a repository with a vault"));
}
