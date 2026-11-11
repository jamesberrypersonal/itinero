//! §4.3.4 case-collisions, §4.3.5 filenames, §4.3.6 indexes and §4.3.9 addresses.

use super::{Ctx, resolved};
use crate::tables::is_record_name;
use crate::vault::{self, parent, repo_path};
use std::collections::{BTreeMap, BTreeSet};

const EXEMPT: [&str; 3] = ["README.md", "TODO.md", "CHANGELOG.md"];

pub fn check(ctx: &mut Ctx) {
    case_collisions(ctx);
    filenames(ctx);
    indexes(ctx);
    addresses(ctx);
}

fn case_collisions(ctx: &mut Ctx) {
    for (dir, names) in &ctx.vault.children {
        let mut groups: BTreeMap<String, Vec<&String>> = BTreeMap::new();
        for name in names {
            groups.entry(name.to_lowercase()).or_default().push(name);
        }
        for group in groups.values().filter(|g| g.len() > 1) {
            for name in group {
                let others: Vec<&str> = group
                    .iter()
                    .filter(|n| *n != name)
                    .map(|n| n.as_str())
                    .collect();
                ctx.report(
                    "case-collisions",
                    repo_path(&vault::join(dir, name)),
                    1,
                    format!(
                        "{name} differs from {} only in letter case",
                        others.join(", ")
                    ),
                    Some("rename one of them".into()),
                );
            }
        }
    }
}

fn is_slug(stem: &str) -> bool {
    !stem.is_empty()
        && stem.split('-').all(|part| {
            !part.is_empty()
                && part
                    .chars()
                    .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit())
        })
}

fn filenames(ctx: &mut Ctx) {
    for doc in ctx.vault.docs.values() {
        let name = doc.name();
        if EXEMPT.contains(&name) {
            continue;
        }
        let stem = name.trim_end_matches(".md");
        if is_slug(stem) {
            continue;
        }
        let mut fixed = String::new();
        for c in stem.to_lowercase().chars() {
            if c == ' ' || c == '_' {
                if !fixed.ends_with('-') {
                    fixed.push('-');
                }
            } else {
                fixed.push(c);
            }
        }
        ctx.report(
            "filenames",
            doc.path(),
            1,
            format!("{name} is not lower-case words joined by hyphens"),
            Some(format!("rename it {fixed}.md")),
        );
    }
}

/// Every path the links in a directory's `README.md` resolve to.
fn index_targets(ctx: &Ctx, dir: &str) -> Option<BTreeSet<String>> {
    let readme = ctx.vault.doc(&vault::join(dir, "README.md"))?;
    let mut out = BTreeSet::new();
    for line in readme.read_lines() {
        for link in &line.scan.links {
            if let Some(p) = resolved(readme, link) {
                out.insert(p);
            }
        }
    }
    Some(out)
}

fn indexes(ctx: &mut Ctx) {
    let mut found = Vec::new();
    for doc in ctx.vault.docs.values() {
        let dir = doc.dir();
        if dir.is_empty() && doc.name() == "README.md" || !doc.rel.contains('/') {
            continue;
        }
        if doc.name() == "README.md" {
            let up = parent(dir);
            match index_targets(ctx, up) {
                None => found.push((
                    doc.path(),
                    format!(
                        "its parent directory has no index, {}",
                        repo_path(&vault::join(up, "README.md"))
                    ),
                    None,
                )),
                Some(targets) => {
                    if !targets.contains(&doc.rel) && !targets.contains(dir) {
                        found.push((
                            doc.path(),
                            format!(
                                "{} does not link this index",
                                repo_path(&vault::join(up, "README.md"))
                            ),
                            Some(format!(
                                "link it from {}",
                                repo_path(&vault::join(up, "README.md"))
                            )),
                        ));
                    }
                }
            }
            continue;
        }
        if dir == "decisions" && is_record_name(doc.name()) {
            continue;
        }
        match index_targets(ctx, dir) {
            None => found.push((
                doc.path(),
                format!(
                    "its directory has no index, {}",
                    repo_path(&vault::join(dir, "README.md"))
                ),
                None,
            )),
            Some(targets) => {
                if !targets.contains(&doc.rel) {
                    found.push((
                        doc.path(),
                        format!(
                            "{} does not link this document",
                            repo_path(&vault::join(dir, "README.md"))
                        ),
                        Some(format!(
                            "link it from {}",
                            repo_path(&vault::join(dir, "README.md"))
                        )),
                    ));
                }
            }
        }
    }
    for (path, text, pass) in found {
        ctx.report("indexes", path, 1, text, pass);
    }
}

fn addresses(ctx: &mut Ctx) {
    let reg = ctx.reg;
    let mut found = Vec::new();
    for dir in &ctx.vault.dirs {
        let (tree, rest) = match dir.split_once('/') {
            Some((t, r)) if t == "requirements" || t == "spec" => (t, r),
            _ => continue,
        };
        let depth = rest.split('/').count();
        let bad = if depth == 1 {
            !(rest == "shared" || rest == "concerns" || reg.is_system(rest))
        } else {
            tree == "requirements"
        };
        if !bad {
            continue;
        }
        // Reported at the first document inside the directory, or at the directory if it holds none.
        let prefix = format!("{dir}/");
        let at = ctx
            .vault
            .docs
            .keys()
            .find(|k| k.starts_with(&prefix))
            .cloned()
            .unwrap_or(dir.clone());
        let what = if depth == 1 {
            format!(
                "{}/ is not a registered system, shared or concerns",
                repo_path(dir)
            )
        } else {
            format!(
                "{}/ is nested deeper than one folder inside requirements/",
                repo_path(dir)
            )
        };
        found.push((repo_path(&at), what));
    }
    let addrs = reg.addresses();
    for doc in ctx.vault.docs.values() {
        let Some(rest) = doc.rel.strip_prefix("requirements/") else {
            continue;
        };
        if doc.name() == "README.md" {
            continue;
        }
        let ok = match rest.split('/').collect::<Vec<_>>()[..] {
            [folder, file] => {
                let slug = file.trim_end_matches(".md");
                match folder {
                    "shared" => addrs.contains(&format!("shared/{slug}")),
                    "concerns" => addrs.contains(&format!("concerns/{slug}")),
                    system => {
                        reg.is_system(system)
                            && (slug == system || addrs.contains(&format!("{system}/{slug}")))
                    }
                }
            }
            _ => false,
        };
        if !ok && rest.split('/').count() <= 2 {
            found.push((
                doc.path(),
                format!("{} is not at a registered address", doc.rel),
            ));
        }
    }
    for (path, text) in found {
        ctx.report("addresses", path, 1, text, None);
    }
}
