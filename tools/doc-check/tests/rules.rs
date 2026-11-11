//! Runs every rule case under `tests/rules/` (`docs/spec/shared/doc-check.md` §4.7).
//!
//! A `keeps` case must run clean. A `breaks` case must print exactly the findings in its
//! `expected.txt`, and every one of them must name the case's own rule. A case may hold a
//! `create.txt`, listing files to create before the run: a case-insensitive file system cannot
//! hold two names that differ only in case, so such a case is skipped there.

mod common;

use std::fs;
use std::path::Path;

/// Copies a case into a temporary root and creates its listed files. `None` if it cannot run here.
fn prepare(case: &Path) -> Option<std::path::PathBuf> {
    let root = common::temp_dir("case");
    common::copy_dir(case, &root, false);
    let create = root.join("create.txt");
    if let Ok(list) = fs::read_to_string(&create) {
        fs::remove_file(&create).unwrap();
        for rel in list.lines().filter(|l| !l.is_empty()) {
            let path = root.join(rel);
            fs::create_dir_all(path.parent().unwrap()).unwrap();
            let before = fs::read_dir(path.parent().unwrap()).unwrap().count();
            fs::write(&path, "").unwrap();
            if fs::read_dir(path.parent().unwrap()).unwrap().count() == before {
                return None;
            }
        }
    }
    Some(root)
}

#[test]
fn every_rule_case_gives_its_expected_findings() {
    let cases = Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/rules");
    let mut rules: Vec<_> = fs::read_dir(&cases)
        .unwrap()
        .map(|e| e.unwrap().path())
        .collect();
    rules.sort();
    let mut failures = Vec::new();
    let mut ran = 0;
    for rule_dir in rules {
        let rule = rule_dir.file_name().unwrap().to_str().unwrap().to_string();
        let mut dirs: Vec<_> = fs::read_dir(&rule_dir)
            .unwrap()
            .map(|e| e.unwrap().path())
            .collect();
        dirs.sort();
        for case in dirs {
            let name = case.file_name().unwrap().to_str().unwrap().to_string();
            let Some(root) = prepare(&case) else {
                eprintln!("skipped {rule}/{name}: this file system cannot hold the names it needs");
                continue;
            };
            ran += 1;
            let run = common::run(&root, &[]);
            let label = format!("{rule}/{name}");
            if name.starts_with("keeps") {
                if run.status != 0 || run.stdout != "doc-check: clean\n" {
                    failures.push(format!(
                        "{label} should run clean, and printed:\n{}{}",
                        run.stdout, run.stderr
                    ));
                }
            } else if name.starts_with("breaks") {
                let expected = fs::read_to_string(case.join("expected.txt")).unwrap_or_default();
                let mut lines: Vec<&str> = run.stdout.lines().collect();
                lines.pop();
                let printed = lines.join("\n");
                if run.status != 1 {
                    failures.push(format!(
                        "{label} should exit 1, and exited {}:\n{}{}",
                        run.status, run.stdout, run.stderr
                    ));
                } else if printed != expected.trim_end() {
                    failures.push(format!(
                        "{label} printed:\n{printed}\nbut expected.txt holds:\n{}",
                        expected.trim_end()
                    ));
                } else if let Some(other) =
                    lines.iter().find(|l| !l.contains(&format!(": {rule}: ")))
                {
                    failures.push(format!(
                        "{label} reports a finding of another rule: {other}"
                    ));
                }
            } else {
                failures.push(format!("{label} is neither a breaks case nor a keeps case"));
            }
            let _ = fs::remove_dir_all(&root);
        }
    }
    assert!(ran > 0, "no rule cases ran");
    assert!(failures.is_empty(), "\n{}", failures.join("\n\n"));
}
