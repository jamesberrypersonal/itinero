//! doc-check holds every document in the `docs/` vault to the documentation system.
//!
//! What it promises is `docs/requirements/shared/doc-check.md`, and how it is built is
//! `docs/spec/shared/doc-check.md`. Section numbers in comments are that specification's.

mod markdown;
mod rules;
mod tables;
mod vault;

use rules::{Finding, capitalise};
use std::collections::BTreeSet;
use std::fs::OpenOptions;
use std::io::Write;
use std::path::PathBuf;
use std::process::ExitCode;

/// The three outcomes of a run (§3.1).
const CLEAN: u8 = 0;
const FINDINGS: u8 = 1;
const COULD_NOT_RUN: u8 = 2;

struct Options {
    root: PathBuf,
    summary: Option<PathBuf>,
}

fn parse_args(args: &[String]) -> Result<Options, String> {
    let mut opts = Options {
        root: PathBuf::from("."),
        summary: None,
    };
    let mut it = args.iter();
    while let Some(arg) = it.next() {
        let mut value = |name: &str| {
            it.next()
                .cloned()
                .ok_or(format!("option {name} is missing its value"))
        };
        match arg.as_str() {
            "--root" => opts.root = PathBuf::from(value("--root")?),
            "--summary" => opts.summary = Some(PathBuf::from(value("--summary")?)),
            other => return Err(format!("unknown option {other}")),
        }
    }
    Ok(opts)
}

fn plural(n: usize, word: &str) -> String {
    if n == 1 {
        format!("1 {word}")
    } else {
        format!("{n} {word}s")
    }
}

/// The outcome line (§4.4) and the summary's outcome sentence (§4.5).
fn outcome(findings: &[Finding]) -> (String, String) {
    if findings.is_empty() {
        return ("doc-check: clean".into(), "The vault is clean.".into());
    }
    let files: BTreeSet<&str> = findings.iter().map(|f| f.path.as_str()).collect();
    let counts = format!(
        "{} in {}",
        plural(findings.len(), "finding"),
        plural(files.len(), "file")
    );
    (format!("doc-check: {counts}"), format!("{counts}."))
}

/// The Markdown section appended to the summary file (§4.5).
fn summary(sentence: &str, findings: &[Finding]) -> String {
    let mut out = format!("## Documentation check\n\n{sentence}\n");
    if !findings.is_empty() {
        out.push_str("\n| Where | Rule | Finding |\n|---|---|---|\n");
        for f in findings {
            let pass = f
                .pass
                .as_ref()
                .map(|p| format!(". {}", capitalise(p)))
                .unwrap_or_default();
            let text = format!("{}{pass}.", capitalise(&f.found)).replace('|', "\\|");
            out.push_str(&format!(
                "| `{}:{}` | {} | {} |\n",
                f.path, f.line, f.rule, text
            ));
        }
    }
    out
}

fn append(path: &PathBuf, text: &str) -> Result<(), String> {
    OpenOptions::new()
        .create(true)
        .append(true)
        .open(path)
        .and_then(|mut f| f.write_all(text.as_bytes()))
        .map_err(|e| format!("the summary file {} cannot be written: {e}", path.display()))
}

fn could_not_run(reason: &str, summary_path: Option<&PathBuf>) -> ExitCode {
    eprintln!("doc-check: could not run: {reason}");
    if let Some(path) = summary_path {
        let text = format!("## Documentation check\n\nThe vault could not be checked: {reason}.\n");
        if let Err(e) = append(path, &text) {
            eprintln!("doc-check: could not run: {e}");
        }
    }
    ExitCode::from(COULD_NOT_RUN)
}

fn main() -> ExitCode {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let opts = match parse_args(&args) {
        Ok(o) => o,
        Err(reason) => return could_not_run(&reason, None),
    };
    let vault = match vault::load(&opts.root) {
        Ok(v) => v,
        Err(reason) => return could_not_run(&reason, opts.summary.as_ref()),
    };
    let findings = rules::run(&vault);
    let (line, sentence) = outcome(&findings);

    let mut out = String::new();
    for f in &findings {
        out.push_str(&f.render());
        out.push('\n');
    }
    out.push_str(&line);
    out.push('\n');
    print!("{out}");

    if let Some(path) = &opts.summary
        && let Err(reason) = append(path, &summary(&sentence, &findings))
    {
        eprintln!("doc-check: could not run: {reason}");
        return ExitCode::from(COULD_NOT_RUN);
    }
    ExitCode::from(if findings.is_empty() { CLEAN } else { FINDINGS })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::Path;

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

    #[test]
    fn unknown_options_and_missing_values_are_refused() {
        let args = |a: &[&str]| a.iter().map(|s| s.to_string()).collect::<Vec<_>>();
        assert!(parse_args(&args(&["--quiet"])).is_err());
        assert!(parse_args(&args(&["--summary"])).is_err());
        assert!(parse_args(&args(&["--root", "x", "--summary", "y"])).is_ok());
    }

    #[test]
    fn a_pipe_in_a_finding_is_escaped_in_the_summary() {
        let f = Finding {
            path: "docs/a.md".into(),
            line: 3,
            rule: "links",
            found: "a | b".into(),
            pass: None,
        };
        assert!(summary("1 finding in 1 file.", &[f]).contains("A \\| b."));
    }
}
