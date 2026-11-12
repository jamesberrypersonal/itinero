//! The five commands of §4.3 to §4.7. Each checks everything it refuses, then plans its changes.

use crate::date;
use crate::md::{File, Table};
use crate::plan::{Plan, insert_block};
use crate::registry::Registry;
use std::path::Path;

/// The marker every part an author still has to write opens with (§4.1).
pub const MARK: &str = "To be written";

// ---- Checks shared by the commands (§4.2) ----

/// Lower-case letters and digits, in runs joined by single hyphens.
pub fn is_slug(s: &str) -> bool {
    !s.is_empty()
        && s.split('-').all(|run| {
            !run.is_empty()
                && run
                    .chars()
                    .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit())
        })
}

fn slug(kind: &str, s: &str) -> Result<(), String> {
    if is_slug(s) {
        Ok(())
    } else {
        Err(format!(
            "the {kind} slug {s:?} is not lower-case letters and digits joined by hyphens"
        ))
    }
}

/// One line of text for a table cell or a heading: no line break, no pipe, no `<`, and backticks
/// in pairs, so it cannot break a table or hold raw HTML or an unclosed code span.
fn line_of_text(what: &str, s: &str) -> Result<(), String> {
    let bad = if s.trim().is_empty() {
        Some("is empty")
    } else if s.contains('\n') {
        Some("holds a line break")
    } else if s.contains('|') {
        Some("holds a pipe, which would end a table cell")
    } else if s.contains('<') {
        Some("holds a <, which a renderer can read as HTML")
    } else if s.matches('`').count() % 2 == 1 {
        Some("holds an unclosed code span")
    } else {
        None
    };
    match bad {
        Some(why) => Err(format!("the {what} {s:?} {why}")),
        None => Ok(()),
    }
}

fn capitalise(s: &str) -> String {
    let mut c = s.chars();
    match c.next() {
        Some(first) => first.to_uppercase().chain(c).collect(),
        None => String::new(),
    }
}

/// A prefix written as a block ID: lower case, with its colon as a hyphen.
fn block_id(prefix: &str) -> String {
    prefix.to_lowercase().replace(':', "-")
}

/// Every accepted decision record whose Consequences name the specification at `spec`, such as
/// `spec/shared/trip-time.md`, as `ADR-0007`. Each must be cited back by that specification, so a
/// skeleton written for it cites them, and adds no finding (`SHR:DOC-SCAFFOLD-F2`).
fn records_naming(root: &Path, spec: &str) -> Vec<String> {
    let Ok(entries) = std::fs::read_dir(root.join("docs/decisions")) else {
        return Vec::new();
    };
    let mut out = Vec::new();
    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();
        let Some(number) = name
            .get(..4)
            .filter(|n| n.chars().all(|c| c.is_ascii_digit()))
        else {
            continue;
        };
        if !name.ends_with(".md") || name.as_bytes().get(4) != Some(&b'-') {
            continue;
        }
        let Ok(text) = std::fs::read_to_string(entry.path()) else {
            continue;
        };
        let file = File::parse(&text);
        let accepted = file
            .lines
            .iter()
            .any(|l| l.trim() == "- **Status:** Accepted");
        let names = file.heading(2, "Consequences").is_some_and(|at| {
            file.lines[at..file.section_end(at)]
                .iter()
                .any(|l| l.contains(spec))
        });
        if accepted && names {
            out.push(format!("ADR-{number}"));
        }
    }
    out.sort();
    out
}

// ---- Edits shared by the commands ----

/// Inserts `row` into `table` before the first body row that `after` says it sorts before, or
/// after the last row.
fn insert_row(file: &mut File, table: Table, row: String, before: impl Fn(&str) -> bool) {
    let at = table
        .rows()
        .find(|&i| before(&file.lines[i]))
        .unwrap_or(table.end);
    file.insert(at, &[row]);
}

