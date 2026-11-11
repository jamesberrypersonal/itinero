//! §4.3.1 links.

use super::{Ctx, Target, target};
use crate::vault;

pub fn check(ctx: &mut Ctx) {
    for doc in ctx.vault.docs.values() {
        for line in doc.read_lines() {
            for &at in &line.scan.wikilinks {
                let rest: String = line.scan.chars[at..].iter().collect();
                let shown = rest.find("]]").map(|e| &rest[..e + 2]).unwrap_or(&rest);
                ctx.report(
                    "links",
                    doc.path(),
                    line.no,
                    format!("wikilink {shown}"),
                    Some("write a standard link to the same document, by relative path".into()),
                );
            }
            for link in &line.scan.links {
                match target(doc, link) {
                    Target::External => {}
                    Target::Absolute(path) => {
                        let inside = path.trim_start_matches('/');
                        let inside = inside
                            .strip_prefix("docs/")
                            .filter(|p| ctx.vault.exists(p))
                            .unwrap_or(inside);
                        let pass = ctx
                            .vault
                            .exists(inside)
                            .then(|| format!("link to {}", vault::relative(doc.dir(), inside)));
                        ctx.report(
                            "links",
                            doc.path(),
                            line.no,
                            format!("link target {} is absolute", link.target),
                            pass,
                        );
                    }
                    Target::Relative { path, fragment } => {
                        let Some(path) = path.filter(|p| ctx.vault.exists(p)) else {
                            ctx.report(
                                "links",
                                doc.path(),
                                line.no,
                                format!("link target {} does not resolve to a file or directory in the vault", link.target),
                                None,
                            );
                            continue;
                        };
                        let Some(fragment) = fragment else { continue };
                        match fragment.strip_prefix('^') {
                            None => ctx.report(
                                "links",
                                doc.path(),
                                line.no,
                                format!("link target {} carries a heading anchor", link.target),
                                Some("link to the document alone, or to a block ID".into()),
                            ),
                            Some(id) => {
                                let defined = ctx
                                    .vault
                                    .doc(&path)
                                    .is_some_and(|d| d.block_ids.contains(id));
                                if !defined {
                                    ctx.report(
                                        "links",
                                        doc.path(),
                                        line.no,
                                        format!("link target {} names block ID {id}, which {} does not define", link.target, vault::repo_path(&path)),
                                        None,
                                    );
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
