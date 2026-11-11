//! §4.3.2 block-ids, §4.3.10 identifiers, §4.3.11 verification, §4.3.12 unprefixed and
//! §4.3.21 claims.

use super::Ctx;
use crate::markdown::{self, Kind, Line};
use crate::tables::table_after;
use crate::vault::{Doc, repo_path};
use std::collections::{BTreeMap, BTreeSet};

/// A functional or non-functional requirement: a level-three heading in `requirements/` that
/// opens with its identifier, then ` — `.
struct Req<'a> {
    doc: &'a Doc,
    ident: String,
    /// The index of the heading in the document's lines.
    at: usize,
}

impl Req<'_> {
    fn heading(&self) -> &Line {
        &self.doc.lines[self.at]
    }
}

fn block_id(ident: &str) -> String {
    ident.to_lowercase().replace(':', "-")
}

fn requirements<'a>(ctx: &Ctx<'a>) -> Vec<Req<'a>> {
    let mut out = Vec::new();
    for doc in ctx
        .vault
        .docs
        .values()
        .filter(|d| d.rel.starts_with("requirements/"))
    {
        for (at, line) in doc.lines.iter().enumerate() {
            if line.kind != Kind::Heading(3) {
                continue;
            }
            let text: Vec<char> = line.heading_text().unwrap_or("").chars().collect();
            let Some(first) = markdown::identifiers(&text).into_iter().next() else {
                continue;
            };
            let after: String = text[first.end..].iter().collect();
            if first.start == 0 && first.kind != "NR" && after.starts_with(" — ") {
                out.push(Req {
                    doc,
                    ident: first.text,
                    at,
                });
            }
        }
    }
    out
}

/// A non-requirements table: its rows, and the identifiers its bold first cells define.
struct NrTable<'a> {
    last: usize,
    prefix: String,
    defines: Vec<String>,
    rows: Vec<&'a Line>,
}

fn nr_tables(doc: &Doc) -> Vec<NrTable<'_>> {
    let mut groups: Vec<Vec<usize>> = Vec::new();
    for (i, line) in doc.lines.iter().enumerate() {
        if matches!(line.kind, Kind::TableRow | Kind::Separator) {
            match groups.last_mut() {
                Some(g) if doc.lines[*g.last().unwrap()].block == line.block => g.push(i),
                _ => groups.push(vec![i]),
            }
        }
    }
    let mut out = Vec::new();
    for group in groups {
        let rows: Vec<&Line> = group
            .iter()
            .map(|&i| &doc.lines[i])
            .filter(|l| l.kind == Kind::TableRow)
            .collect();
        let bold_nr = |line: &Line| -> Option<markdown::Ident> {
            let first = *line.cells().first()?;
            let text = line.cell_text(first);
            let inner = text.strip_prefix("**")?.strip_suffix("**")?;
            let chars: Vec<char> = inner.chars().collect();
            markdown::identifiers(&chars)
                .into_iter()
                .find(|i| i.kind == "NR" && i.start == 0 && i.end == chars.len())
        };
        let Some(first) = rows.get(1).and_then(|l| bold_nr(l)) else {
            continue;
        };
        let defines = rows
            .iter()
            .skip(1)
            .filter_map(|l| bold_nr(l))
            .map(|i| i.text)
            .collect();
        out.push(NrTable {
            last: *group.last().unwrap(),
            prefix: first.prefix,
            defines,
            rows,
        });
    }
    out
}