/// Adds the address's row to the live list's Tags table, among the registered addresses in
/// alphabetical order. A vault with no live list has no table to add to (§4.2).
fn add_tag(
    plan: &mut Plan,
    addresses: &[String],
    address: &str,
    means: &str,
) -> Result<(), String> {
    if !plan.exists("TODO.md") {
        return Ok(());
    }
    let file = plan.edit("TODO.md")?;
    let table = file
        .table_under(2, "Tags")
        .ok_or("docs/TODO.md has no Tags table")?;
    let is_address = |tag: &str| addresses.iter().any(|a| a == tag);
    let first_col = |line: &str| crate::md::cells(line).first().map(|c| crate::md::value(c));
    let at = table
        .rows()
        .find(|&i| {
            first_col(&file.lines[i]).is_some_and(|t| is_address(&t) && t.as_str() > address)
        })
        .or_else(|| {
            table
                .rows()
                .rev()
                .find(|&i| first_col(&file.lines[i]).is_some_and(|t| is_address(&t)))
                .map(|i| i + 1)
        })
        .unwrap_or(table.end);
    file.insert(at, &[format!("| {address} | {means} |")]);
    Ok(())
}

/// Adds a document's row to its folder's index in `tree`, creating the folder's index, and its
/// row in the tree's index, when the folder is new (§4.3).
fn add_to_index(
    plan: &mut Plan,
    reg: &Registry,
    tree: &str,
    system: &str,
    doc_row: String,
    doc_name: &str,
) -> Result<(), String> {
    let folder_index = format!("{tree}/{system}/README.md");
    if plan.exists(&folder_index) {
        let file = plan.edit(&folder_index)?;
        let table = file
            .table_between(0, file.lines.len())
            .ok_or(format!("docs/{folder_index} has no table"))?;
        // A row the index already holds for the document is kept, and not added twice.
        let listed = table.rows().any(|i| {
            crate::md::cells(&file.lines[i])
                .first()
                .is_some_and(|c| crate::md::value(c) == doc_name)
        });
        if listed {
            return Ok(());
        }
        insert_row(file, table, doc_row, |line| {
            crate::md::cells(line)
                .first()
                .is_some_and(|c| crate::md::value(c).as_str() > doc_name)
        });
        return Ok(());
    }
    let name = capitalise(system);
    let text = if tree == "requirements" {
        format!(
            "# {name} requirements\n\nWhat the {system} system and its components promise.\n\n\
             | Document | Promises about | Verified |\n|---|---|---|\n{doc_row}\n"
        )
    } else {
        format!(
            "# {name} specifications\n\nHow the {system} system's components are built.\n\n\
             | Document | Is | Runs |\n|---|---|---|\n{doc_row}\n\n\
             {MARK}: which of these documents are programs, which are artefacts, and which\n\
             are anything else.\n"
        )
    };
    plan.create(&folder_index, &text)?;

    let tree_index = format!("{tree}/README.md");
    let is = reg.system(system).map(|s| s.is.clone()).unwrap_or_default();
    let file = plan.edit(&tree_index)?;
    let table = (0..file.lines.len())
        .find(|&i| file.lines[i].starts_with("| Folder |"))
        .and_then(|i| file.table_between(i, file.lines.len()))
        .ok_or(format!("docs/{tree_index} has no table of folders"))?;
    let key = |folder: &str| match folder.trim_end_matches('/') {
        "shared" => reg.systems.len(),
        "concerns" => reg.systems.len() + 1,
        f => reg.order(f),
    };
    let new_key = key(system);
    insert_row(
        file,
        table,
        format!("| [{system}/]({system}/README.md) | {is} |"),
        |line| {
            crate::md::cells(line)
                .first()
                .is_some_and(|c| key(&crate::md::value(c)) > new_key)
        },
    );
    Ok(())
}

// ---- §4.3: a component ----

