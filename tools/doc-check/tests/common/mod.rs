//! Helpers shared by doc-check's integration tests. Standard library only, like doc-check.

#![allow(dead_code)]

use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::atomic::{AtomicUsize, Ordering};

static NEXT: AtomicUsize = AtomicUsize::new(0);

/// A fresh, empty directory under the system's temporary directory.
pub fn temp_dir(tag: &str) -> PathBuf {
    let n = NEXT.fetch_add(1, Ordering::SeqCst);
    let dir = std::env::temp_dir().join(format!("doc-check-{tag}-{}-{n}", std::process::id()));
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(&dir).unwrap();
    dir
}

/// Copies a directory tree. With `reverse`, each directory's entries are copied last first.
pub fn copy_dir(from: &Path, to: &Path, reverse: bool) {
    fs::create_dir_all(to).unwrap();
    let mut entries: Vec<_> = fs::read_dir(from).unwrap().map(|e| e.unwrap()).collect();
    entries.sort_by_key(|e| e.file_name());
    if reverse {
        entries.reverse();
    }
    for entry in entries {
        let dest = to.join(entry.file_name());
        if entry.file_type().unwrap().is_dir() {
            copy_dir(&entry.path(), &dest, reverse);
        } else {
            fs::copy(entry.path(), dest).unwrap();
        }
    }
}

pub struct Run {
    pub status: i32,
    pub stdout: String,
    pub stderr: String,
}

/// Runs doc-check with `--root <root>` and any further arguments.
pub fn run(root: &Path, args: &[&str]) -> Run {
    let out = Command::new(env!("CARGO_BIN_EXE_doc-check"))
        .arg("--root")
        .arg(root)
        .args(args)
        .output()
        .expect("doc-check runs");
    Run {
        status: out.status.code().unwrap_or(-1),
        stdout: String::from_utf8(out.stdout).unwrap(),
        stderr: String::from_utf8(out.stderr).unwrap(),
    }
}

/// The smallest vault that runs clean: a registry with its four tables, and nothing else.
pub const REGISTRY: &str = "# Components

## Systems

| System | Prefix | Telemetry namespace | Outside the vault | Is |
|---|---|---|---|---|

## Components

| Component | System | Prefix | Packages | Outside the vault | Is |
|---|---|---|---|---|---|

## Booking kinds

| Kind | Prefix | Imported | Manual | In `@itinero/bookings` | Is |
|---|---|---|---|---|---|

## Cross-cutting concerns

| Concern | Prefix | Covered in each specification at | Is |
|---|---|---|---|
";

/// Writes `files`, each a path from `root` and its text.
pub fn write(root: &Path, files: &[(&str, &str)]) {
    for (rel, text) in files {
        let path = root.join(rel);
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, text).unwrap();
    }
}

/// Every file under `dir` with its contents, in path order.
pub fn snapshot(dir: &Path) -> Vec<(PathBuf, Vec<u8>)> {
    let mut out = Vec::new();
    let mut stack = vec![dir.to_path_buf()];
    while let Some(d) = stack.pop() {
        for entry in fs::read_dir(&d).unwrap() {
            let entry = entry.unwrap();
            if entry.file_type().unwrap().is_dir() {
                stack.push(entry.path());
            } else {
                out.push((entry.path(), fs::read(entry.path()).unwrap()));
            }
        }
    }
    out.sort();
    out
}
