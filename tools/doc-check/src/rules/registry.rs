//! §4.3.7 registry, §4.3.8 concern-sections and §4.3.20 tags.

use super::Ctx;
use std::collections::BTreeMap;

fn is_caps(s: &str, min: usize, max: usize) -> bool {
    (min..=max).contains(&s.len()) && s.chars().all(|c| c.is_ascii_uppercase())
}

pub fn check(ctx: &mut Ctx) {
    registry(ctx);
    concern_sections(ctx);
    tags(ctx);
}

fn registry(ctx: &mut Ctx) {
    let reg = ctx.reg;
    let path = "docs/components.md".to_string();
    let mut found: Vec<(usize, String)> = Vec::new();
    for name in &reg.missing {
        found.push((1, format!("components.md has no {name} table")));
    }

    let mut systems: BTreeMap<&str, usize> = BTreeMap::new();
    for s in &reg.systems {
        if let Some(first) = systems.insert(&s.slug, s.line) {
            found.push((
                s.line,
                format!(
                    "system {} is registered twice, first at line {first}",
                    s.slug
                ),
            ));
        }
        if s.slug == "shared" || s.slug == "concerns" {
            found.push((s.line, format!("a system may not be named {}", s.slug)));
        }
        if !is_caps(&s.prefix, 2, 4) {
            found.push((
                s.line,
                format!(
                    "system prefix {} is not two to four capital letters",
                    s.prefix
                ),
            ));
        }
    }
    for c in &reg.concerns {
        if !is_caps(&c.prefix, 2, 4) {
            found.push((
                c.line,
                format!(
                    "concern prefix {} is not two to four capital letters",
                    c.prefix
                ),
            ));
        }
    }

    let mut components: BTreeMap<(&str, &str), usize> = BTreeMap::new();
    for c in &reg.components {
        if let Some(first) = components.insert((&c.system, &c.slug), c.line) {
            found.push((
                c.line,
                format!(
                    "component {}/{} is registered twice, first at line {first}",
                    c.system, c.slug
                ),
            ));
        }
        let system_prefix = if c.system == "shared" {
            Some("SHR")
        } else {
            reg.systems
                .iter()
                .find(|s| s.slug == c.system)
                .map(|s| s.prefix.as_str())
        };
        let Some(system_prefix) = system_prefix else {
            found.push((
                c.line,
                format!(
                    "component {}'s system {} is neither a registered system nor shared",
                    c.slug, c.system
                ),
            ));
            continue;
        };
        let name = c
            .prefix
            .strip_prefix(system_prefix)
            .and_then(|r| r.strip_prefix(':'));
        let well_formed = name.is_some_and(|n| {
            (3..=12).contains(&n.len())
                && n.chars()
                    .all(|ch| ch.is_ascii_uppercase() || ch.is_ascii_digit() || ch == '-')
        });
        if !well_formed {
            found.push((
                c.line,
                format!("component prefix {} is not {system_prefix}, a colon, and three to twelve capitals, digits and hyphens", c.prefix),
            ));
        }
    }

    let mut prefixes: BTreeMap<&str, usize> = BTreeMap::new();
    let all = reg
        .systems
        .iter()
        .map(|s| (&s.prefix, s.line))
        .chain(reg.components.iter().map(|c| (&c.prefix, c.line)))
        .chain(reg.concerns.iter().map(|c| (&c.prefix, c.line)));
    let mut ordered: Vec<_> = all.collect();
    ordered.sort_by_key(|(_, line)| *line);
    for (prefix, line) in ordered {
        if let Some(first) = prefixes.insert(prefix, line) {
            found.push((
                line,
                format!("prefix {prefix} is used twice, first at line {first}"),
            ));
        }
    }

    for (line, text) in found {
        ctx.report("registry", path.clone(), line, text, None);
    }
}

fn concern_sections(ctx: &mut Ctx) {
    let reg = ctx.reg;
    let mut specs: Vec<String> = reg
        .components
        .iter()
        .map(|c| format!("spec/{}/{}.md", c.system, c.slug))
        .collect();
    specs.extend(
        reg.concerns
            .iter()
            .map(|c| format!("spec/concerns/{}.md", c.slug)),
    );
    let mut found = Vec::new();
    for concern in &reg.concerns {
        let Some(section) = &concern.section else {
            continue;
        };
        for rel in &specs {
            if let Some(doc) = ctx.vault.doc(rel)
                && !doc.sections.contains(section)
            {
                found.push((
                    doc.path(),
                    format!(
                        "it numbers no section {section}, where the concern {} is covered",
                        concern.slug
                    ),
                ));
            }
        }
    }
    for (path, text) in found {
        ctx.report(
            "concern-sections",
            path,
            1,
            text,
            Some("add the numbered section".into()),
        );
    }
}

fn tags(ctx: &mut Ctx) {
    if !ctx.list.exists {
        return;
    }
    let addresses = ctx.reg.addresses();
    let path = "docs/TODO.md".to_string();
    let Some((heading, rows)) = &ctx.list.tags else {
        if !addresses.is_empty() {
            ctx.report(
                "tags",
                path,
                1,
                "TODO.md has no Tags table".into(),
                Some("add a ## Tags heading and its table".into()),
            );
        }
        return;
    };
    let (heading, rows) = (*heading, rows.clone());
    for address in &addresses {
        if !rows.iter().any(|(t, _)| t == address) {
            ctx.report(
                "tags",
                path.clone(),
                heading,
                format!("registered address {address} has no row in the Tags table"),
                Some(format!("add a row for {address}")),
            );
        }
    }
    for (tag, line) in rows {
        if tag.contains('/') && !addresses.contains(&tag) {
            ctx.report(
                "tags",
                path.clone(),
                line,
                format!("tag {tag} holds a slash and is not a registered address"),
                None,
            );
        }
    }
}