pub fn component(
    plan: &mut Plan,
    reg: &Registry,
    root: &Path,
    system: &str,
    slug_: &str,
    prefix: &str,
    is: &str,
) -> Result<(), String> {
    slug("component", slug_)?;
    if system == "concerns" {
        return Err("a concern is not a component, and doc-scaffold does not create one".into());
    }
    let system_prefix = if system == "shared" {
        "SHR".to_string()
    } else {
        reg.system(system).map(|s| s.prefix.clone()).ok_or(format!(
            "the system {system} is not registered. Register it first, with just new-system"
        ))?
    };
    let address = format!("{system}/{slug_}");
    if reg.addresses().contains(&address) {
        return Err(format!("the component {address} is already registered"));
    }
    let name = prefix
        .strip_prefix(&format!("{system_prefix}:"))
        .ok_or(format!(
            "the prefix {prefix} does not open with {system_prefix}:, the prefix of {system}"
        ))?;
    if !(3..=12).contains(&name.len())
        || !name
            .chars()
            .all(|c| c.is_ascii_uppercase() || c.is_ascii_digit() || c == '-')
    {
        return Err(format!(
            "the prefix {prefix} does not end in three to twelve capitals, digits and hyphens"
        ));
    }
    if reg.prefixes().contains(&prefix) {
        return Err(format!("the prefix {prefix} is already registered"));
    }
    line_of_text("description", is)?;

    let req = format!("requirements/{system}/{slug_}.md");
    let spec = format!("spec/{system}/{slug_}.md");
    plan.create(&req, &requirements_text(&address, slug_, prefix))?;
    let records = records_naming(root, &spec);
    plan.create(&spec, &spec_text(reg, system, slug_, prefix, &records))?;

    // The registry: grouped by system in the Systems table's order, then shared, and by slug
    // within a system.
    let file = plan.edit("components.md")?;
    let table = file
        .table_under(2, "Components")
        .ok_or("docs/components.md has no Components table")?;
    let row = format!("| [{slug_}]({spec}) | {system} | {prefix} | | | {is} |");
    let new_key = (reg.order(system), slug_.to_string());
    let key_of = |file: &File, i: usize| {
        let sys = file.cell(table, i, "System").unwrap_or_default();
        let comp = file.cell(table, i, "Component").unwrap_or_default();
        (reg.order(&sys), comp)
    };
    let at = table
        .rows()
        .find(|&i| key_of(file, i) > new_key)
        .unwrap_or(table.end);
    file.insert(at, &[row]);

    let mut addresses = reg.addresses();
    addresses.push(address.clone());
    add_tag(plan, &addresses, &address, is)?;

    add_to_index(
        plan,
        reg,
        "requirements",
        system,
        format!("| [{slug_}.md]({slug_}.md) | {is} | {MARK} |"),
        &format!("{slug_}.md"),
    )?;
    add_to_index(
        plan,
        reg,
        "spec",
        system,
        format!("| [{slug_}.md]({slug_}.md) | {is} | {MARK} |"),
        &format!("{slug_}.md"),
    )
}

fn requirements_text(address: &str, slug: &str, prefix: &str) -> String {
    let id = block_id(prefix);
    format!(
        "# The {slug} component

What the component `{address}` promises.
{MARK}: who it makes its promises to, and what it does for them.
The component registry, `components.md`, gives it the prefix `{prefix}`.

---

## Functional requirements

### {prefix}-F1 — {MARK}: the promise, stated as a title

{MARK}: what must be true, in one or two sentences, in terms a release manager can
observe. ^{id}-f1

- **Verification:** {MARK}:
    - the first check that proves the promise is kept

> **What does this buy?** {MARK}: why the promise is worth making.

---

## Non-functional requirements

{MARK}: how well it does what it does, or a sentence saying it promises nothing of the kind.

---

## Non-requirements

| Identifier | {slug} does not | Because |
|---|---|---|
| **{prefix}-NR1** | {MARK}: something it deliberately does not do | {MARK}: why not |

^{id}-nr
"
    )
}

