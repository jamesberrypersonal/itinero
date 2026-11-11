//! Every change a command makes, held in memory until all of them are known (§4.1). Nothing is
//! written until the command has checked everything it refuses, so a refused command writes
//! nothing (`SHR:DOC-SCAFFOLD-F3`).

use crate::md::File;
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

pub struct Plan {
    root: PathBuf,
    /// Each file to write, by its path from the vault root, with its text as read from disk, or
    /// `None` for a new file.
    files: BTreeMap<String, (File, Option<String>)>,
}

impl Plan {
    pub fn new(root: &Path) -> Plan {
        Plan {
            root: root.to_path_buf(),
            files: BTreeMap::new(),
        }
    }

    fn path(&self, rel: &str) -> PathBuf {
        self.root.join("docs").join(rel)
    }

    /// Whether a file is on disk, or already planned.
    pub fn exists(&self, rel: &str) -> bool {
        self.files.contains_key(rel) || self.path(rel).exists()
    }

    /// An existing file to edit, read on first use.
    pub fn edit(&mut self, rel: &str) -> Result<&mut File, String> {
        if !self.files.contains_key(rel) {
            let path = self.path(rel);
            if !path.is_file() {
                return Err(format!("docs/{rel} is missing"));
            }
            let text = std::fs::read_to_string(&path)
                .map_err(|e| format!("docs/{rel} cannot be read: {e}"))?;
            self.files
                .insert(rel.to_string(), (File::parse(&text), Some(text)));
        }
        Ok(&mut self.files.get_mut(rel).unwrap().0)
    }

    /// A new file. A file that already exists is refused, so nothing is ever overwritten.
    pub fn create(&mut self, rel: &str, text: &str) -> Result<(), String> {
        if self.exists(rel) {
            return Err(format!("docs/{rel} already exists"));
        }
        self.files
            .insert(rel.to_string(), (File::parse(text), None));
        Ok(())
    }

    /// Writes every new or changed file, and returns one line for each, created files first. A
    /// file only read, such as the registry when a decision record is written, is left alone.
    pub fn apply(self) -> Result<Vec<String>, String> {
        let mut report = Vec::new();
        for created in [true, false] {
            for (rel, (file, old)) in &self.files {
                if old.is_none() != created || old.as_deref() == Some(file.text().as_str()) {
                    continue;
                }
                let path = self.path(rel);
                if let Some(dir) = path.parent() {
                    std::fs::create_dir_all(dir)
                        .map_err(|e| format!("docs/{rel} cannot be written: {e}"))?;
                }
                std::fs::write(&path, file.text())
                    .map_err(|e| format!("docs/{rel} cannot be written: {e}"))?;
                let verb = if created { "created" } else { "changed" };
                report.push(format!("{verb} docs/{rel}"));
            }
        }
        Ok(report)
    }
}

/// Inserts a block of lines at `at`, with one blank line between it and any text on either side.
pub fn insert_block(file: &mut File, at: usize, block: &[String]) {
    let mut lines = Vec::new();
    if at > 0 && !file.lines[at - 1].trim().is_empty() {
        lines.push(String::new());
    }
    lines.extend(block.iter().cloned());
    if at < file.lines.len() && !file.lines[at].trim().is_empty() {
        lines.push(String::new());
    }
    file.insert(at, &lines);
}
