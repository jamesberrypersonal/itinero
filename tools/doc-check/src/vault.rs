//! Walks the vault and reads every document in it (`spec/shared/doc-check.md` §4.2 and §4.6).

use crate::markdown::{self, Kind, Line};
use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::path::Path;

/// One markdown document in the vault.
pub struct Doc {
    /// The path from the vault root, with `/` as the separator, such as `spec/shared/doc-check.md`.
    pub rel: String,
    pub lines: Vec<Line>,
    /// Every block ID the document defines.
    pub block_ids: BTreeSet<String>,
    /// Every section number the document's headings number.
    pub sections: BTreeSet<String>,
}

impl Doc {
    fn new(rel: String, text: &str) -> Doc {
        let lines = markdown::parse(text);
        let mut block_ids = BTreeSet::new();
        let mut sections = BTreeSet::new();
        for line in &lines {
            match line.kind {
                Kind::Text => {
                    if let Some(id) = markdown::trailing_block_id(&line.text) {
                        block_ids.insert(id.to_string());
                    }
                }
                Kind::BlockId => {
                    block_ids.insert(line.text.trim()[1..].to_string());
                }
                Kind::Heading(level) if level >= 2 => {
                    if let Some(n) = markdown::section_number(line.heading_text().unwrap_or("")) {
                        sections.insert(n);
                    }
                }
                _ => {}
            }
        }
        Doc {
            rel,
            lines,
            block_ids,
            sections,
        }
    }

    /// The directory holding the document, from the vault root. Empty at the root.
    pub fn dir(&self) -> &str {
        parent(&self.rel)
    }

    pub fn name(&self) -> &str {
        self.rel.rsplit('/').next().unwrap_or(&self.rel)
    }

    /// The document's path from the repository root.
    pub fn path(&self) -> String {
        repo_path(&self.rel)
    }

    /// The lines doc-check reads, leaving out fences and what they hold.
    pub fn read_lines(&self) -> impl Iterator<Item = &Line> {
        self.lines
            .iter()
            .filter(|l| !matches!(l.kind, Kind::Fence | Kind::InFence))
    }
}

/// Everything the walk keeps.
#[derive(Default)]
pub struct Vault {
    pub docs: BTreeMap<String, Doc>,
    /// Every kept file and directory, by its path from the vault root.
    pub names: BTreeSet<String>,
    /// Every kept directory, the vault root included as the empty path.
    pub dirs: BTreeSet<String>,
    /// Each kept directory's kept entries, by name.
    pub children: BTreeMap<String, Vec<String>>,
}

impl Vault {
    pub fn doc(&self, rel: &str) -> Option<&Doc> {
        self.docs.get(rel)
    }

    pub fn exists(&self, rel: &str) -> bool {
        rel.is_empty() || self.names.contains(rel)
    }
}

/// Reads the vault at `<root>/docs`. An error is a reason doc-check could not run.
pub fn load(root: &Path) -> Result<Vault, String> {
    let vault_dir = root.join("docs");
    if !vault_dir.is_dir() {
        return Err(format!("{} holds no docs/ directory", root.display()));
    }
    let registry = vault_dir.join("components.md");
    if !registry.is_file() {
        return Err("docs/components.md is missing".to_string());
    }
    let canonical = vault_dir
        .canonicalize()
        .map_err(|e| format!("docs/ cannot be read: {e}"))?;
    let mut vault = Vault::default();
    vault.dirs.insert(String::new());
    walk(&vault_dir, &canonical, "", &mut vault)?;
    if !vault.docs.contains_key("components.md") {
        return Err("docs/components.md cannot be read".to_string());
    }
    Ok(vault)
}

