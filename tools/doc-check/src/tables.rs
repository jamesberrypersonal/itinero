//! The three tables every rule shares (`spec/shared/doc-check.md` §4.3): the component registry,
//! the decision records and the live work list.

use crate::markdown::{self, Kind, Line};
use crate::vault::{Doc, Vault};
use std::collections::{BTreeMap, BTreeSet};

/// A table found under a heading: its header cells and each body row.
pub struct Table<'a> {
    pub header: Vec<String>,
    pub rows: Vec<&'a Line>,
}

impl Table<'_> {
    pub fn column(&self, name: &str) -> Option<usize> {
        self.header.iter().position(|h| h == name)
    }
}

/// The first table after the line at `from`, stopping at the next heading of `level` or above.
pub fn table_after(doc: &Doc, from: usize, level: u8) -> Option<Table<'_>> {
    let mut rows = Vec::new();
    let mut header: Option<&Line> = None;
    for line in doc.lines.iter().skip(from) {
        if let Kind::Heading(l) = line.kind
            && l <= level
        {
            break;
        }
        match line.kind {
            Kind::TableRow if header.is_none() => header = Some(line),
            Kind::TableRow => rows.push(line),
            Kind::Separator => {}
            _ if header.is_some() => break,
            _ => {}
        }
    }
    let header = header?;
    Some(Table {
        header: header
            .cells()
            .into_iter()
            .map(|c| header.cell_text(c))
            .collect(),
        rows,
    })
}

/// A cell's value: its link text, if it holds a link, and otherwise its text, without backticks.
pub fn cell_value(line: &Line, cell: (usize, usize)) -> String {
    if let Some(link) = line
        .scan
        .links
        .iter()
        .find(|l| l.start >= cell.0 && l.end <= cell.1)
    {
        return link.text.trim().trim_matches('`').to_string();
    }
    line.cell_text(cell).trim_matches('`').trim().to_string()
}

pub struct System {
    pub slug: String,
    pub prefix: String,
    pub line: usize,
}

pub struct Component {
    pub system: String,
    pub slug: String,
    pub prefix: String,
    pub line: usize,
}

pub struct Concern {
    pub slug: String,
    pub prefix: String,
    /// The section number every component specification must have, such as `3.5`.
    pub section: Option<String>,
    pub line: usize,
}

#[derive(Default)]
pub struct Registry {
    pub systems: Vec<System>,
    pub components: Vec<Component>,
    pub concerns: Vec<Concern>,
    /// The tables of the four that `components.md` lacks.
    pub missing: Vec<&'static str>,
}

pub const REGISTRY_TABLES: [&str; 4] = [
    "Systems",
    "Components",
    "Booking kinds",
    "Cross-cutting concerns",
];

impl Registry {
    pub fn read(vault: &Vault) -> Registry {
        let mut reg = Registry::default();
        let Some(doc) = vault.doc("components.md") else {
            reg.missing = REGISTRY_TABLES.to_vec();
            return reg;
        };
        for name in REGISTRY_TABLES {
            let at = doc
                .lines
                .iter()
                .position(|l| l.kind == Kind::Heading(2) && l.heading_text() == Some(name));
            let Some(table) = at.and_then(|i| table_after(doc, i + 1, 2)) else {
                reg.missing.push(name);
                continue;
            };
            let col = |n: &str| table.column(n);
            for row in &table.rows {
                let cells = row.cells();
                let get = |c: Option<usize>| {
                    c.and_then(|i| cells.get(i).copied())
                        .map(|c| cell_value(row, c))
                        .unwrap_or_default()
                };
                match name {
                    "Systems" => reg.systems.push(System {
                        slug: get(col("System")),
                        prefix: get(col("Prefix")),
                        line: row.no,
                    }),
                    "Components" => reg.components.push(Component {
                        system: get(col("System")),
                        slug: get(col("Component")),
                        prefix: get(col("Prefix")),
                        line: row.no,
                    }),
                    "Booking kinds" => {
                        let prefix = get(col("Prefix"));
                        let slug = match prefix.split_once(':') {
                            Some((_, kind)) => kind.to_lowercase(),
                            None => get(col("Kind")).to_lowercase(),
                        };
                        reg.components.push(Component {
                            system: "bookings".into(),
                            slug,
                            prefix,
                            line: row.no,
                        });
                    }
                    _ => {
                        let section = get(col("Covered in each specification at"));
                        let section = section.trim_start_matches('§').trim();
                        reg.concerns.push(Concern {
                            slug: get(col("Concern")),
                            prefix: get(col("Prefix")),
                            section: (!section.is_empty()).then(|| section.to_string()),
                            line: row.no,
                        });
                    }
                }
            }
        }
        reg
    }

    pub fn is_system(&self, slug: &str) -> bool {
        self.systems.iter().any(|s| s.slug == slug)
    }

    /// Every registered address: systems, components and concerns.
    pub fn addresses(&self) -> BTreeSet<String> {
        let mut out = BTreeSet::new();
        for s in &self.systems {
            out.insert(s.slug.clone());
        }
        for c in &self.components {
            out.insert(format!("{}/{}", c.system, c.slug));
        }
        for c in &self.concerns {
            out.insert(format!("concerns/{}", c.slug));
        }
        out
    }

