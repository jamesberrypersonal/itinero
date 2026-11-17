// The part of the build that makes the web app an installable version (docs/spec/web/shell.md
// §4.6). Once Vite has written the bundle, it:
//
// 1. lists the version's files, and names the version by a hash of them
// 2. writes the version into index.html, and writes /version.json
// 3. writes /sw.js from src/shell/sw.ts, with the version in it
// 4. writes /time-zone-rules.json, beside the version's files and not one of them
// 5. copies the places' files into /places/, beside the version's files and not among them
//    (docs/spec/web/places.md §3.2)
//
// It also gives the app the module `virtual:itinero-rules`: the version's own rules file, which it
// copies from @itinero/trip-time into the version's files, named by a hash of its contents.

import { createHash } from "node:crypto";
import { cpSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { transformWithOxc, type Plugin, type ResolvedConfig } from "vite";
import { newestRules, type RulesFile } from "./rules-file.ts";

const VIRTUAL_RULES = "virtual:itinero-rules";
const RESOLVED_RULES = `\0${VIRTUAL_RULES}`;
const VERSION_PLACEHOLDER = "__ITINERO_VERSION__";
/** Files beside the version that are not part of it. */
const OUTSIDE_VERSION = new Set(["sw.js", "version.json", "time-zone-rules.json", "index.html"]);
/** The folder of the places' files, beside the version and not part of it. */
const PLACES = "places";

export function sha256(data: string | Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

export function shellPlugin(): Plugin {
  let config: ResolvedConfig;
  let rules: RulesFile | undefined;

  async function rulesFile(resolve: (id: string) => Promise<{ id: string } | null>): Promise<RulesFile> {
    if (rules) return rules;
    const entry = await resolve("@itinero/trip-time");
    if (!entry) throw new Error("@itinero/trip-time cannot be found");
    rules = newestRules(join(dirname(entry.id), "..", "rules"));
    return rules;
  }

  return {
    name: "itinero-shell",

    configResolved(resolved) {
      config = resolved;
    },

    resolveId(id) {
      return id === VIRTUAL_RULES ? RESOLVED_RULES : undefined;
    },

    async load(id) {
      if (id !== RESOLVED_RULES) return undefined;
      const file = await rulesFile((source) => this.resolve(source));
      if (config.command === "serve") {
        return `export const url = "/time-zone-rules.json";\nexport const release = ${JSON.stringify(file.release)};\n`;
      }
      const fileName = `assets/time-zone-rules-${sha256(file.contents).slice(0, 12)}.json`;
      this.emitFile({ type: "asset", fileName, source: file.contents });
      return `export const url = "/${fileName}";\nexport const release = ${JSON.stringify(file.release)};\n`;
    },

    configureServer(server) {
      // In development, the places' files are served from the folder the build copies.
      server.middlewares.use("/places", (request, response, next) => {
        const name = (request.url ?? "").replace(/^\//, "").split("?")[0]!;
        if (!/^[A-Za-z]+\.json$/.test(name)) return next();
        try {
          response.setHeader("Content-Type", "application/json");
          response.end(readFileSync(join(config.root, PLACES, name)));
        } catch {
          next();
        }
      });
      // In development, the newest rules are served as the online side's address serves them.
      server.middlewares.use("/time-zone-rules.json", (_request, response) => {
        response.setHeader("Content-Type", "application/json");
        response.end(rules?.contents ?? "{}");
      });
    },

    closeBundle: {
      order: "post",
      sequential: true,
      async handler() {
        if (config.command !== "build") return;
        const outDir = resolve(config.root, config.build.outDir);
        if (!rules) throw new Error("The rules file was never loaded into the build");
        await writeVersion(outDir, config.root, rules);
      },
    },
  };
}

/** Every file under `dir`, as paths relative to it with forward slashes, in byte order. */
function filesUnder(dir: string): string[] {
  const found: string[] = [];
  const walk = (current: string) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) walk(path);
      else found.push(relative(dir, path).split(sep).join("/"));
    }
  };
  walk(dir);
  return found.sort();
}

async function writeVersion(outDir: string, root: string, rules: RulesFile): Promise<void> {
  const indexPath = join(outDir, "index.html");
  const index = readFileSync(indexPath, "utf8");
  const others = filesUnder(outDir).filter((file) => !OUTSIDE_VERSION.has(file) && !file.startsWith(`${PLACES}/`));

  // The version is named by the hash of its files, index.html among them, so a version is never
  // named the same as another with different contents.
  const hash = createHash("sha256");
  hash.update(`/\0${sha256(index)}\n`);
  for (const file of others) hash.update(`/${file}\0${sha256(readFileSync(join(outDir, file)))}\n`);
  const version = hash.digest("hex").slice(0, 12);

  if (!index.includes(VERSION_PLACEHOLDER)) throw new Error("index.html holds no place for the version");
  writeFileSync(indexPath, index.replaceAll(VERSION_PLACEHOLDER, version));

  const files = ["/", ...others.map((file) => `/${file}`)];
  writeFileSync(join(outDir, "version.json"), `${JSON.stringify({ version, files }, null, 2)}\n`);

  const source = readFileSync(join(root, "src", "shell", "sw.ts"), "utf8");
  const stripped = await transformWithOxc(source, "sw.ts", { lang: "ts" });
  const worker = stripped.code.replace(/^export\s*\{\s*\};?\s*$/m, "").replaceAll(VERSION_PLACEHOLDER, version);
  writeFileSync(join(outDir, "sw.js"), worker);

  writeFileSync(join(outDir, "time-zone-rules.json"), rules.contents);

  cpSync(join(root, PLACES), join(outDir, PLACES), { recursive: true });
}
