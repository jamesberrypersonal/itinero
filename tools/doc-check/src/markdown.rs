//! Reads one document line by line, as `spec/shared/doc-check.md` §4.2 describes.
//!
//! ADR-0001 (the checker reads each document line by line): the only state carried from one line
//! to the next is whether a fenced code block is open, and which paragraph or table a line is in.

/// What a line is, in the order §4.2 classifies it.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Kind {
    Fence,
    InFence,
    Heading(u8),
    TableRow,
    Separator,
    Callout,
    BlockId,
    Blank,
    Text,
}

/// A code span matched on one line. `start` is its first backtick.
#[derive(Debug)]
pub struct CodeSpan {
    pub start: usize,
    pub content: String,
}

/// A standard link or image. `start` is its `[` (or `!`), `end` is one past its `)`.
#[derive(Debug)]
pub struct Link {
    pub start: usize,
    pub end: usize,
    pub text: String,
    /// The target as written, without a title and without angle brackets.
    pub target: String,
}

/// A prefixed requirement identifier, such as `SHR:DOC-CHECK-F1`.
#[derive(Debug, Clone)]
pub struct Ident {
    pub start: usize,
    pub end: usize,
    pub text: String,
    /// Everything before the kind: `SHR:DOC-CHECK`.
    pub prefix: String,
    /// `F`, `NFR` or `NR`.
    pub kind: &'static str,
}

/// The parts §4.2 finds within a heading, table cell or text line.
#[derive(Default, Debug)]
pub struct Scan {
    pub chars: Vec<char>,
    /// True for every character inside a code span, its backticks included.
    pub code: Vec<bool>,
    /// True for every character of a link's `(target)`, its parentheses included.
    pub target: Vec<bool>,
    pub spans: Vec<CodeSpan>,
    /// The first character of each run of backticks with no matching run after it.
    pub unmatched: Vec<usize>,
    pub links: Vec<Link>,
    /// The first `[` of each wikilink.
    pub wikilinks: Vec<usize>,
}

#[derive(Debug)]
pub struct Line {
    /// The line number, counting from 1.
    pub no: usize,
    pub text: String,
    pub kind: Kind,
    /// The paragraph or table the line belongs to. Zero for every other line.
    pub block: usize,
    pub scan: Scan,
}

impl Line {
    /// The text after a heading's `#` characters.
    pub fn heading_text(&self) -> Option<&str> {
        match self.kind {
            Kind::Heading(level) => Some(self.text[level as usize..].trim()),
            _ => None,
        }
    }

    /// The characters with code spans and link targets blanked out.
    pub fn prose(&self) -> Vec<char> {
        let s = &self.scan;
        s.chars
            .iter()
            .enumerate()
            .map(|(i, &c)| if s.code[i] || s.target[i] { ' ' } else { c })
            .collect()
    }

    /// The characters with only link targets blanked out.
    pub fn without_targets(&self) -> Vec<char> {
        let s = &self.scan;
        s.chars
            .iter()
            .enumerate()
            .map(|(i, &c)| if s.target[i] { ' ' } else { c })
            .collect()
    }

    /// A table row's cells, as character ranges inside the row.
    pub fn cells(&self) -> Vec<(usize, usize)> {
        let s = &self.scan;
        let mut pipes = Vec::new();
        for (i, &c) in s.chars.iter().enumerate() {
            if c == '|' && !s.code[i] && !(i > 0 && s.chars[i - 1] == '\\') {
                pipes.push(i);
            }
        }
        let mut cells = Vec::new();
        let mut from = 0;
        for &p in &pipes {
            cells.push((from, p));
            from = p + 1;
        }
        cells.push((from, s.chars.len()));
        // A row that opens or closes with a pipe has an empty cell outside it.
        if s.chars.first() == Some(&'|') {
            cells.remove(0);
        }
        if s.chars.last() == Some(&'|') {
            cells.pop();
        }
        cells
    }

    /// The text of one cell, trimmed.
    pub fn cell_text(&self, (a, b): (usize, usize)) -> String {
        self.scan.chars[a..b]
            .iter()
            .collect::<String>()
            .trim()
            .to_string()
    }
}

