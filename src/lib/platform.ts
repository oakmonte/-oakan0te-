// The one OS branch in the app.
//
// Almost everything else that looks like it needs a browser check does not.
// `isPasskeySupported` is a real capability probe, `isStandalone` reads a real
// display mode, and `isInAppBrowser` matches webviews that announce themselves.
// This file exists for the single question none of those can answer: does
// installing this site to the home screen sign the user out?
//
// On iOS it does. A standalone iOS web app gets its own cookie and localStorage
// jar, separate from the browser's, so the session does not come with it. There
// is no feature test for that -- it is an OS behaviour -- which is why a user
// agent sniff is the only option here.
//
// It covers every browser on the platform at once, because iOS forces them all
// onto WebKit: Chrome, Edge, Firefox, Brave and Opera on an iPhone behave
// exactly like Safari for install and storage. Android needs no entry at all --
// an installed WebAPK shares the installing browser's jar, so nobody there is
// ever signed out.

/** True on iPhone, iPod, and iPad — including modern iPads, which do not say so. */
export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  if (/iPhone|iPad|iPod/.test(navigator.userAgent)) return true;
  // iPadOS 13+ reports itself as a Mac and drops "iPad" from the UA entirely.
  // A touchscreen is what separates it from a real desktop Safari.
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}
