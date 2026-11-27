// The browser tests of the web app, in the three engines of WEB-NFR3: Chromium, WebKit and Firefox
// (docs/spec/web/shell.md §4.5). Each test file starts its own stand-in for the online side.

import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "test/browser",
  testMatch: "**/*.spec.ts",
  globalSetup: "./test/browser/versions.ts",
  outputDir: "test-results",
  fullyParallel: true,
  forbidOnly: !!process.env["CI"],
  retries: 0,
  reporter: process.env["CI"] ? [["list"], ["github"]] : "list",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  // A failed test keeps its trace and a screenshot in test-results/, which CI uploads.
  use: { actionTimeout: 15_000, trace: "retain-on-failure", screenshot: "only-on-failure" },
  // The timing test of WEB:SHELL-NFR1 runs once every other test has finished, one engine at a
  // time, so that no other test shares the machine while it measures.
  projects: [
    { name: "chromium", testIgnore: "timing.spec.ts", use: { ...devices["Desktop Chrome"] } },
    { name: "webkit", testIgnore: "timing.spec.ts", use: { ...devices["Desktop Safari"] } },
    { name: "firefox", testIgnore: "timing.spec.ts", use: { ...devices["Desktop Firefox"] } },
    { name: "timing-chromium", testMatch: "timing.spec.ts", dependencies: ["chromium", "webkit", "firefox"], use: { ...devices["Desktop Chrome"] } },
    { name: "timing-webkit", testMatch: "timing.spec.ts", dependencies: ["timing-chromium"], use: { ...devices["Desktop Safari"] } },
    { name: "timing-firefox", testMatch: "timing.spec.ts", dependencies: ["timing-webkit"], use: { ...devices["Desktop Firefox"] } },
  ],
});
