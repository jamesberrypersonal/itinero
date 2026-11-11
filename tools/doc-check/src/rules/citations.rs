//! §4.3.17 sections, §4.3.18 live-list-citations and §4.3.19 live-list-shape.

use super::{Ctx, resolved};
use crate::markdown::{self, Kind, Line};
use crate::tables::item_heading;
use crate::vault::{Doc, repo_path};

pub fn check(ctx: &mut Ctx) {
    let mut found: Vec<(&'static str, String, usize, String, Option<String>)> = Vec::new();
    for doc in ctx.vault.docs.values() {
        sections(ctx, doc, &mut found);
        live_list_citations(ctx, doc, &mut found);
    }
    live_list_shape(ctx, &mut found);
    for (rule, path, line, text, pass) in found {
        ctx.report(rule, path, line, text, pass);
    }
}

/// Every document a line names, by a link or a document mention, with its position.
fn named(doc: &Doc, line: &Line) -> Vec<(usize, String)> {
    let mut out = Vec::new();
    for link in &line.scan.links {
        if let Some(p) = resolved(doc, link).filter(|p| p.ends_with(".md")) {
            out.push((link.start, p));
        }
    }
    for span in &line.scan.spans {
        if let Some(p) = markdown::document_mention(&span.content) {
            out.push((span.start, p.to_string()));
        }
    }
    out.sort();
    out
}

fn sections(
    ctx: &Ctx,
    doc: &Doc,
    found: &mut Vec<(&'static str, String, usize, String, Option<String>)>,
) {
    let mut block = 0;
    let mut last_in_block: Option<String> = None;
    for line in doc.read_lines() {
        if line.block != block {
            block = line.block;
            last_in_block = None;
        }
        let names = named(doc, line);
        let table = matches!(line.kind, Kind::TableRow);
        let cells = if table { line.cells() } else { Vec::new() };
        for (at, number) in markdown::section_citations(&line.prose()) {
            let before = |from: usize| {
                names
                    .iter()
                    .rfind(|(p, _)| *p < at && *p >= from)
                    .map(|(_, d)| d.clone())
            };
            let cited = if table {
                let cell = cells
                    .iter()
                    .find(|(a, b)| at >= *a && at < *b)
                    .copied()
                    .unwrap_or((0, 0));
                before(cell.0)
            } else {
                before(0).or_else(|| {
                    if line.kind == Kind::Text {
                        last_in_block.clone()
                    } else {
                        None
                    }
                })
            };
            let cited = cited.unwrap_or_else(|| doc.rel.clone());
            match ctx.vault.doc(&cited) {
                None => found.push((
                    "sections",
                    doc.path(),
                    line.no,
                    format!(
                        "§{number} cites {}, which does not exist",
                        repo_path(&cited)
                    ),
                    None,
                )),
                Some(target) if target.sections.is_empty() => found.push((
                    "sections",
                    doc.path(),
                    line.no,
                    format!(
                        "§{number} cites {}, which numbers no sections",
                        repo_path(&cited)
                    ),
                    None,
                )),
                Some(target) if !target.sections.contains(&number) => found.push((
                    "sections",
                    doc.path(),
                    line.no,
                    format!(
                        "§{number} cites {}, which numbers no section {number}",
                        repo_path(&cited)
                    ),
                    None,
                )),
                _ => {}
            }
        }
        if line.kind == Kind::Text
            && let Some((_, d)) = names.last()
        {
            last_in_block = Some(d.clone());
        }
    }
}

/// The positions of item citations that sit in a condition, such as `until TODO-3 is done`.
fn conditions(chars: &[char]) -> Vec<usize> {
    let mut ok = Vec::new();
    // Positions are character indices, so work on a character vector throughout.
    let at = |i: usize, s: &str| -> bool {
        let w: Vec<char> = s.chars().collect();
        chars.len() >= i + w.len() && chars[i..i + w.len()] == w[..]
    };
    let item = |i: usize| -> Option<usize> {
        if !at(i, "TODO-") {
            return None;
        }
        let digits = chars[i + 5..]
            .iter()
            .take_while(|c| c.is_ascii_digit())
            .count();
        (digits > 0).then_some(i + 5 + digits)
    };
    for i in 0..chars.len() {
        if !at(i, "until ") || (i > 0 && chars[i - 1].is_alphanumeric()) {
            continue;
        }
        let mut j = i + 6;
        let mut items = Vec::new();
        let Some(end) = item(j) else { continue };
        items.push(j);
        j = end;
        while at(j, " and ") {
            match item(j + 5) {
                Some(end) => {
                    items.push(j + 5);
                    j = end;
                }
                None => break,
            }
        }
        if at(j, " is done") || at(j, " are done") {
            ok.extend(items);
        }
    }
    ok
}

fn live_list_citations(
    ctx: &Ctx,
    doc: &Doc,
    found: &mut Vec<(&'static str, String, usize, String, Option<String>)>,
) {
    let may_link = doc.rel == "documentation-system.md" || doc.rel == "CHANGELOG.md";
    let cites_freely = may_link || doc.rel == "TODO.md";
    for line in doc.read_lines() {
        if !may_link {
            for link in &line.scan.links {
                if resolved(doc, link).as_deref() == Some("TODO.md") {
                    found.push((
                        "live-list-citations",
                        doc.path(),
                        line.no,
                        "the document links to the live list".into(),
                        Some("say what is owed in the document itself, or cite an item as a condition".into()),
                    ));
                }
            }
        }
        if cites_freely {
            continue;
        }
        let chars = line.without_targets();
        let mut valid = conditions(&chars);
        if doc.rel.starts_with("roadmap/") {
            for (at, _) in markdown::numbered(&chars, "TODO-", None) {
                let before: String = chars[..at].iter().collect();
                if before.ends_with("Do ") {
                    valid.push(at);
                }
            }
        }
        for (at, n) in markdown::numbered(&chars, "TODO-", None) {
            if !valid.contains(&at) {
                found.push((
                    "live-list-citations",
                    doc.path(),
                    line.no,
                    format!("TODO-{n} is cited other than as a condition"),
                    Some(format!("write \"until TODO-{n} is done\", or say what is owed in the document itself")),
                ));
            } else if !ctx.list.holds(n.parse().unwrap_or(0)) {
                found.push((
                    "live-list-citations",
                    doc.path(),
                    line.no,
                    format!("TODO-{n} names no item the live list holds or the changelog records"),
                    None,
                ));
            }
        }
    }
}

fn live_list_shape(
    ctx: &Ctx,
    found: &mut Vec<(&'static str, String, usize, String, Option<String>)>,
) {
    let Some(doc) = ctx.vault.doc("TODO.md") else {
        return;
    };
    let path = doc.path();
    let tags: Vec<String> = ctx
        .list
        .tags
        .as_ref()
        .map(|(_, rows)| rows.iter().map(|(t, _)| t.clone()).collect())
        .unwrap_or_default();
    let lines: Vec<&Line> = doc.read_lines().collect();
    for (i, line) in lines.iter().enumerate() {
        if line.kind != Kind::Heading(3) {
            continue;
        }
        let text = line.heading_text().unwrap_or("");
        if item_heading(text).is_none() {
            found.push((
                "live-list-shape",
                path.clone(),
                line.no,
                format!("item heading \"{text}\" is not TODO-<number> — <title>"),
                Some("write the heading as ### TODO-<number> — <title>".into()),
            ));
        }
        let body: Vec<&&Line> = lines[i + 1..]
            .iter()
            .take_while(|l| !matches!(l.kind, Kind::Heading(1..=3)))
            .collect();
        let starts = |label: &str| body.iter().find(|l| l.text.trim_start().starts_with(label));
        match starts("*Tags:*") {
            None => found.push((
                "live-list-shape",
                path.clone(),
                line.no,
                "the item has no *Tags:* line".into(),
                Some("add a *Tags:* line after its heading".into()),
            )),
            Some(tag_line) => {
                let list = tag_line.text.trim_start().trim_start_matches("*Tags:*");
                for tag in list
                    .split(',')
                    .map(|t| t.trim().trim_matches('`'))
                    .filter(|t| !t.is_empty())
                {
                    if !tags.iter().any(|t| t == tag) {
                        found.push((
                            "live-list-shape",
                            path.clone(),
                            tag_line.no,
                            format!("tag {tag} is not in the list's Tags table"),
                            Some(format!(
                                "add a row for {tag} to the Tags table before using it"
                            )),
                        ));
                    }
                }
            }
        }
        for label in ["*Problem:*", "*Reason:*", "*Proposal:*", "*Releases:*"] {
            if starts(label).is_none() {
                found.push((
                    "live-list-shape",
                    path.clone(),
                    line.no,
                    format!("the item has no paragraph opening with {label}"),
                    Some(format!("add its {label} paragraph")),
                ));
            }
        }
    }
    let highest = ctx
        .list
        .items
        .iter()
        .chain(&ctx.list.changelog)
        .max()
        .copied()
        .unwrap_or(0);
    match lines
        .iter()
        .find(|l| l.text.trim_start().starts_with("*Next free:*"))
    {
        None => found.push((
            "live-list-shape",
            path,
            1,
            "the list has no *Next free:* line".into(),
            Some(format!("add the line *Next free:* TODO-{}", highest + 1)),
        )),
        Some(line) => {
            let next = markdown::numbered(&line.without_targets(), "TODO-", None)
                .first()
                .and_then(|(_, n)| n.parse::<u64>().ok());
            if next.is_none_or(|n| n <= highest) {
                found.push((
                    "live-list-shape",
                    path,
                    line.no,
                    format!("the next free number is not past TODO-{highest}, the highest used"),
                    Some(format!("write *Next free:* TODO-{}", highest + 1)),
                ));
            }
        }
    }
}