pub fn check(ctx: &mut Ctx) {
    let reqs = requirements(ctx);
    let mut found = Vec::new();

    // block-ids and verification.
    for req in &reqs {
        let doc = req.doc;
        let bid = block_id(&req.ident);
        let mut paragraph_end = None;
        for (i, line) in doc.lines.iter().enumerate().skip(req.at + 1) {
            match line.kind {
                Kind::Blank => {
                    if paragraph_end.is_some() {
                        break;
                    }
                }
                Kind::Text => {
                    if paragraph_end.is_some_and(|e: usize| doc.lines[e].block != line.block) {
                        break;
                    }
                    paragraph_end = Some(i);
                }
                _ => break,
            }
        }
        let ends_right = paragraph_end
            .is_some_and(|e| markdown::trailing_block_id(&doc.lines[e].text) == Some(&bid));
        if !ends_right {
            let line = paragraph_end
                .map(|e| doc.lines[e].no)
                .unwrap_or(req.heading().no);
            found.push((
                "block-ids",
                doc.path(),
                line,
                format!(
                    "{}'s body paragraph does not end with its block ID",
                    req.ident
                ),
                Some(format!("end the paragraph with \" ^{bid}\"")),
            ));
        }

        let has_verification = doc.lines[req.at + 1..]
            .iter()
            .take_while(|l| !matches!(l.kind, Kind::Heading(_)))
            .filter(|l| !matches!(l.kind, Kind::Fence | Kind::InFence))
            .any(|l| l.text.trim_start().starts_with("- **Verification:**"));
        if !has_verification {
            found.push((
                "verification",
                doc.path(),
                req.heading().no,
                format!("{} has no verification clause", req.ident),
                Some("add a \"- **Verification:**\" list of checks below its body".into()),
            ));
        }
    }

    // block-ids for non-requirements tables, and what each requirements document defines.
    let mut defined: BTreeMap<&str, BTreeSet<String>> = BTreeMap::new();
    for req in &reqs {
        defined
            .entry(req.doc.rel.as_str())
            .or_default()
            .insert(req.ident.clone());
    }
    for doc in ctx
        .vault
        .docs
        .values()
        .filter(|d| d.rel.starts_with("requirements/"))
    {
        for table in nr_tables(doc) {
            defined
                .entry(doc.rel.as_str())
                .or_default()
                .extend(table.defines.iter().cloned());
            let want = format!("^{}-nr", block_id(&table.prefix));
            // One blank line separates the table from its block ID: on GitHub, a line directly
            // after a table is another row of it.
            let blank = doc
                .lines
                .get(table.last + 1)
                .is_some_and(|l| l.kind == Kind::Blank);
            let next = doc.lines.get(table.last + 2);
            if !blank || next.is_none_or(|l| l.kind != Kind::BlockId || l.text.trim() != want) {
                let at = table.rows.last().map(|l| l.no).unwrap_or(1);
                found.push((
                    "block-ids",
                    doc.path(),
                    at,
                    "the non-requirements table is not followed by its block ID line".into(),
                    Some(format!(
                        "add the line {want} after the table, with one blank line between them"
                    )),
                ));
            }
        }
    }

    // identifiers and unprefixed.
    let owners = ctx.reg.owners();
    for doc in ctx.vault.docs.values() {
        let own_prefix = ctx.reg.prefix_of(&doc.rel);
        for line in doc.read_lines() {
            let chars = line.without_targets();
            for ident in markdown::identifiers(&chars) {
                let Some(owner) = owners.get(&ident.prefix) else {
                    found.push((
                        "identifiers",
                        doc.path(),
                        line.no,
                        format!("{}'s prefix {} is not registered", ident.text, ident.prefix),
                        None,
                    ));
                    continue;
                };
                if ctx.vault.doc(owner).is_none() {
                    found.push((
                        "identifiers",
                        doc.path(),
                        line.no,
                        format!(
                            "{} cites {}, which does not exist",
                            ident.text,
                            repo_path(owner)
                        ),
                        None,
                    ));
                } else if !defined
                    .get(owner.as_str())
                    .is_some_and(|d| d.contains(&ident.text))
                {
                    found.push((
                        "identifiers",
                        doc.path(),
                        line.no,
                        format!("{} does not define {}", repo_path(owner), ident.text),
                        None,
                    ));
                }
            }

            let prose = line.prose();
            let bold = markdown::bold_ranges(&prose);
            let parens = markdown::in_parens(line);
            let heading = matches!(line.kind, Kind::Heading(_));
            for (start, end) in markdown::unprefixed(&chars) {
                let in_bold = bold.iter().any(|&(a, b)| start >= a && end <= b);
                let placed = heading || line.scan.code[start] || in_bold || parens[start];
                if placed {
                    let token: String = chars[start..end].iter().collect();
                    found.push((
                        "unprefixed",
                        doc.path(),
                        line.no,
                        format!("identifier {token} has no prefix"),
                        own_prefix.as_ref().map(|p| format!("write {p}-{token}")),
                    ));
                }
            }
        }
    }

    // claims.
    let mut claimed = BTreeSet::new();
    for doc in ctx
        .vault
        .docs
        .values()
        .filter(|d| d.rel.starts_with("spec/"))
    {
        let Some(at) = doc.lines.iter().position(|l| {
            l.kind == Kind::Heading(2) && l.heading_text() == Some("7. Requirements this satisfies")
        }) else {
            continue;
        };
        let Some(table) = table_after(doc, at + 1, 2) else {
            continue;
        };
        for row in table.rows {
            let Some(&(a, b)) = row.cells().first() else {
                continue;
            };
            let chars = row.without_targets();
            for ident in markdown::identifiers(&chars[a..b]) {
                claimed.insert(ident.text);
            }
        }
    }
    for req in &reqs {
        if !claimed.contains(&req.ident) {
            found.push((
                "claims",
                req.doc.path(),
                req.heading().no,
                format!("no specification's claim table cites {}", req.ident),
                Some("claim it in section 7 of the specification that contributes to it".into()),
            ));
        }
    }

    for (rule, path, line, text, pass) in found {
        ctx.report(rule, path, line, text, pass);
    }
}