fn spec_text(reg: &Registry, system: &str, slug: &str, prefix: &str, records: &[String]) -> String {
    let id = block_id(prefix);
    // Accepted records that name this specification are cited back from the start.
    let cite = match records {
        [] => String::new(),
        [one] => format!(
            "\n{MARK}: cite {one} where this specification relies on it. {one} names this\nspecification in its Consequences, so the checker requires a citation of it to stay.\n"
        ),
        [rest @ .., last] => format!(
            "\n{MARK}: cite {} and {last} where this specification relies on them. Each names\nthis specification in its Consequences, so the checker requires a citation of each to stay.\n",
            rest.join(", ")
        ),
    };
    let mut sections: Vec<String> = vec![
        format!("## 1. Purpose\n\n{MARK}: what {slug} is for.\n"),
        format!(
            "## 2. Scope\n\n{MARK}: what it covers, what acts on it, and what is deliberately absent.\n{cite}"
        ),
        format!(
            "## 3. Interface

### 3.1 User interface

{MARK}, or \"None.\" and where the reader goes instead.

### 3.2 Application interface

{MARK}, or \"None.\" and where the reader goes instead.

### 3.3 Programming interface

{MARK}, or \"None.\" and where the reader goes instead.

### 3.4 Systems this drives

{MARK}, or \"None.\"
"
        ),
        format!(
            "## 4. Behaviour

{MARK}: what it does, in one subsection for each command, use case or operation that
section 3 names.
"
        ),
        format!("## 5. Resources\n\n{MARK}: what it creates or stores, and who owns it.\n"),
        format!(
            "## 6. Quality attributes

{MARK}: how fast, how safe and how reliable it is, citing the requirement each property
serves.
"
        ),
        format!(
            "## 7. Requirements this satisfies

| Requirement | What this component contributes |
|---|---|
| [{prefix}-F1](../../requirements/{system}/{slug}.md#^{id}-f1) | {MARK}. |
"
        ),
        format!("## 8. Open\n\n{MARK}, or \"None.\"\n"),
    ];
    // Each registered concern's subsection, at the end of the section it is numbered under.
    let mut concerns: Vec<(&str, &str)> = reg
        .concerns
        .iter()
        .filter_map(|c| c.section.as_deref().map(|s| (s, c.slug.as_str())))
        .collect();
    concerns.sort_by_key(|(section, slug)| {
        let number: Vec<u32> = section.split('.').map(|n| n.parse().unwrap_or(0)).collect();
        (number, *slug)
    });
    for (section, concern) in concerns {
        let level = 2 + section.matches('.').count();
        let text = format!(
            "\n{} {section} {}\n\n{MARK}: what {slug} does about {concern}, as \
             `spec/concerns/{concern}.md` sets out.\n",
            "#".repeat(level),
            capitalise(&concern.replace('-', " ")),
        );
        let top: usize = section
            .split('.')
            .next()
            .and_then(|n| n.parse().ok())
            .unwrap_or(0);
        match sections.get_mut(top.wrapping_sub(1)) {
            Some(s) if level > 2 => s.push_str(&text),
            _ => sections.push(text.trim_start().to_string()),
        }
    }
    format!(
        "# The {slug} component\n\n**Assumes** [{slug}.md](../../requirements/{system}/{slug}.md) — \
         what it promises.\n\n{}",
        sections.join("\n")
    )
}

// ---- §4.7: the documents of a registered component ----

pub fn docs(
    plan: &mut Plan,
    reg: &Registry,
    root: &Path,
    system: &str,
    slug_: &str,
) -> Result<(), String> {
    slug("component", slug_)?;
    if system == "concerns" {
        return Err(
            "a concern is not a component, and doc-scaffold does not start its documents".into(),
        );
    }
    let address = format!("{system}/{slug_}");
    let component = reg
        .components
        .iter()
        .find(|c| c.system == system && c.slug == slug_)
        .ok_or(format!(
            "the component {address} is not registered. Start a new component with just new-component"
        ))?;
    let (prefix, is) = (component.prefix.clone(), component.is.clone());
    let id = block_id(&prefix);
    let req = format!("requirements/{system}/{slug_}.md");
    let spec = format!("spec/{system}/{slug_}.md");
    let (has_req, has_spec) = (plan.exists(&req), plan.exists(&spec));
    if has_req && has_spec {
        return Err(format!(
            "{address} already has both its documents, docs/{req} and docs/{spec}"
        ));
    }
    // A skeleton beside a document that exists ties to it through F1: the specification's claim
    // table claims F1, and the requirements document defines it. Without F1 in the existing
    // document, the skeleton would add a finding (`SHR:DOC-SCAFFOLD-F2`).
    if has_req && !plan.edit(&req)?.text().contains(&format!("^{id}-f1")) {
        return Err(format!(
            "docs/{req} holds no {prefix}-F1 for the new specification to claim"
        ));
    }
    if has_spec && !plan.edit(&spec)?.text().contains(&format!("#^{id}-f1)")) {
        return Err(format!(
            "docs/{spec} claims no {prefix}-F1 for the new requirements document to define"
        ));
    }
    line_of_text("description in the registry", &is)?;

    if !has_req {
        plan.create(&req, &requirements_text(&address, slug_, &prefix))?;
        add_to_index(
            plan,
            reg,
            "requirements",
            system,
            format!("| [{slug_}.md]({slug_}.md) | {is} | {MARK} |"),
            &format!("{slug_}.md"),
        )?;
    }
    if !has_spec {
        let records = records_naming(root, &spec);
        plan.create(&spec, &spec_text(reg, system, slug_, &prefix, &records))?;
        add_to_index(
            plan,
            reg,
            "spec",
            system,
            format!("| [{slug_}.md]({slug_}.md) | {is} | {MARK} |"),
            &format!("{slug_}.md"),
        )?;
        link_in_registry(plan, system, slug_, &spec)?;
    }

    // Every registered address has a Tags row already, unless the vault broke that rule.
    let has_tag = plan.exists("TODO.md") && {
        let file = plan.edit("TODO.md")?;
        file.table_under(2, "Tags").is_some_and(|t| {
            t.rows().any(|i| {
                crate::md::cells(&file.lines[i])
                    .first()
                    .is_some_and(|c| crate::md::value(c) == address)
            })
        })
    };
    if !has_tag {
        add_tag(plan, &reg.addresses(), &address, &is)?;
    }
    Ok(())
}

/// Links a component's slug in the registry's Components table to its specification, where the
/// slug is not linked already. It is the one existing line doc-scaffold changes
/// (`SHR:DOC-SCAFFOLD-F4`).
fn link_in_registry(plan: &mut Plan, system: &str, slug_: &str, spec: &str) -> Result<(), String> {
    let file = plan.edit("components.md")?;
    let Some(table) = file.table_under(2, "Components") else {
        return Ok(()); // A booking kind sits in its own table, and stays unlinked.
    };
    let col = file
        .header(table)
        .iter()
        .position(|h| h == "Component")
        .ok_or("docs/components.md has no Component column")?;
    let row = table.rows().find(|&i| {
        file.cell(table, i, "System").as_deref() == Some(system)
            && file.cell(table, i, "Component").as_deref() == Some(slug_)
    });
    let Some(row) = row else {
        return Ok(());
    };
    let mut cells = crate::md::cells(&file.lines[row]);
    if cells[col].contains("](") {
        return Ok(());
    }
    cells[col] = format!("[{slug_}]({spec})");
    let mut line = String::from("|");
    for cell in cells {
        if cell.is_empty() {
            line.push_str(" |");
        } else {
            line.push_str(&format!(" {cell} |"));
        }
    }
    file.replace(row, line);
    Ok(())
}

// ---- §4.4: a system ----

pub fn system(
    plan: &mut Plan,
    reg: &Registry,
    slug_: &str,
    prefix: &str,
    is: &str,
    kept_by: &str,
) -> Result<(), String> {
    slug("system", slug_)?;
    if slug_ == "shared" || slug_ == "concerns" {
        return Err(format!(
            "{slug_} is a folder, and never the slug of a system"
        ));
    }
    if reg.system(slug_).is_some() {
        return Err(format!("the system {slug_} is already registered"));
    }
    if !(2..=4).contains(&prefix.len()) || !prefix.chars().all(|c| c.is_ascii_uppercase()) {
        return Err(format!(
            "the prefix {prefix} is not two to four capital letters"
        ));
    }
    if prefix == "SHR" || reg.prefixes().contains(&prefix) {
        return Err(format!("the prefix {prefix} is already in use"));
    }
    line_of_text("description", is)?;
    line_of_text("keeper", kept_by)?;

    let roadmap = format!("roadmap/{slug_}.md");
    let name = capitalise(slug_);
    plan.create(
        &roadmap,
        &format!(
            "# The {slug_} system's roadmap

**Kept by:** {kept_by}

{is}.
{MARK}: what Phase 0 does, and what this system waits on from other systems.

## Completed

### Phase 0 — Design

#### Milestone {name}-0.1 — {MARK}

- The {slug_} system is registered.

## Pending

### Phase 0 — Design

#### Milestone {name}-0.1 — {MARK}

- {MARK}: the first piece of work, in a sentence that summarises it.
"
        ),
    )?;

    let file = plan.edit("components.md")?;
    let table = file
        .table_under(2, "Systems")
        .ok_or("docs/components.md has no Systems table")?;
    file.insert(table.end, &[format!("| {slug_} | {prefix} | | {is} |")]);

    let file = plan.edit("roadmap/README.md")?;
    let table = file
        .table_between(0, file.lines.len())
        .ok_or("docs/roadmap/README.md has no table")?;
    file.insert(
        table.end,
        &[format!("| [{slug_}.md]({slug_}.md) | {is} | {kept_by} |")],
    );

    let mut addresses = reg.addresses();
    addresses.push(slug_.to_string());
    add_tag(plan, &addresses, slug_, is)
}

// ---- §4.5: a decision record ----

/// A title as a slug: lower-case words joined by hyphens, dropping everything else.
pub fn slug_of(title: &str) -> String {
    title
        .to_lowercase()
        .split(|c: char| !c.is_ascii_alphanumeric())
        .filter(|w| !w.is_empty())
        .collect::<Vec<_>>()
        .join("-")
}

pub fn decision(
    plan: &mut Plan,
    reg: &Registry,
    root: &std::path::Path,
    title: &str,
    scopes: &[String],
    slug_: Option<&str>,
    date: Option<&str>,
) -> Result<(), String> {
    line_of_text("title", title)?;
    let addresses = reg.addresses();
    if scopes.is_empty() {
        return Err(
            "a decision record needs a scope: workspace, or one or more registered addresses"
                .into(),
        );
    }
    for (n, s) in scopes.iter().enumerate() {
        if scopes[..n].contains(s) {
            return Err(format!("the scope {s} is named twice"));
        }
        if s != "workspace" && !addresses.contains(s) {
            return Err(format!(
                "the scope {s} is neither workspace nor a registered address"
            ));
        }
        if s == "workspace" && scopes.len() > 1 {
            return Err(
                "workspace binds everything, so it is the only scope a record names".into(),
            );
        }
        if let Some((system, _)) = s.split_once('/')
            && scopes.iter().any(|t| t == system)
        {
            return Err(format!(
                "the scope names both the system {system} and its component {s}. A record binding a \
                 system binds it as a whole, so name the system alone"
            ));
        }
    }
    let slug_ = slug_.map(str::to_string).unwrap_or_else(|| slug_of(title));
    slug("record", &slug_)?;
    let date = match date {
        Some(d) if date::is_date(d) => d.to_string(),
        Some(d) => {
            return Err(format!(
                "the date {d} is not a real date written YYYY-MM-DD"
            ));
        }
        None => date::today(),
    };

    let dir = root.join("docs/decisions");
    let entries =
        std::fs::read_dir(&dir).map_err(|e| format!("docs/decisions cannot be read: {e}"))?;
    let mut highest = 0;
    for entry in entries {
        let name = entry.map_err(|e| e.to_string())?.file_name();
        let name = name.to_string_lossy();
        let b = name.as_bytes();
        if b.len() > 5 && b[..4].iter().all(u8::is_ascii_digit) && b[4] == b'-' {
            highest = highest.max(name[..4].parse::<u32>().unwrap_or(0));
        }
    }
    let number = format!("{:04}", highest + 1);
    let file_name = format!("{number}-{slug_}.md");
    let scope = scopes.join(", ");

    plan.create(
        &format!("decisions/{file_name}"),
        &format!(
            "# ADR-{number} — {title}

- **Status:** Proposed
- **Date:** {date}
- **Scope:** {scope}

## Problem

{MARK}: what situation forced a decision, and why the status quo did not work.

## Decision

{MARK}: what was chosen, stated plainly.

## Consequences

{MARK}: what this makes easier, what it makes harder, and what it commits us to.

## Alternatives considered

{MARK}: each option, and the one reason it lost.
"
        ),
    )?;

    let file = plan.edit("decisions/README.md")?;
    let ledger = (0..file.lines.len())
        .find(|&i| crate::md::cells(&file.lines[i]) == ["ADR", "Title", "Scope", "Status"])
        .and_then(|i| file.table_between(i, file.lines.len()))
        .ok_or("docs/decisions/README.md has no ledger")?;
    let link = format!("[{number}]({file_name})");
    file.insert(
        ledger.end,
        &[format!("| {link} | {title} | {scope} | Proposed |")],
    );

    // The views by subject: workspace first, then the registry's order.
    let mut order = vec!["workspace".to_string()];
    order.extend(addresses);
    let rank = |a: &str| order.iter().position(|o| o == a).unwrap_or(order.len());
    let row = format!("| {link} | {title} | Proposed |");
    for s in scopes {
        let file = plan.edit("decisions/README.md")?;
        if let Some(table) = file.table_under(3, s) {
            file.insert(table.end, std::slice::from_ref(&row));
            continue;
        }
        let by_subject = file
            .heading(2, "By subject")
            .ok_or("docs/decisions/README.md has no By subject section")?;
        let end = file.section_end(by_subject);
        let at = file
            .headings()
            .into_iter()
            .find(|(i, l, t)| *i > by_subject && *i < end && *l == 3 && rank(t) > rank(s))
            .map(|(i, _, _)| i)
            .unwrap_or(end);
        let block = [
            format!("### {s}"),
            String::new(),
            "| ADR | Title | Status |".to_string(),
            "|---|---|---|".to_string(),
            row.clone(),
        ];
        insert_block(file, at, &block);
    }
    Ok(())
}

// ---- §4.6: a guide ----

pub fn guide(
    plan: &mut Plan,
    reg: &Registry,
    group: &str,
    slug_: &str,
    title: &str,
    covers: &str,
) -> Result<(), String> {
    if group != "workspace" && reg.system(group).is_none() {
        return Err(format!(
            "the group {group} is neither workspace nor a registered system"
        ));
    }
    slug("guide", slug_)?;
    line_of_text("title", title)?;
    line_of_text("description", covers)?;
    plan.create(
        &format!("guides/{slug_}.md"),
        &format!(
            "# {title}

{MARK}: the task this guide does, who does it, and what they need first.
A guide that builds on another declares it here, in an Assumes line.

## The steps

### 1. {MARK}

{MARK}: the exact command or file, and what it prints.
Expected output is copied from a real run, never written from memory.

## Confirming the work

{MARK}: how to confirm the task is done.
"
        ),
    )?;
    let heading = capitalise(group);
    let row = format!("| [{slug_}.md]({slug_}.md) | {covers} |");
    let file = plan.edit("guides/README.md")?;
    match file.table_under(2, &heading) {
        Some(table) => file.insert(table.end, &[row]),
        None => {
            let end = file.lines.len();
            let block = [
                format!("## {heading}"),
                String::new(),
                "| Guide | Covers |".to_string(),
                "|---|---|".to_string(),
                row,
            ];
            insert_block(file, end, &block);
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn slugs_are_lower_case_runs_joined_by_single_hyphens() {
        assert!(is_slug("doc-scaffold"));
        assert!(is_slug("v2"));
        assert!(!is_slug("Doc"));
        assert!(!is_slug("a--b"));
        assert!(!is_slug("-a"));
        assert!(!is_slug(""));
    }

    #[test]
    fn a_title_becomes_its_slug() {
        assert_eq!(
            slug_of("Times are stored in local time, not UTC"),
            "times-are-stored-in-local-time-not-utc"
        );
    }

    #[test]
    fn text_that_would_break_a_table_or_hold_html_is_refused() {
        assert!(line_of_text("x", "fine `code`").is_ok());
        for bad in ["", "a | b", "a\nb", "a <b> c", "a `b"] {
            assert!(line_of_text("x", bad).is_err(), "{bad:?} passed");
        }
    }
}
