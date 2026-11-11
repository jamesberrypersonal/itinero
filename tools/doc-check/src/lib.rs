//! doc-check holds every document in the `docs/` vault to the documentation system.
//!
//! What it promises is `docs/requirements/shared/doc-check.md`, and how it is built is
//! `docs/spec/shared/doc-check.md`. Section numbers in comments are that specification's.
//!
//! The library holds one function, [`check`], which the binary runs. doc-scaffold's tests run it
//! too, to confirm that what doc-scaffold writes passes (§3.3).

mod markdown;
mod rules;
mod tables;
mod vault;

pub use rules::{Finding, capitalise};
use std::path::Path;

/// Reads the vault at `<root>/docs` and runs every rule over it (§4.1, steps 2 to 7). The findings
/// come back sorted and without repeats. An error is a reason the run could not finish (§4.6).
pub fn check(root: &Path) -> Result<Vec<Finding>, String> {
    let vault = vault::load(root)?;
    Ok(rules::run(&vault))
}

#[cfg(test)]
mod tests {
    use super::*;

    /// §4.7, coverage: every rule has a breaking case and a keeping case, and every case
    /// directory names a rule (SHR:DOC-CHECK-NFR6).
    #[test]
    fn every_rule_has_a_breaking_case_and_a_keeping_case() {
        let cases = Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/rules");
        let mut problems = Vec::new();
        for (rule, _) in rules::RULES {
            for kind in ["breaks", "keeps"] {
                if !cases.join(rule).join(kind).join("docs").is_dir() {
                    problems.push(format!("rule {rule} has no {kind} case"));
                }
            }
        }
        for entry in std::fs::read_dir(&cases).expect("tests/rules exists") {
            let name = entry.unwrap().file_name().into_string().unwrap();
            if !rules::RULES.iter().any(|(r, _)| *r == name) {
                problems.push(format!("tests/rules/{name} names no rule"));
            }
        }
        assert!(problems.is_empty(), "{}", problems.join("\n"));
    }
}
