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