/// Reads a document's text into lines.
pub fn parse(text: &str) -> Vec<Line> {
    let mut lines = Vec::new();
    let mut fence: Option<(char, usize)> = None;
    let mut block = 0;
    let mut prev_kind = Kind::Blank;
    let raw: Vec<&str> = text.split('\n').collect();
    let count = if text.ends_with('\n') {
        raw.len() - 1
    } else {
        raw.len()
    };
    for (i, raw_line) in raw.iter().take(count).enumerate() {
        let line = raw_line.strip_suffix('\r').unwrap_or(raw_line).to_string();
        let kind = if let Some(f) = fence_of(&line) {
            match fence {
                None => {
                    fence = Some(f);
                    Kind::Fence
                }
                Some((ch, len)) if f.0 == ch && f.1 >= len => {
                    fence = None;
                    Kind::Fence
                }
                Some(_) => Kind::InFence,
            }
        } else if fence.is_some() {
            Kind::InFence
        } else {
            classify(&line)
        };
        let joins = |a: Kind, b: Kind| {
            matches!((a, b), (Kind::Text, Kind::Text)) || (is_table(a) && is_table(b))
        };
        let this_block = match kind {
            Kind::Text | Kind::TableRow | Kind::Separator => {
                if !joins(prev_kind, kind) {
                    block += 1;
                }
                block
            }
            _ => 0,
        };
        let scan = match kind {
            Kind::Fence | Kind::InFence | Kind::Blank => Scan::default(),
            _ => scan(&line),
        };
        lines.push(Line {
            no: i + 1,
            text: line,
            kind,
            block: this_block,
            scan,
        });
        prev_kind = kind;
    }
    lines
}

fn is_table(k: Kind) -> bool {
    matches!(k, Kind::TableRow | Kind::Separator)
}

/// Up to three spaces, then three or more backticks or tildes.
fn fence_of(line: &str) -> Option<(char, usize)> {
    let indent = line.len() - line.trim_start_matches(' ').len();
    if indent > 3 {
        return None;
    }
    let rest = &line[indent..];
    let ch = rest.chars().next()?;
    if ch != '`' && ch != '~' {
        return None;
    }
    let len = rest.chars().take_while(|&c| c == ch).count();
    (len >= 3).then_some((ch, len))
}

fn classify(line: &str) -> Kind {
    let hashes = line.chars().take_while(|&c| c == '#').count();
    if (1..=6).contains(&hashes) && line[hashes..].starts_with(' ') {
        return Kind::Heading(hashes as u8);
    }
    if line.starts_with('|') {
        let separator =
            line.chars().all(|c| matches!(c, '|' | '-' | ':' | ' ')) && line.contains('-');
        return if separator {
            Kind::Separator
        } else {
            Kind::TableRow
        };
    }
    if let Some(rest) = line.strip_prefix("> [!") {
        let ty: String = rest
            .chars()
            .take_while(|c| c.is_ascii_alphabetic())
            .collect();
        if !ty.is_empty() && rest[ty.len()..].starts_with(']') {
            return Kind::Callout;
        }
    }
    if let Some(id) = line.trim().strip_prefix('^')
        && !id.is_empty()
        && id.chars().all(is_block_id_char)
    {
        return Kind::BlockId;
    }
    if line.trim().is_empty() {
        return Kind::Blank;
    }
    Kind::Text
}

pub fn is_block_id_char(c: char) -> bool {
    c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-'
}

/// The type of a callout line, such as `NOTE`.
pub fn callout_type(line: &str) -> Option<String> {
    let rest = line.strip_prefix("> [!")?;
    Some(
        rest.chars()
            .take_while(|c| c.is_ascii_alphabetic())
            .collect(),
    )
}

/// A ` ^id` at the end of a text line.
pub fn trailing_block_id(line: &str) -> Option<&str> {
    let t = line.trim_end();
    let at = t.rfind(" ^")?;
    let id = &t[at + 2..];
    (!id.is_empty() && id.chars().all(is_block_id_char)).then_some(id)
}