    /// Each prefix, mapped to the requirements document that owns it.
    pub fn owners(&self) -> BTreeMap<String, String> {
        let mut out = BTreeMap::new();
        for s in &self.systems {
            out.entry(s.prefix.clone())
                .or_insert(format!("requirements/{0}/{0}.md", s.slug));
        }
        for c in &self.components {
            out.entry(c.prefix.clone())
                .or_insert(format!("requirements/{}/{}.md", c.system, c.slug));
        }
        for c in &self.concerns {
            out.entry(c.prefix.clone())
                .or_insert(format!("requirements/concerns/{}.md", c.slug));
        }
        out
    }

    /// The prefix a requirements document owns, if the registry gives it one.
    pub fn prefix_of(&self, rel: &str) -> Option<String> {
        self.owners()
            .into_iter()
            .find(|(_, doc)| doc == rel)
            .map(|(p, _)| p)
    }
}

pub struct Record {
    pub rel: String,
    /// The number in the filename, such as `0001`.
    pub number: String,
    pub heading_number: Option<String>,
    pub title: Option<String>,
    pub status: Option<(String, usize)>,
    pub scope: Option<(Vec<String>, usize)>,
    /// The lines of the record's Consequences section.
    pub consequences: Vec<usize>,
}

/// Every decision record in `decisions/`, by filename.
pub fn records(vault: &Vault) -> BTreeMap<String, Record> {
    let mut out = BTreeMap::new();
    for doc in vault.docs.values() {
        let Some(name) = doc.rel.strip_prefix("decisions/") else {
            continue;
        };
        if !is_record_name(name) {
            continue;
        }
        let mut record = Record {
            rel: doc.rel.clone(),
            number: name[..4].to_string(),
            heading_number: None,
            title: None,
            status: None,
            scope: None,
            consequences: Vec::new(),
        };
        let mut in_consequences = false;
        for line in doc.read_lines() {
            if line.kind == Kind::Heading(1) && record.title.is_none() {
                let text = line.heading_text().unwrap_or("");
                if let Some(rest) = text.strip_prefix("ADR-") {
                    let number: String = rest.chars().take_while(|c| c.is_ascii_digit()).collect();
                    let title = rest[number.len()..]
                        .trim_start()
                        .trim_start_matches('—')
                        .trim();
                    record.heading_number = Some(number);
                    record.title = Some(title.to_string());
                }
            }
            if let Kind::Heading(level) = line.kind {
                if level <= 2 {
                    in_consequences = level == 2 && line.heading_text() == Some("Consequences");
                }
                continue;
            }
            if in_consequences {
                record.consequences.push(line.no);
            }
            let t = line.text.trim_start();
            if let Some(v) = t.strip_prefix("- **Status:**") {
                record.status = Some((v.trim().to_string(), line.no));
            }
            if let Some(v) = t.strip_prefix("- **Scope:**") {
                let entries = v
                    .split(',')
                    .map(|e| e.trim().trim_matches('`').to_string())
                    .filter(|e| !e.is_empty());
                record.scope = Some((entries.collect(), line.no));
            }
        }
        out.insert(doc.rel.clone(), record);
    }
    out
}

/// Four digits, a hyphen and a slug, ending in `.md`.
pub fn is_record_name(name: &str) -> bool {
    let b = name.as_bytes();
    b.len() > 8 && b[..4].iter().all(u8::is_ascii_digit) && b[4] == b'-' && name.ends_with(".md")
}

/// The live work list, `TODO.md`, with the item numbers the changelog mentions.
#[derive(Default)]
pub struct LiveList {
    pub exists: bool,
    /// Each item's number, from its heading.
    pub items: BTreeSet<u64>,
    /// Every item number `CHANGELOG.md` mentions.
    pub changelog: BTreeSet<u64>,
    /// The line of the `## Tags` heading, and each tag in its table with its row's line.
    pub tags: Option<(usize, Vec<(String, usize)>)>,
}

impl LiveList {
    pub fn read(vault: &Vault) -> LiveList {
        let mut list = LiveList::default();
        if let Some(doc) = vault.doc("CHANGELOG.md") {
            for line in doc.read_lines() {
                for (_, n) in markdown::numbered(&line.without_targets(), "TODO-", None) {
                    list.changelog.insert(n.parse().unwrap_or(0));
                }
            }
        }
        let Some(doc) = vault.doc("TODO.md") else {
            return list;
        };
        list.exists = true;
        for line in doc.read_lines() {
            if line.kind == Kind::Heading(3)
                && let Some(n) = item_heading(line.heading_text().unwrap_or(""))
            {
                list.items.insert(n);
            }
        }
        if let Some(at) = doc
            .lines
            .iter()
            .position(|l| l.kind == Kind::Heading(2) && l.heading_text() == Some("Tags"))
        {
            let mut tags = Vec::new();
            if let Some(table) = table_after(doc, at + 1, 2) {
                for row in &table.rows {
                    if let Some(&first) = row.cells().first() {
                        tags.push((cell_value(row, first), row.no));
                    }
                }
            }
            list.tags = Some((doc.lines[at].no, tags));
        }
        list
    }

    pub fn holds(&self, n: u64) -> bool {
        self.items.contains(&n) || self.changelog.contains(&n)
    }
}

/// The item number of a heading of the form `TODO-<number> — <title>`.
pub fn item_heading(text: &str) -> Option<u64> {
    let rest = text.strip_prefix("TODO-")?;
    let digits: String = rest.chars().take_while(|c| c.is_ascii_digit()).collect();
    let title = rest[digits.len()..].strip_prefix(" — ")?;
    (!digits.is_empty() && !title.trim().is_empty())
        .then(|| digits.parse().ok())
        .flatten()
}
