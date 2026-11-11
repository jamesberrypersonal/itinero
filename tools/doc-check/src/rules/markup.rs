//! §4.3.3 callouts, §4.3.22 code-spans and §4.3.23 raw-html.

use super::Ctx;
use crate::markdown::{self, Kind};

const CALLOUTS: [&str; 5] = ["NOTE", "TIP", "IMPORTANT", "WARNING", "CAUTION"];

pub fn check(ctx: &mut Ctx) {
    for doc in ctx.vault.docs.values() {
        for line in doc.read_lines() {
            if line.kind == Kind::Callout {
                let ty = markdown::callout_type(&line.text).unwrap_or_default();
                if !CALLOUTS.contains(&ty.to_uppercase().as_str()) {
                    ctx.report(
                        "callouts",
                        doc.path(),
                        line.no,
                        format!("callout type [!{ty}] is not one of the five both renderers share"),
                        Some("use NOTE, TIP, IMPORTANT, WARNING or CAUTION".into()),
                    );
                }
            }

            for &at in &line.scan.unmatched {
                let run = line.scan.chars[at..]
                    .iter()
                    .take_while(|&&c| c == '`')
                    .count();
                ctx.report(
                    "code-spans",
                    doc.path(),
                    line.no,
                    format!("a run of {run} backtick{} opens a code span that does not close on this line", if run == 1 { "" } else { "s" }),
                    Some("keep the span on one line, or write a literal backtick inside a span opened by a longer run".into()),
                );
            }

            let prose = line.prose();
            for at in markdown::raw_html(&prose) {
                let tag: String = prose[at..]
                    .iter()
                    .take_while(|&&c| c != '>' && c != ' ')
                    .collect();
                let shown = if prose.get(at + tag.chars().count()) == Some(&'>') {
                    format!("{tag}>")
                } else {
                    tag
                };
                ctx.report(
                    "raw-html",
                    doc.path(),
                    line.no,
                    format!("raw HTML {shown}"),
                    Some("put it in a code span, or write its < as &lt;".into()),
                );
            }
        }
    }
}
