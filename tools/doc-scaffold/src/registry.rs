//! The component registry, `components.md`, as doc-scaffold reads it (§4.2).

use crate::md::File;

pub struct System {
    pub slug: String,
    pub prefix: String,
    pub is: String,
}

pub struct Component {
    pub system: String,
    pub slug: String,
    pub prefix: String,
}

pub struct Concern {
    pub slug: String,
    pub prefix: String,
    /// The section every component specification numbers for it, such as `5.1`.
    pub section: Option<String>,
}

pub struct Registry {
    pub systems: Vec<System>,
    pub components: Vec<Component>,
    pub concerns: Vec<Concern>,
}

pub const TABLES: [&str; 4] = [
    "Systems",
    "Components",
    "Booking kinds",
    "Cross-cutting concerns",
];

impl Registry {
    pub fn read(file: &File) -> Result<Registry, String> {
        let mut reg = Registry {
            systems: Vec::new(),
            components: Vec::new(),
            concerns: Vec::new(),
        };
        for name in TABLES {
            let table = file
                .table_under(2, name)
                .ok_or(format!("docs/components.md has no {name} table"))?;
            for row in table.rows() {
                let get = |col: &str| file.cell(table, row, col).unwrap_or_default();
                match name {
                    "Systems" => reg.systems.push(System {
                        slug: get("System"),
                        prefix: get("Prefix"),
                        is: get("Is"),
                    }),
                    "Components" => reg.components.push(Component {
                        system: get("System"),
                        slug: get("Component"),
                        prefix: get("Prefix"),
                    }),
                    "Booking kinds" => {
                        let prefix = get("Prefix");
                        let slug = prefix
                            .split_once(':')
                            .map(|(_, k)| k.to_lowercase())
                            .unwrap_or_else(|| get("Kind").to_lowercase());
                        reg.components.push(Component {
                            system: "bookings".into(),
                            slug,
                            prefix,
                        });
                    }
                    _ => {
                        let section = get("Covered in each specification at");
                        let section = section.trim_start_matches('§').trim().to_string();
                        reg.concerns.push(Concern {
                            slug: get("Concern"),
                            prefix: get("Prefix"),
                            section: (!section.is_empty()).then_some(section),
                        });
                    }
                }
            }
        }
        Ok(reg)
    }

    pub fn system(&self, slug: &str) -> Option<&System> {
        self.systems.iter().find(|s| s.slug == slug)
    }

    /// Every registered address, in the registry's order: systems, components, then concerns.
    pub fn addresses(&self) -> Vec<String> {
        let mut out: Vec<String> = self.systems.iter().map(|s| s.slug.clone()).collect();
        out.extend(
            self.components
                .iter()
                .map(|c| format!("{}/{}", c.system, c.slug)),
        );
        out.extend(self.concerns.iter().map(|c| format!("concerns/{}", c.slug)));
        out
    }

    pub fn prefixes(&self) -> Vec<&str> {
        let mut out: Vec<&str> = self.systems.iter().map(|s| s.prefix.as_str()).collect();
        out.extend(self.components.iter().map(|c| c.prefix.as_str()));
        out.extend(self.concerns.iter().map(|c| c.prefix.as_str()));
        out
    }

    /// Where a system's rows sort among the systems: its place in the Systems table, with
    /// `shared` after every system.
    pub fn order(&self, system: &str) -> usize {
        self.systems
            .iter()
            .position(|s| s.slug == system)
            .unwrap_or(self.systems.len())
    }
}
