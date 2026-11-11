//! §4.3.13 adr-citations, §4.3.14 adr-scopes, §4.3.15 decision-index and §4.3.16 back-citations.

use super::{Ctx, resolved};
use crate::markdown::{self, Kind};
use crate::tables::{Record, cell_value, table_after};
use crate::vault::repo_path;
use std::collections::{BTreeMap, BTreeSet};

pub fn check(ctx: &mut Ctx) {
    let mut found: Vec<(&'static str, String, usize, String, Option<String>)> = Vec::new();
    let numbers: BTreeSet<&str> = ctx.records.values().map(|r| r.number.as_str()).collect();

    // adr-citations.
    for doc in ctx.vault.docs.values() {
        for line in doc.read_lines() {
            for (_, n) in markdown::numbered(&line.without_targets(), "ADR-", Some(4)) {
                if !numbers.contains(n.as_str()) {
                    found.push((
                        "adr-citations",
                        doc.path(),
                        line.no,
                        format!("ADR-{n} names no record in docs/decisions/"),
                        None,
                    ));
                }
            }
        }
    }

    // adr-scopes.
    let addresses = ctx.reg.addresses();
    for record in ctx.records.values() {
        match &record.scope {
            None => found.push((
                "adr-scopes",
                repo_path(&record.rel),
                1,
                "the record has no Scope line".into(),
                Some(
                    "add a \"- **Scope:**\" line naming registered addresses, or workspace".into(),
                ),
            )),
            Some((entries, line)) => {
                for e in entries {
                    if e != "workspace" && !addresses.contains(e) {
                        found.push((
                            "adr-scopes",
                            repo_path(&record.rel),
                            *line,
                            format!("scope {e} is not a registered address, or workspace"),
                            None,
                        ));
                    }
                }
            }
        }
    }

    decision_index(ctx, &mut found);
    back_citations(ctx, &mut found);

    for (rule, path, line, text, pass) in found {
        ctx.report(rule, path, line, text, pass);
    }
}

struct Row {
    line: usize,
    record: Option<String>,
    number: String,
    title: String,
    scope: Option<Vec<String>>,
    status: String,
}

fn read_rows(
    ctx: &Ctx,
    doc: &crate::vault::Doc,
    from: usize,
    level: u8,
    header: &[&str],
) -> Option<Vec<Row>> {
    let table = table_after(doc, from, level)?;
    if table.header != header {
        return None;
    }
    let mut rows = Vec::new();
    for line in table.rows {
        let cells = line.cells();
        let get = |i: usize| {
            cells
                .get(i)
                .map(|&c| cell_value(line, c))
                .unwrap_or_default()
        };
        let link = cells
            .first()
            .and_then(|&(a, b)| line.scan.links.iter().find(|l| l.start >= a && l.end <= b));
        let record = link
            .and_then(|l| resolved(doc, l))
            .filter(|p| ctx.records.contains_key(p));
        let with_scope = header.len() == 4;
        rows.push(Row {
            line: line.no,
            record,
            number: get(0),
            title: get(1),
            scope: with_scope.then(|| {
                get(2)
                    .split(',')
                    .map(|s| s.trim().to_string())
                    .filter(|s| !s.is_empty())
                    .collect()
            }),
            status: get(if with_scope { 3 } else { 2 }),
        });
    }
    Some(rows)
}

fn compare(
    record: &Record,
    row: &Row,
    path: &str,
    found: &mut Vec<(&'static str, String, usize, String, Option<String>)>,
) {
    let mut differs = Vec::new();
    if row.number != record.number
        || record.heading_number.as_deref() != Some(record.number.as_str())
    {
        differs.push(format!(
            "number {} (the record's filename says {}, its heading {})",
            row.number,
            record.number,
            record.heading_number.as_deref().unwrap_or("nothing")
        ));
    }
    if record.title.as_deref() != Some(row.title.as_str()) {
        differs.push(format!(
            "title \"{}\" (the record says \"{}\")",
            row.title,
            record.title.as_deref().unwrap_or("")
        ));
    }
    if let Some(scope) = &row.scope {
        let want = record
            .scope
            .as_ref()
            .map(|(s, _)| s.clone())
            .unwrap_or_default();
        if *scope != want {
            differs.push(format!(
                "scope {} (the record says {})",
                scope.join(", "),
                want.join(", ")
            ));
        }
    }
    let status = record
        .status
        .as_ref()
        .map(|(s, _)| s.as_str())
        .unwrap_or("");
    if row.status != status {
        differs.push(format!("status {} (the record says {status})", row.status));
    }
    for d in differs {
        found.push((
            "decision-index",
            path.to_string(),
            row.line,
            format!("the row for {} has {d}", repo_path(&record.rel)),
            Some("make the row match the record".into()),
        ));
    }
}

fn decision_index(
    ctx: &Ctx,
    found: &mut Vec<(&'static str, String, usize, String, Option<String>)>,
) {
    if ctx.records.is_empty() && ctx.vault.doc("decisions/README.md").is_none() {
        return;
    }
    let index = ctx.vault.doc("decisions/README.md");
    let path = "docs/decisions/README.md";
    let ledger = index.and_then(|doc| {
        let at = doc.lines.iter().position(|l| {
            l.kind == Kind::TableRow
                && l.cells()
                    .into_iter()
                    .map(|c| l.cell_text(c))
                    .collect::<Vec<_>>()
                    == ["ADR", "Title", "Scope", "Status"]
        })?;
        read_rows(ctx, doc, at, 1, &["ADR", "Title", "Scope", "Status"])
    });
    let mut subjects: BTreeMap<String, Vec<Row>> = BTreeMap::new();
    if let Some(doc) = index {
        for (i, line) in doc.lines.iter().enumerate() {
            if line.kind == Kind::Heading(3)
                && let Some(rows) = read_rows(ctx, doc, i + 1, 3, &["ADR", "Title", "Status"])
            {
                subjects.insert(line.heading_text().unwrap_or("").to_string(), rows);
            }
        }
    }

    let ledger = ledger.unwrap_or_default();
    for record in ctx.records.values() {
        if !ledger
            .iter()
            .any(|r| r.record.as_deref() == Some(record.rel.as_str()))
        {
            found.push((
                "decision-index",
                repo_path(&record.rel),
                1,
                "the decision index's ledger does not list this record".into(),
                Some(format!("add a row for it to {path}")),
            ));
        }
        for address in record
            .scope
            .as_ref()
            .map(|(s, _)| s.as_slice())
            .unwrap_or(&[])
        {
            let listed = subjects.get(address).is_some_and(|rows| {
                rows.iter()
                    .any(|r| r.record.as_deref() == Some(record.rel.as_str()))
            });
            if !listed {
                found.push((
                    "decision-index",
                    repo_path(&record.rel),
                    1,
                    format!("the decision index does not list this record under {address}"),
                    Some(format!("add a row for it under ### {address} in {path}")),
                ));
            }
        }
        if let Some((status, line)) = &record.status
            && let Some(target) = status.strip_prefix("Superseded by ADR-")
            && !ctx.records.values().any(|r| r.number == target.trim())
        {
            found.push((
                "decision-index",
                repo_path(&record.rel),
                *line,
                format!("status names ADR-{}, which does not exist", target.trim()),
                None,
            ));
        }
    }
    for row in &ledger {
        match row.record.as_ref().and_then(|r| ctx.records.get(r)) {
            None => found.push((
                "decision-index",
                path.into(),
                row.line,
                format!("ledger row {} links to no record", row.number),
                None,
            )),
            Some(record) => compare(record, row, path, found),
        }
    }
    for (address, rows) in &subjects {
        for row in rows {
            let Some(record) = row.record.as_ref().and_then(|r| ctx.records.get(r)) else {
                found.push((
                    "decision-index",
                    path.into(),
                    row.line,
                    format!("row {} under {address} links to no record", row.number),
                    None,
                ));
                continue;
            };
            compare(record, row, path, found);
            let scoped = record
                .scope
                .as_ref()
                .is_some_and(|(s, _)| s.contains(address));
            if !scoped {
                found.push((
                    "decision-index",
                    path.into(),
                    row.line,
                    format!(
                        "{} is listed under {address}, which its scope does not name",
                        repo_path(&record.rel)
                    ),
                    None,
                ));
            }
        }
    }
}

fn back_citations(
    ctx: &Ctx,
    found: &mut Vec<(&'static str, String, usize, String, Option<String>)>,
) {
    for record in ctx.records.values() {
        if record.status.as_ref().map(|(s, _)| s.as_str()) != Some("Accepted") {
            continue;
        }
        let Some(doc) = ctx.vault.doc(&record.rel) else {
            continue;
        };
        let mut named: Vec<(String, usize)> = Vec::new();
        for line in doc
            .lines
            .iter()
            .filter(|l| record.consequences.contains(&l.no))
        {
            for link in &line.scan.links {
                if let Some(p) =
                    resolved(doc, link).filter(|p| p.starts_with("spec/") && p.ends_with(".md"))
                {
                    named.push((p, line.no));
                }
            }
            for span in &line.scan.spans {
                if let Some(p) =
                    markdown::document_mention(&span.content).filter(|p| p.starts_with("spec/"))
                {
                    named.push((p.to_string(), line.no));
                }
            }
        }
        for (spec, line) in named {
            let Some(spec_doc) = ctx.vault.doc(&spec) else {
                continue;
            };
            let cites = spec_doc.read_lines().any(|l| {
                l.scan
                    .links
                    .iter()
                    .any(|k| resolved(spec_doc, k).as_deref() == Some(record.rel.as_str()))
                    || markdown::numbered(&l.without_targets(), "ADR-", Some(4))
                        .iter()
                        .any(|(_, n)| *n == record.number)
            });
            if !cites {
                found.push((
                    "back-citations",
                    repo_path(&record.rel),
                    line,
                    format!(
                        "{} does not cite ADR-{} back",
                        repo_path(&spec),
                        record.number
                    ),
                    Some(format!(
                        "cite ADR-{} in {}",
                        record.number,
                        repo_path(&spec)
                    )),
                ));
            }
        }
    }
}