fn scan(line: &str) -> Scan {
    let chars: Vec<char> = line.chars().collect();
    let n = chars.len();
    let mut code = vec![false; n];
    let mut spans = Vec::new();
    let mut unmatched = Vec::new();

    // Code spans: a run of backticks closes at the next run of the same length on the line.
    let mut i = 0;
    while i < n {
        if chars[i] != '`' {
            i += 1;
            continue;
        }
        let open = i;
        while i < n && chars[i] == '`' {
            i += 1;
        }
        let len = i - open;
        let mut j = i;
        let mut close = None;
        while j < n {
            if chars[j] == '`' {
                let run = j;
                while j < n && chars[j] == '`' {
                    j += 1;
                }
                if j - run == len {
                    close = Some((run, j));
                    break;
                }
            } else {
                j += 1;
            }
        }
        match close {
            Some((run, end)) => {
                code[open..end].iter_mut().for_each(|c| *c = true);
                let content: String = chars[i..run].iter().collect();
                spans.push(CodeSpan {
                    start: open,
                    content: content.trim().to_string(),
                });
                i = end;
            }
            None => unmatched.push(open),
        }
    }

    // Links and wikilinks, found with code spans blanked out.
    let masked: Vec<char> = chars
        .iter()
        .enumerate()
        .map(|(i, &c)| if code[i] { ' ' } else { c })
        .collect();
    let mut target = vec![false; n];
    let mut links = Vec::new();
    let mut wikilinks = Vec::new();
    let mut i = 0;
    while i < n {
        if masked[i] == '[' && i + 1 < n && masked[i + 1] == '[' {
            wikilinks.push(i);
            i = find(&masked, i + 2, &[']', ']'])
                .map(|e| e + 2)
                .unwrap_or(n);
            continue;
        }
        if masked[i] == ']'
            && i + 1 < n
            && masked[i + 1] == '('
            && let Some(open) = matching_open(&masked, i)
            && let Some(close) = target_close(&masked, i + 2)
        {
            let raw: String = chars[i + 2..close].iter().collect();
            let start = if open > 0 && masked[open - 1] == '!' {
                open - 1
            } else {
                open
            };
            links.push(Link {
                start,
                end: close + 1,
                text: chars[open + 1..i].iter().collect(),
                target: clean_target(&raw),
            });
            target[i + 1..=close].iter_mut().for_each(|c| *c = true);
            i = close + 1;
            continue;
        }
        i += 1;
    }

    Scan {
        chars,
        code,
        target,
        spans,
        unmatched,
        links,
        wikilinks,
    }
}

fn find(chars: &[char], from: usize, pat: &[char]) -> Option<usize> {
    (from..chars.len().saturating_sub(pat.len() - 1)).find(|&k| chars[k..k + pat.len()] == *pat)
}

/// The `[` that opens the link text closed by the `]` at `close`.
fn matching_open(masked: &[char], close: usize) -> Option<usize> {
    let mut depth = 0;
    let mut k = close;
    while k > 0 {
        k -= 1;
        match masked[k] {
            ']' => depth += 1,
            '[' if depth == 0 => return Some(k),
            '[' => depth -= 1,
            _ => {}
        }
    }
    None
}

/// The first `)` from `from` that is not inside angle brackets.
fn target_close(masked: &[char], from: usize) -> Option<usize> {
    let mut angle = false;
    for (k, &c) in masked.iter().enumerate().skip(from) {
        match c {
            '<' => angle = true,
            '>' => angle = false,
            ')' if !angle => return Some(k),
            _ => {}
        }
    }
    None
}

fn clean_target(raw: &str) -> String {
    let t = raw.trim();
    if let Some(inner) = t.strip_prefix('<')
        && let Some(end) = inner.find('>')
    {
        return inner[..end].to_string();
    }
    t.split_whitespace().next().unwrap_or("").to_string()
}

fn boundary_before(chars: &[char], i: usize) -> bool {
    i == 0 || !(chars[i - 1].is_alphanumeric() || chars[i - 1] == ':' || chars[i - 1] == '-')
}

fn ends_word(chars: &[char], end: usize) -> bool {
    end >= chars.len() || !chars[end].is_alphanumeric()
}

/// Reads a kind and its number at `at`, returning the kind and the index after the number.
fn kind_at(chars: &[char], at: usize) -> Option<(&'static str, usize)> {
    for kind in ["NFR", "NR", "F"] {
        let k: Vec<char> = kind.chars().collect();
        if chars.len() >= at + k.len() && chars[at..at + k.len()] == k[..] {
            let digits = chars[at + k.len()..]
                .iter()
                .take_while(|c| c.is_ascii_digit())
                .count();
            if digits > 0 {
                return Some((kind, at + k.len() + digits));
            }
        }
    }
    None
}

