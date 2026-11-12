//! The little Markdown doc-scaffold reads (`spec/shared/doc-scaffold.md` §4.2): headings and the
//! tables under them, outside fenced code blocks. It edits a file by inserting whole lines, and
//! changes one existing line only to link a registered component to its new specification.

/// One file, as its lines, with whether it ended in a newline.
pub struct File {
    pub lines: Vec<String>,
    trailing_newline: bool,
}

/// A table: the line index of its header row, and of the line after its last row.
#[derive(Clone, Copy, Debug)]
pub struct Table {
    pub header: usize,
    pub end: usize,
}

impl Table {
    /// The line indexes of its body rows, after the separator.
    pub fn rows(&self) -> std::ops::Range<usize> {
        (self.header + 2).min(self.end)..self.end
    }
}

impl File {
    pub fn parse(text: &str) -> File {
        File {
            lines: text.lines().map(str::to_string).collect(),
            trailing_newline: text.ends_with('\n') || text.is_empty(),
        }
    }

    pub fn text(&self) -> String {
        let mut out = self.lines.join("\n");
        if self.trailing_newline {
            out.push('\n');
        }
        out
    }

    /// Whether each line is inside a fenced code block, fences included.
    fn fenced(&self) -> Vec<bool> {
        let mut out = Vec::with_capacity(self.lines.len());
        let mut open: Option<(char, usize)> = None;
        for line in &self.lines {
            let fence = fence(line);
            match (open, fence) {
                (None, Some(f)) => {
                    open = Some(f);
                    out.push(true);
                }
                (Some((c, n)), Some((fc, fn_))) if fc == c && fn_ >= n => {
                    open = None;
                    out.push(true);
                }
                (Some(_), _) => out.push(true),
                (None, None) => out.push(false),
            }
        }
        out
    }

    /// Each heading outside a fence: its line index, level and text.
    pub fn headings(&self) -> Vec<(usize, usize, String)> {
        let fenced = self.fenced();
        let mut out = Vec::new();
        for (i, line) in self.lines.iter().enumerate() {
            if fenced[i] {
                continue;
            }
            let level = line.chars().take_while(|&c| c == '#').count();
            if (1..=6).contains(&level) && line[level..].starts_with(' ') {
                out.push((i, level, line[level..].trim().to_string()));
            }
        }
        out
    }

    /// The line index of the first heading of `level` whose text is `text`.
    pub fn heading(&self, level: usize, text: &str) -> Option<usize> {
        self.headings()
            .into_iter()
            .find(|(_, l, t)| *l == level && t == text)
            .map(|(i, _, _)| i)
    }

    /// The line index where the section opened by the heading at `at` ends: the next heading of
    /// its level or above, or the end of the file.
    pub fn section_end(&self, at: usize) -> usize {
        let level = self
            .headings()
            .into_iter()
            .find(|(i, _, _)| *i == at)
            .map(|(_, l, _)| l)
            .unwrap_or(6);
        self.headings()
            .into_iter()
            .find(|(i, l, _)| *i > at && *l <= level)
            .map(|(i, _, _)| i)
            .unwrap_or(self.lines.len())
    }

    /// The first table after the line at `from`, before `until`.
    pub fn table_between(&self, from: usize, until: usize) -> Option<Table> {
        let fenced = self.fenced();
        let header = (from..until).find(|&i| !fenced[i] && self.lines[i].starts_with('|'))?;
        let mut end = header;
        while end < until && self.lines[end].starts_with('|') {
            end += 1;
        }
        Some(Table { header, end })
    }

    /// The first table in the section opened by the heading of `level` holding `text`.
    pub fn table_under(&self, level: usize, text: &str) -> Option<Table> {
        let at = self.heading(level, text)?;
        self.table_between(at + 1, self.section_end(at))
    }

    /// The header cells of a table.
    pub fn header(&self, table: Table) -> Vec<String> {
        cells(&self.lines[table.header])
    }

    /// The value of a row's cell in the column headed `name`.
    pub fn cell(&self, table: Table, row: usize, name: &str) -> Option<String> {
        let col = self.header(table).iter().position(|h| h == name)?;
        cells(&self.lines[row]).get(col).map(|c| value(c))
    }

    /// Replaces the line at `at`. doc-scaffold uses it for one change alone: linking a component's
    /// slug in the registry to its new specification (§4.7).
    pub fn replace(&mut self, at: usize, line: String) {
        self.lines[at] = line;
    }

    /// Inserts lines before the line at `at`.
    pub fn insert(&mut self, at: usize, new: &[String]) {
        for (n, line) in new.iter().enumerate() {
            self.lines.insert(at + n, line.clone());
        }
    }
}

/// A fence's character and length, if the line opens or closes one: up to three spaces, then three
/// or more backticks or tildes.
fn fence(line: &str) -> Option<(char, usize)> {
    let indent = line.len() - line.trim_start_matches(' ').len();
    if indent > 3 {
        return None;
    }
    let rest = &line[indent..];
    let c = rest.chars().next().filter(|c| *c == '`' || *c == '~')?;
    let n = rest.chars().take_while(|&x| x == c).count();
    (n >= 3).then_some((c, n))
}

/// The cells of a table row, trimmed. A pipe inside a code span or written `\|` stays in its cell.
pub fn cells(row: &str) -> Vec<String> {
    let inner = row.trim().trim_start_matches('|');
    let inner = inner.strip_suffix('|').unwrap_or(inner);
    let mut out = Vec::new();
    let mut cell = String::new();
    let mut in_code = false;
    let mut chars = inner.chars().peekable();
    while let Some(c) = chars.next() {
        match c {
            '\\' if chars.peek() == Some(&'|') => {
                cell.push('\\');
                cell.push(chars.next().unwrap());
            }
            '`' => {
                in_code = !in_code;
                cell.push(c);
            }
            '|' if !in_code => out.push(std::mem::take(&mut cell).trim().to_string()),
            _ => cell.push(c),
        }
    }
    out.push(cell.trim().to_string());
    out
}

/// A cell's value: its link text, if it holds a link, and otherwise its text, without backticks.
pub fn value(cell: &str) -> String {
    let text = match (cell.find('['), cell.find("](")) {
        (Some(a), Some(b)) if a < b => &cell[a + 1..b],
        _ => cell,
    };
    text.trim().trim_matches('`').trim().to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_heading_inside_a_fence_is_not_read() {
        let f = File::parse("# A\n\n```markdown\n## Systems\n```\n\n## Systems\n");
        assert_eq!(f.heading(2, "Systems"), Some(6));
    }

    #[test]
    fn a_table_is_found_under_its_heading_and_its_rows_are_read() {
        let f = File::parse(
            "# R\n\n## Systems\n\n| System | Prefix |\n|---|---|\n| [planner](a.md) | `PLN` |\n\n## Next\n",
        );
        let t = f.table_under(2, "Systems").unwrap();
        assert_eq!(t.rows(), 6..7);
        assert_eq!(f.cell(t, 6, "System").as_deref(), Some("planner"));
        assert_eq!(f.cell(t, 6, "Prefix").as_deref(), Some("PLN"));
    }

    #[test]
    fn a_pipe_in_a_code_span_or_escaped_stays_in_its_cell() {
        assert_eq!(cells("| `a|b` | c \\| d | e |"), ["`a|b`", "c \\| d", "e"]);
    }

    #[test]
    fn text_round_trips_with_and_without_a_final_newline() {
        assert_eq!(File::parse("a\nb\n").text(), "a\nb\n");
        assert_eq!(File::parse("a\nb").text(), "a\nb");
    }
}