fn walk(dir: &Path, vault_root: &Path, rel_dir: &str, vault: &mut Vault) -> Result<(), String> {
    let shown = |rel: &str| repo_path(rel);
    let reader =
        fs::read_dir(dir).map_err(|e| format!("{} cannot be read: {e}", shown(rel_dir)))?;
    let mut entries = Vec::new();
    for entry in reader {
        let entry = entry.map_err(|e| format!("{} cannot be read: {e}", shown(rel_dir)))?;
        let name = entry
            .file_name()
            .into_string()
            .map_err(|n| format!("{} holds a name that is not UTF-8: {n:?}", shown(rel_dir)))?;
        entries.push((name, entry));
    }
    entries.sort_by(|a, b| a.0.as_bytes().cmp(b.0.as_bytes()));

    let mut kept = Vec::new();
    for (name, entry) in entries {
        let rel = join(rel_dir, &name);
        let path = entry.path();
        let file_type = entry
            .file_type()
            .map_err(|e| format!("{} cannot be read: {e}", shown(&rel)))?;
        let symlink = file_type.is_symlink();
        let (is_dir, is_file) = if symlink {
            let target = fs::canonicalize(&path).map_err(|e| {
                format!(
                    "{} is a symbolic link that cannot be followed: {e}",
                    shown(&rel)
                )
            })?;
            if !target.starts_with(vault_root) {
                return Err(format!(
                    "{} is a symbolic link that points outside the vault",
                    shown(&rel)
                ));
            }
            let meta =
                fs::metadata(&path).map_err(|e| format!("{} cannot be read: {e}", shown(&rel)))?;
            (meta.is_dir(), meta.is_file())
        } else {
            (file_type.is_dir(), file_type.is_file())
        };

        if is_dir {
            if name == "graveyard" || name == ".obsidian" {
                continue;
            }
            vault.names.insert(rel.clone());
            vault.dirs.insert(rel.clone());
            kept.push(name);
            // A link to a directory inside the vault is kept as a name, and not walked twice.
            if !symlink {
                walk(&path, vault_root, &rel, vault)?;
            }
        } else {
            if name.ends_with("-draft.md") {
                continue;
            }
            vault.names.insert(rel.clone());
            kept.push(name.clone());
            if is_file && name.ends_with(".md") {
                let bytes =
                    fs::read(&path).map_err(|e| format!("{} cannot be read: {e}", shown(&rel)))?;
                let text = String::from_utf8(bytes)
                    .map_err(|_| format!("{} is not valid UTF-8", shown(&rel)))?;
                vault.docs.insert(rel.clone(), Doc::new(rel, &text));
            }
        }
    }
    vault.children.insert(rel_dir.to_string(), kept);
    Ok(())
}

/// A path from the vault root, written from the repository root.
pub fn repo_path(rel: &str) -> String {
    if rel.is_empty() {
        "docs".to_string()
    } else {
        format!("docs/{rel}")
    }
}

pub fn join(dir: &str, name: &str) -> String {
    if dir.is_empty() {
        name.to_string()
    } else {
        format!("{dir}/{name}")
    }
}

pub fn parent(rel: &str) -> &str {
    rel.rfind('/').map(|i| &rel[..i]).unwrap_or("")
}

/// Resolves `path` against `dir`, both from the vault root. `None` when it leaves the vault.
pub fn resolve(dir: &str, path: &str) -> Option<String> {
    let mut parts: Vec<&str> = if dir.is_empty() {
        Vec::new()
    } else {
        dir.split('/').collect()
    };
    for part in path.split('/') {
        match part {
            "" | "." => {}
            ".." => {
                parts.pop()?;
            }
            p => parts.push(p),
        }
    }
    Some(parts.join("/"))
}

/// The relative path from directory `from` to `to`, both from the vault root.
pub fn relative(from: &str, to: &str) -> String {
    let a: Vec<&str> = if from.is_empty() {
        Vec::new()
    } else {
        from.split('/').collect()
    };
    let b: Vec<&str> = to.split('/').collect();
    let common = a.iter().zip(&b).take_while(|(x, y)| x == y).count();
    let mut out: Vec<&str> = vec![".."; a.len() - common];
    out.extend(&b[common..]);
    out.join("/")
}

/// Decodes `%XX` escapes in a link target. Anything else is left as written.
pub fn percent_decode(s: &str) -> String {
    let bytes = s.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%'
            && i + 2 < bytes.len()
            && let Ok(b) = std::str::from_utf8(&bytes[i + 1..i + 3])
                .map_err(|_| ())
                .and_then(|h| u8::from_str_radix(h, 16).map_err(|_| ()))
        {
            out.push(b);
            i += 3;
            continue;
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8(out).unwrap_or_else(|_| s.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolve_stays_inside_the_vault() {
        assert_eq!(
            resolve("spec/shared", "../../requirements/x.md").as_deref(),
            Some("requirements/x.md")
        );
        assert_eq!(resolve("", "../README.md"), None);
    }

    #[test]
    fn relative_climbs_to_the_common_directory() {
        assert_eq!(
            relative("spec/shared", "requirements/shared/x.md"),
            "../../requirements/shared/x.md"
        );
        assert_eq!(relative("", "spec/README.md"), "spec/README.md");
    }

    #[test]
    fn percent_escapes_are_decoded() {
        assert_eq!(percent_decode("a%20b.md"), "a b.md");
        assert_eq!(percent_decode("100%"), "100%");
    }
}
