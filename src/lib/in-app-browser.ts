// Instagram, Facebook, TikTok, and similar apps open links in their own
// embedded webview rather than the device's real browser. Those webviews
// commonly restrict or block camera access outright -- which breaks post
// capture and barcode scanning with no recovery path, since getUserMedia
// there can reject with no user-actionable error. There's no feature-
// detectable API for "is this an in-app webview," so this is a user-agent
// substring match, same approach every other site uses for this.
const IN_APP_BROWSER_UA_PATTERN =
  /Instagram|FBAN|FBAV|Line\/|MicroMessenger|TikTok|BytedanceWebview|Snapchat/i;

export function isInAppBrowser(userAgent: string): boolean {
  return IN_APP_BROWSER_UA_PATTERN.test(userAgent);
}

/** A real, tappable escape from an Android in-app webview into Chrome --
 *  `intent://` is a scheme Android's webview itself resolves (not something
 *  the host app can intercept the way it does a plain `https://` tap), so
 *  this is an actual fix, not another instruction. `S.browser_fallback_url`
 *  is what runs if Chrome isn't installed -- without it, a missing Chrome
 *  makes the tap do nothing at all instead of falling back to something.
 *
 *  No iOS equivalent exists: WebKit gives a web page no API to hand a URL to
 *  Safari, so on iOS the host app's own "Open in Browser" menu item (see the
 *  banner copy) is the only route, not a bug in this function. */
export function androidChromeIntentUrl(url: string): string {
  const { protocol, host, pathname, search, hash } = new URL(url);
  const withoutScheme = `${host}${pathname}${search}${hash}`;
  const fallback = encodeURIComponent(`${protocol}//${withoutScheme}`);
  return `intent://${withoutScheme}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${fallback};end`;
}
