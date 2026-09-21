import { defineConfig, devices } from "@playwright/test";

// Oakmonte is a mobile-first webapp, so there is deliberately no desktop
// project here. Every screen is designed against a phone viewport and a desktop
// run would report failures nobody is ever going to see.
//
// WHAT THIS CANNOT TEST, and it is most of what is load-bearing in this repo:
// Playwright's WebKit is not iOS Safari. The standalone storage jar, Add to
// Home Screen, `navigator.standalone`, camera-permission persistence across
// launches, passkeys and Face ID are all OS behaviours that do not exist here.
// Anything gated on `isStandalone()` or `isIOS()` renders its browser-tab
// branch. Those still need a real phone -- see CLAUDE.md's "Installable web
// app" section. This covers layout, copy, routing and ordinary interaction.
export default defineConfig({
  // Outside src/, which is what keeps these files out of `tsc --noEmit` --
  // tsconfig.json's `include` only reaches into src/. Same arrangement the
  // bun tests already have, for the same reason.
  testDir: "./e2e",
  outputDir: "./e2e/.artifacts",
  snapshotDir: "./e2e/.snapshots",
  // The dev server is one process; parallel workers against it mostly queue.
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:8080",
    // On failure only -- a trace per passing test fills a gigabyte fast.
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    // WebKit, because it is the closest engine to what every iPhone runs --
    // on iOS even Chrome and Firefox are WebKit underneath.
    { name: "iphone", use: { ...devices["iPhone 13"] } },
    { name: "android", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: "bun run dev",
    url: "http://localhost:8080",
    // Attach to the dev server already running rather than fighting it for
    // the port, which is the normal case on this machine.
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
