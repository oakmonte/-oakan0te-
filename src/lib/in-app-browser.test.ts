import { describe, expect, test } from "bun:test";
import { androidChromeIntentUrl, isInAppBrowser } from "./in-app-browser";

describe("isInAppBrowser", () => {
  test("matches known in-app webviews", () => {
    expect(isInAppBrowser("Mozilla/5.0 Instagram 300.0.0.0")).toBe(true);
    expect(isInAppBrowser("Mozilla/5.0 (Linux; Android 13) Snapchat/12.0")).toBe(true);
    expect(isInAppBrowser("Mozilla/5.0 FBAN/FBIOS")).toBe(true);
  });

  test("leaves a real browser alone", () => {
    expect(isInAppBrowser("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Safari/604.1")).toBe(false);
  });
});

describe("androidChromeIntentUrl", () => {
  test("carries the host, path and query into the intent, https-only", () => {
    const url = androidChromeIntentUrl("https://oakmonte.store/pricing?ref=bio");
    expect(url).toBe(
      "intent://oakmonte.store/pricing?ref=bio#Intent;scheme=https;package=com.android.chrome;" +
        `S.browser_fallback_url=${encodeURIComponent("https://oakmonte.store/pricing?ref=bio")};end`,
    );
  });

  test("still resolves a plain http source to an https intent", () => {
    // The page itself is always served over https, but this guards against a
    // dev/test URL slipping through -- Chrome's fallback still has to be a
    // real reachable scheme either way.
    const url = androidChromeIntentUrl("http://localhost:8080/");
    expect(url).toContain("scheme=https");
    expect(url).toContain(encodeURIComponent("http://localhost:8080/"));
  });
});
