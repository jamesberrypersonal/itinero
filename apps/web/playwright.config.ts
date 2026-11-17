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
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
  ],
});
