// Builds the web app into dist/, which the online side's Worker serves (docs/spec/web/shell.md §4.6).

import { defineConfig } from "vite";
import { shellPlugin } from "./plugins/shell-plugin.ts";

// The browser tests build several versions, which differ only by these (docs/spec/web/shell.md §4.5).
const testApi = process.env["ITINERO_API"];
const testMark = process.env["ITINERO_BUILD_MARK"];

export default defineConfig({
  oxc: { jsx: { runtime: "automatic", importSource: "preact" } },
  define: {
    __ITINERO_TEST__: JSON.stringify(process.env["ITINERO_TEST"] === "1"),
    ...(testApi ? { __ITINERO_API__: JSON.stringify(Number(testApi)) } : {}),
  },
  build: {
    outDir: process.env["ITINERO_OUT_DIR"] ?? "dist",
    emptyOutDir: true,
  },
  plugins: [
    shellPlugin(),
    {
      name: "itinero-build-mark",
      transformIndexHtml: (html) =>
        testMark ? html.replace("</head>", `  <meta name="itinero-build" content="${testMark}" />\n  </head>`) : html,
    },
  ],
});
