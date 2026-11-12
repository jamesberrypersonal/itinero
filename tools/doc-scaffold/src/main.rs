//! doc-scaffold writes the skeleton documents and index rows for a new component, system,
//! decision record or guide, or for a registered component's missing documents, so that the vault
//! still passes doc-check.
//!
//! What it promises is `docs/requirements/shared/doc-scaffold.md`, and how it is built is
//! `docs/spec/shared/doc-scaffold.md`. Section numbers in comments are that specification's.

mod commands;
mod date;
mod md;
mod plan;
mod registry;

use plan::Plan;
use registry::Registry;
use std::path::PathBuf;
use std::process::ExitCode;

/// The three outcomes of a run (§3.1).
const WRITTEN: u8 = 0;
const REFUSED: u8 = 1;
const FAILED: u8 = 2;

const USAGE: &str = "usage:
  doc-scaffold component <system> <slug> <prefix> <description>
  doc-scaffold docs <system> <slug>
  doc-scaffold system <slug> <prefix> <description> <keeper>
  doc-scaffold decision <title> <scope>... [--slug <slug>] [--date <YYYY-MM-DD>]
  doc-scaffold guide <group> <slug> <title> <description>
Every command also takes --root <dir>, the repository root, which defaults to the working directory.";

struct Args {
    root: PathBuf,
    slug: Option<String>,
    date: Option<String>,
    words: Vec<String>,
}

fn parse(args: &[String]) -> Result<Args, String> {
    let mut out = Args {
        root: PathBuf::from("."),
        slug: None,
        date: None,
        words: Vec::new(),
    };
    let mut it = args.iter();
    while let Some(arg) = it.next() {
        let mut value = |name: &str| {
            it.next()
                .cloned()
                .ok_or(format!("option {name} is missing its value"))
        };
        match arg.as_str() {
            "--root" => out.root = PathBuf::from(value("--root")?),
            "--slug" => out.slug = Some(value("--slug")?),
            "--date" => out.date = Some(value("--date")?),
            o if o.starts_with("--") => return Err(format!("unknown option {o}")),
            word => out.words.push(word.to_string()),
        }
    }
    let command = out.words.first().map(String::as_str).unwrap_or("");
    if command != "decision" && (out.slug.is_some() || out.date.is_some()) {
        return Err("--slug and --date belong to the decision command alone".into());
    }
    let arity = |n: usize| out.words.len() == n + 1;
    let fits = match command {
        "component" | "system" | "guide" => arity(4),
        "docs" => arity(2),
        "decision" => out.words.len() >= 3,
        "" => return Err("no command given".into()),
        other => return Err(format!("unknown command {other}")),
    };
    if !fits {
        return Err(format!(
            "the {command} command was given the wrong number of arguments"
        ));
    }
    Ok(out)
}

fn run(args: &Args) -> Result<Plan, String> {
    let mut plan = Plan::new(&args.root);
    if !args.root.join("docs/components.md").is_file() {
        return Err(format!(
            "{} holds no docs/components.md, so it is not a repository with a vault",
            args.root.display()
        ));
    }
    let reg = Registry::read(plan.edit("components.md")?)?;
    let w = &args.words;
    match w[0].as_str() {
        "component" => {
            commands::component(&mut plan, &reg, &args.root, &w[1], &w[2], &w[3], &w[4])?
        }
        "docs" => commands::docs(&mut plan, &reg, &args.root, &w[1], &w[2])?,
        "system" => commands::system(&mut plan, &reg, &w[1], &w[2], &w[3], &w[4])?,
        "decision" => commands::decision(
            &mut plan,
            &reg,
            &args.root,
            &w[1],
            &w[2..],
            args.slug.as_deref(),
            args.date.as_deref(),
        )?,
        _ => commands::guide(&mut plan, &reg, &w[1], &w[2], &w[3], &w[4])?,
    }
    Ok(plan)
}

fn main() -> ExitCode {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let args = match parse(&args) {
        Ok(a) => a,
        Err(reason) => {
            eprintln!("doc-scaffold: refused: {reason}. Nothing was written.\n\n{USAGE}");
            return ExitCode::from(REFUSED);
        }
    };
    let plan = match run(&args) {
        Ok(p) => p,
        Err(reason) => {
            eprintln!("doc-scaffold: refused: {reason}. Nothing was written.");
            return ExitCode::from(REFUSED);
        }
    };
    match plan.apply() {
        Ok(report) => {
            for line in report {
                println!("doc-scaffold: {line}");
            }
            println!(
                "doc-scaffold: next, replace each \"{}\" in the files above, then run just check-docs.",
                commands::MARK
            );
            ExitCode::from(WRITTEN)
        }
        Err(reason) => {
            eprintln!(
                "doc-scaffold: failed: {reason}. Files listed before this line were written; \
                 git status shows them."
            );
            ExitCode::from(FAILED)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn args(a: &[&str]) -> Vec<String> {
        a.iter().map(|s| s.to_string()).collect()
    }

    #[test]
    fn each_command_takes_its_arguments_and_no_others() {
        assert!(parse(&args(&["component", "shared", "x", "SHR:XXX", "An x"])).is_ok());
        assert!(parse(&args(&["component", "shared", "x", "SHR:XXX"])).is_err());
        assert!(parse(&args(&["docs", "planner", "itinerary"])).is_ok());
        assert!(parse(&args(&["docs", "planner"])).is_err());
        assert!(
            parse(&args(&[
                "decision",
                "A title",
                "workspace",
                "--date",
                "2026-01-01"
            ]))
            .is_ok()
        );
        assert!(parse(&args(&["decision", "A title"])).is_err());
        assert!(
            parse(&args(&[
                "guide",
                "workspace",
                "x",
                "X",
                "An x",
                "--slug",
                "y"
            ]))
            .is_err()
        );
        assert!(parse(&args(&["concern", "a"])).is_err());
        assert!(parse(&args(&["--quiet"])).is_err());
    }
}
