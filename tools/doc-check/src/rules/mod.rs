//! The rules of `spec/shared/doc-check.md` §4.3: one for each row of the table of mechanical
//! checks in `documentation-system.md`.

mod citations;
mod decisions;
mod layout;
mod links;
mod markup;
mod registry;
mod requirements;

use crate::markdown::Link;
use crate::tables::{LiveList, Record, Registry};
use crate::vault::{self, Doc, Vault};
use std::collections::BTreeMap;

/// Each rule's name, and the heading of `documentation-system.md` that states it.
pub const RULES: &[(&str, &str)] = &[
    ("links", "Markdown rules"),
    ("block-ids", "Identifiers"),
    ("callouts", "Markdown rules"),
    ("case-collisions", "What is checked mechanically"),
    ("filenames", "Filenames"),
    ("indexes", "The layout"),
    ("registry", "The component registry"),
    ("concern-sections", "Cross-cutting concerns"),
    ("addresses", "Systems and components"),
    ("identifiers", "Identifiers"),
    ("verification", "The shape of a requirement"),
    ("unprefixed", "Identifiers"),
    ("adr-citations", "Citations"),
    ("adr-scopes", "The shape of a record"),
    ("decision-index", "The index"),
    ("back-citations", "The shape of a record"),
    ("sections", "Citations"),
    (
        "live-list-citations",
        "The live work list and the changelog",
    ),
    ("live-list-shape", "The live work list and the changelog"),
    ("tags", "The live work list and the changelog"),
    ("claims", "Requirements this satisfies"),
    ("code-spans", "Markdown rules"),
    ("raw-html", "Markdown rules"),
];

pub fn heading(rule: &str) -> &'static str {
    RULES
        .iter()
        .find(|(r, _)| *r == rule)
        .map(|(_, h)| *h)
        .unwrap_or("What is checked mechanically")
}

/// One place a document breaks a rule (§4.4).
#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub struct Finding {
    pub path: String,
    pub line: usize,
    pub rule: &'static str,
    pub found: String,
    pub pass: Option<String>,
}

impl Finding {
    pub fn render(&self) -> String {
        let pass = self
            .pass
            .as_ref()
            .map(|p| format!(". {}", capitalise(p)))
            .unwrap_or_default();
        format!(
            "{}:{}: {}: {}{}. (documentation-system.md, \"{}\")",
            self.path,
            self.line,
            self.rule,
            self.found,
            pass,
            heading(self.rule)
        )
    }
}

pub fn capitalise(s: &str) -> String {
    let mut c = s.chars();
    match c.next() {
        Some(first) => first.to_uppercase().chain(c).collect(),
        None => String::new(),
    }
}

/// What every rule reads, and where it reports.
pub struct Ctx<'a> {
    pub vault: &'a Vault,
    pub reg: &'a Registry,
    pub records: &'a BTreeMap<String, Record>,
    pub list: &'a LiveList,
    pub out: Vec<Finding>,
}

impl Ctx<'_> {
    pub fn report(
        &mut self,
        rule: &'static str,
        path: String,
        line: usize,
        found: String,
        pass: Option<String>,
    ) {
        debug_assert!(
            RULES.iter().any(|(r, _)| *r == rule),
            "unlisted rule {rule}"
        );
        self.out.push(Finding {
            path,
            line,
            rule,
            found,
            pass,
        });
    }
}

/// Runs every rule over the vault, and returns the findings sorted and without repeats.
pub fn run(vault: &Vault) -> Vec<Finding> {
    let reg = Registry::read(vault);
    let records = crate::tables::records(vault);
    let list = LiveList::read(vault);
    let mut ctx = Ctx {
        vault,
        reg: &reg,
        records: &records,
        list: &list,
        out: Vec::new(),
    };

    links::check(&mut ctx);
    markup::check(&mut ctx);
    layout::check(&mut ctx);
    registry::check(&mut ctx);
    requirements::check(&mut ctx);
    decisions::check(&mut ctx);
    citations::check(&mut ctx);

    let mut out = ctx.out;
    out.sort_by(|a, b| {
        (a.path.as_bytes(), a.line, a.rule, &a.found, &a.pass).cmp(&(
            b.path.as_bytes(),
            b.line,
            b.rule,
            &b.found,
            &b.pass,
        ))
    });
    out.dedup();
    out
}

/// Where a link points, read against the document holding it.
pub enum Target {
    /// A target with a scheme, such as `https:`. It is never checked.
    External,
    /// A target that starts with `/`.
    Absolute(String),
    /// A relative target. `path` is from the vault root, or `None` when it leaves the vault.
    Relative {
        path: Option<String>,
        fragment: Option<String>,
    },
}

pub fn target(doc: &Doc, link: &Link) -> Target {
    let t = &link.target;
    let scheme: String = t
        .chars()
        .take_while(|c| c.is_ascii_alphanumeric() || matches!(c, '+' | '.' | '-'))
        .collect();
    if !scheme.is_empty()
        && t[scheme.len()..].starts_with(':')
        && scheme
            .chars()
            .next()
            .is_some_and(|c| c.is_ascii_alphabetic())
    {
        return Target::External;
    }
    let (path, fragment) = match t.split_once('#') {
        Some((p, f)) => (p, Some(f.to_string())),
        None => (t.as_str(), None),
    };
    let path = vault::percent_decode(path);
    if path.starts_with('/') {
        return Target::Absolute(path);
    }
    let resolved = if path.is_empty() {
        Some(doc.rel.clone())
    } else {
        vault::resolve(doc.dir(), path.trim_end_matches('/'))
    };
    Target::Relative {
        path: resolved,
        fragment,
    }
}

/// The vault path a link resolves to, if it is relative and stays inside the vault.
pub fn resolved(doc: &Doc, link: &Link) -> Option<String> {
    match target(doc, link) {
        Target::Relative { path, .. } => path,
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The `case-collisions` rule case runs only on a case-sensitive file system, so its logic is
    /// also checked here, on a vault built in memory.
    #[test]
    fn names_differing_only_in_case_are_reported_once_each() {
        let mut vault = Vault::default();
        vault.dirs.insert(String::new());
        vault.children.insert(
            String::new(),
            vec!["Notes.png".into(), "notes.png".into(), "other.png".into()],
        );
        let found: Vec<String> = run(&vault)
            .iter()
            .filter(|f| f.rule == "case-collisions")
            .map(Finding::render)
            .collect();
        assert_eq!(
            found,
            [
                "docs/Notes.png:1: case-collisions: Notes.png differs from notes.png only in letter case. Rename one of them. (documentation-system.md, \"What is checked mechanically\")",
                "docs/notes.png:1: case-collisions: notes.png differs from Notes.png only in letter case. Rename one of them. (documentation-system.md, \"What is checked mechanically\")",
            ]
        );
    }
}
