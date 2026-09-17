import { test, expect } from "@playwright/test";

// A screenshot sweep, not an assertion suite. Point it at a set of routes and
// it drops a PNG per route per device into e2e/screens/, so a design change can
// be looked at side by side instead of navigated to one screen at a time.
//
// Signed-out routes only. Everything behind auth needs a saved storage state
// (see e2e/README.md) -- which has to be produced by a human signing in, since
// nothing here should be handling anyone's password.
const ROUTES = [
  { path: "/", name: "landing" },
  { path: "/sign-in", name: "sign-in" },
  { path: "/set-up-store", name: "set-up-store" },
  { path: "/become-a-creator", name: "become-a-creator" },
  { path: "/become-a-curator", name: "become-a-curator" },
  { path: "/terms", name: "terms" },
  { path: "/privacy", name: "privacy" },
];

for (const route of ROUTES) {
  test(`screenshot ${route.name}`, async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto(route.path, { waitUntil: "load" });
    // Entry animations are 180-300ms (see .oak-motion-* in styles.css) and the
    // typing headline on /welcome runs longer. Settle before capturing or the
    // shot catches a half-faded element and every diff looks like a change.
    await page.waitForTimeout(800);

    await page.screenshot({
      path: `e2e/screens/${testInfo.project.name}-${route.name}.png`,
      fullPage: true,
    });

    // The sweep is for looking at, but a route that threw while rendering is
    // worth failing on -- that is exactly the /create module-scope hook crash,
    // which passed typecheck and build and only showed up at run time.
    expect(errors, `${route.path} threw while rendering`).toEqual([]);
  });
}
