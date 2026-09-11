// The proxy's whole reason to refuse a URL is this check. A bug that made it
// answer true would not break anything visible — the catalogue would keep
// working, tracks would keep playing — it would just quietly turn
// `/api/sound-file` back into "any URL on an allowlisted host", which is the
// thing it exists not to be. So it is worth a test even though nothing else
// about the sound library is.

import { expect, test, describe } from "bun:test";

process.env.SOUND_URL_SIGNING_KEY = "test-key-not-a-real-secret";

const { signTrackUrl, verifyTrackUrl } = await import("./sound-url-signature.server");

const URL_A = "https://upload.wikimedia.org/wikipedia/commons/transcoded/a/ab/Song.ogg/Song.mp3";
const URL_B = "https://ccmixter.org/content/artist/artist_-_other.mp3";

describe("track url signatures", () => {
  test("a freshly signed url verifies", async () => {
    const signed = await signTrackUrl(URL_A);
    expect(signed).not.toBeNull();
    expect(await verifyTrackUrl(URL_A, signed!.sig, signed!.exp)).toBe(true);
  });

  test("a signature does not carry to another url", async () => {
    // The case that matters: a valid stamp for a track the catalogue offered,
    // replayed against an NC track on the same allowlisted host.
    const signed = await signTrackUrl(URL_A);
    expect(await verifyTrackUrl(URL_B, signed!.sig, signed!.exp)).toBe(false);
  });

  test("the expiry cannot be extended", async () => {
    // It is inside the signed payload, so moving it invalidates the signature
    // rather than buying more time.
    const signed = await signTrackUrl(URL_A);
    expect(await verifyTrackUrl(URL_A, signed!.sig, signed!.exp + 86_400)).toBe(false);
  });

  test("an expired stamp is refused", async () => {
    const signed = await signTrackUrl(URL_A);
    expect(await verifyTrackUrl(URL_A, signed!.sig, Math.floor(Date.now() / 1000) - 1)).toBe(false);
  });

  test("a missing or malformed signature is refused, not waved through", async () => {
    const signed = await signTrackUrl(URL_A);
    expect(await verifyTrackUrl(URL_A, "", signed!.exp)).toBe(false);
    expect(await verifyTrackUrl(URL_A, "deadbeef", signed!.exp)).toBe(false);
    expect(await verifyTrackUrl(URL_A, signed!.sig, Number.NaN)).toBe(false);
    // Same length, different content — the constant-time compare still has to
    // say no, and a length-only check would say yes.
    const flipped = signed!.sig.slice(0, -1) + (signed!.sig.endsWith("0") ? "1" : "0");
    expect(await verifyTrackUrl(URL_A, flipped, signed!.exp)).toBe(false);
  });
});