/// Every prefixed requirement identifier in `chars`, skipping blanked link targets.
pub fn identifiers(chars: &[char]) -> Vec<Ident> {
    let n = chars.len();
    let mut out = Vec::new();
    let mut i = 0;
    while i < n {
        if !chars[i].is_ascii_uppercase() || !boundary_before(chars, i) {
            i += 1;
            continue;
        }
        let mut j = i;
        while j < n && chars[j].is_ascii_uppercase() {
            j += 1;
        }
        let letters = j - i;
        let mut found = None;
        if (2..=4).contains(&letters) && j < n {
            if chars[j] == '-' {
                if let Some((kind, end)) = kind_at(chars, j + 1)
                    && ends_word(chars, end)
                {
                    found = Some((chars[i..j].iter().collect::<String>(), kind, end));
                }
            } else if chars[j] == ':' {
                let mut k = j + 1;
                while k < n
                    && (chars[k].is_ascii_uppercase()
                        || chars[k].is_ascii_digit()
                        || chars[k] == '-')
                {
                    k += 1;
                }
                let run: String = chars[j + 1..k].iter().collect();
                if let Some(dash) = run.rfind('-') {
                    let name = &run[..dash];
                    let tail: Vec<char> = run[dash + 1..].chars().collect();
                    if let Some((kind, end)) = kind_at(&tail, 0)
                        && end == tail.len()
                        && (3..=12).contains(&name.len())
                        && ends_word(chars, k)
                    {
                        let prefix = format!("{}:{}", chars[i..j].iter().collect::<String>(), name);
                        found = Some((prefix, kind, k));
                    }
                }
            }
        }
        match found {
            Some((prefix, kind, end)) => {
                out.push(Ident {
                    start: i,
                    end,
                    text: chars[i..end].iter().collect(),
                    prefix,
                    kind,
                });
                i = end;
            }
            None => i = j.max(i + 1),
        }
    }
    out
}

/// Every kind and number standing alone, such as a bare F7, as `(start, end)`.
pub fn unprefixed(chars: &[char]) -> Vec<(usize, usize)> {
    let mut out = Vec::new();
    let mut i = 0;
    while i < chars.len() {
        let alone = i == 0 || !(chars[i - 1].is_alphanumeric() || chars[i - 1] == '-');
        if alone
            && let Some((_, end)) = kind_at(chars, i)
            && ends_word(chars, end)
        {
            out.push((i, end));
            i = end;
            continue;
        }
        i += 1;
    }
    out
}

/// Every `<word>-<digits>` citation with the given word, such as `ADR-0001`, as `(start, number)`.
pub fn numbered(chars: &[char], word: &str, digits: Option<usize>) -> Vec<(usize, String)> {
    let w: Vec<char> = word.chars().collect();
    let mut out = Vec::new();
    let mut i = 0;
    while i + w.len() < chars.len() {
        if chars[i..i + w.len()] == w[..] && (i == 0 || !chars[i - 1].is_alphanumeric()) {
            let from = i + w.len();
            let count = chars[from..]
                .iter()
                .take_while(|c| c.is_ascii_digit())
                .count();
            let fits = match digits {
                Some(d) => count == d,
                None => count > 0,
            };
            if fits && ends_word(chars, from + count) {
                out.push((i, chars[from..from + count].iter().collect()));
                i = from + count;
                continue;
            }
        }
        i += 1;
    }
    out
}

/// Every section citation, such as §4.2, as `(position, number)`.
pub fn section_citations(chars: &[char]) -> Vec<(usize, String)> {
    let mut out = Vec::new();
    for (i, &c) in chars.iter().enumerate() {
        if c != '§' {
            continue;
        }
        let mut j = i + 1;
        let mut number = String::new();
        loop {
            let digits: String = chars[j..]
                .iter()
                .take_while(|c| c.is_ascii_digit())
                .collect();
            if digits.is_empty() {
                break;
            }
            number.push_str(&digits);
            j += digits.len();
            if j + 1 < chars.len() && chars[j] == '.' && chars[j + 1].is_ascii_digit() {
                number.push('.');
                j += 1;
            } else {
                break;
            }
        }
        if !number.is_empty() {
            out.push((i, number));
        }
    }
    out
}

/// The section number a heading numbers, such as `3.2` for `### 3.2 Application interface`.
pub fn section_number(heading_text: &str) -> Option<String> {
    let chars: Vec<char> = heading_text.chars().collect();
    let mut j = 0;
    let mut number = String::new();
    loop {
        let digits: String = chars[j..]
            .iter()
            .take_while(|c| c.is_ascii_digit())
            .collect();
        if digits.is_empty() {
            return None;
        }
        number.push_str(&digits);
        j += digits.len();
        if j + 1 < chars.len() && chars[j] == '.' && chars[j + 1].is_ascii_digit() {
            number.push('.');
            j += 1;
            continue;
        }
        break;
    }
    match chars.get(j) {
        Some('.') | Some(' ') => Some(number),
        _ => None,
    }
}

/// Ranges of text between pairs of `**`, in a line with code spans and link targets blanked.
pub fn bold_ranges(prose: &[char]) -> Vec<(usize, usize)> {
    let mut marks = Vec::new();
    let mut i = 0;
    while i + 1 < prose.len() {
        if prose[i] == '*' && prose[i + 1] == '*' {
            marks.push(i);
            i += 2;
        } else {
            i += 1;
        }
    }
    marks
        .chunks(2)
        .filter(|p| p.len() == 2)
        .map(|p| (p[0] + 2, p[1]))
        .collect()
}

/// For each character, whether it sits between parentheses, ignoring code and link targets.
pub fn in_parens(line: &Line) -> Vec<bool> {
    let prose = line.prose();
    let mut depth: usize = 0;
    let mut out = Vec::with_capacity(prose.len());
    for &c in &prose {
        match c {
            '(' => {
                depth += 1;
                out.push(true);
            }
            ')' => {
                out.push(depth > 0);
                depth = depth.saturating_sub(1);
            }
            _ => out.push(depth > 0),
        }
    }
    out
}

/// A code span's content, if it names a document by its path from the vault root.
pub fn document_mention(content: &str) -> Option<&str> {
    let ok = content.ends_with(".md")
        && !content.starts_with('/')
        && content
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.' | '/'));
    ok.then_some(content)
}

/// Raw HTML outside code spans and link targets, as character positions of its `<`.
pub fn raw_html(prose: &[char]) -> Vec<usize> {
    let n = prose.len();
    let mut out = Vec::new();
    for i in 0..n {
        if prose[i] != '<' {
            continue;
        }
        if i + 1 < n && prose[i + 1] == '!' {
            out.push(i);
            continue;
        }
        let mut j = i + 1;
        if j < n && prose[j] == '/' {
            j += 1;
        }
        if j >= n || !prose[j].is_ascii_alphabetic() {
            continue;
        }
        while j < n && (prose[j].is_ascii_alphanumeric() || prose[j] == '-') {
            j += 1;
        }
        if j < n && matches!(prose[j], ' ' | '\t' | '/' | '>') {
            out.push(i);
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn chars(s: &str) -> Vec<char> {
        s.chars().collect()
    }

    #[test]
    fn identifiers_take_the_last_part_as_kind_and_number() {
        let found = identifiers(&chars(
            "see SHR:DOC-CHECK-F1, PLN-NFR12 and `BKG:PARSER-NR3`.",
        ));
        let texts: Vec<_> = found
            .iter()
            .map(|i| (i.text.as_str(), i.prefix.as_str(), i.kind))
            .collect();
        assert_eq!(
            texts,
            [
                ("SHR:DOC-CHECK-F1", "SHR:DOC-CHECK", "F"),
                ("PLN-NFR12", "PLN", "NFR"),
                ("BKG:PARSER-NR3", "BKG:PARSER", "NR")
            ]
        );
    }

    #[test]
    fn a_notation_is_not_an_identifier() {
        assert!(identifiers(&chars("`PREFIX-F1` and STY-V1 and SHR:DOC-CHECK")).is_empty());
    }

    #[test]
    fn a_wrapped_code_span_is_unmatched() {
        let lines = parse("one `open\nclose` two\n");
        assert_eq!(lines[0].scan.unmatched, [4]);
        assert_eq!(lines[1].scan.unmatched, [5]);
    }

    #[test]
    fn a_longer_run_holds_a_shorter_one() {
        let lines = parse("a ```` ```mermaid ```` fence\n");
        assert!(lines[0].scan.unmatched.is_empty());
        assert_eq!(lines[0].scan.spans.len(), 1);
    }

    #[test]
    fn links_inside_code_are_not_links() {
        let lines = parse("`[text](a.md)` and [real](b.md#^x)\n");
        let targets: Vec<_> = lines[0]
            .scan
            .links
            .iter()
            .map(|l| l.target.as_str())
            .collect();
        assert_eq!(targets, ["b.md#^x"]);
    }

    #[test]
    fn fences_close_on_the_same_character_at_least_as_long() {
        let kinds: Vec<_> = parse("````\n```\nx\n````\ny\n")
            .iter()
            .map(|l| l.kind)
            .collect();
        assert_eq!(
            kinds,
            [
                Kind::Fence,
                Kind::InFence,
                Kind::InFence,
                Kind::Fence,
                Kind::Text
            ]
        );
    }

    #[test]
    fn section_numbers_come_from_numbered_headings() {
        assert_eq!(section_number("4. Behaviour").as_deref(), Some("4"));
        assert_eq!(
            section_number("3.2 Application interface").as_deref(),
            Some("3.2")
        );
        assert_eq!(section_number("Purpose"), None);
    }

    #[test]
    fn raw_html_excludes_autolinks_and_comparisons() {
        assert_eq!(raw_html(&chars("a <reason> b")), [2]);
        assert_eq!(raw_html(&chars("<!-- x -->")), [0]);
        assert!(raw_html(&chars("<https://example.com> and 1 < 2 and <3")).is_empty());
    }
}
