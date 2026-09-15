// Proof that a track URL came out of our own catalogue.
//
// `/api/sound-file` will fetch any URL on the audio host allowlist. That is
// enough to stop it being a general proxy, but not enough to stop it serving a
// track the catalogue deliberately filtered out — an NC-licensed ccMixter
// upload is on an allowlisted host like every other ccMixter upload, so a
// hand-built request could pull one the picker refuses to show.
//
// The fix is to make the proxy accept only URLs it issued itself. `/api/sounds`
// signs each track it returns, AFTER `isUsableTrack` and `isLicenceUsable` have
// run, so a signature is a statement that this exact URL passed those checks.
//
// Signing rather than re-resolving the track id upstream, which was the other
// option: re-resolving means another request to the provider for every pick,
// and Jamendo's free tier is 35,000 requests a month. A signature costs
// nothing and proves something stronger — not "this id is usable now" but
// "this URL is one we offered".
//
// NOT a security boundary against the signed-in user themselves. Anyone can
// publish through `api.posts` with credit fields of their choosing; what this
// closes is the proxy becoming a way to launder tracks the catalogue rejected.

const KEY_INFO = "oakmonte-sound-url-v1";

/** Six hours. A seller picks a track and the editor fetches it within seconds,
 *  so this only has to outlive a signature sitting in a stale search result on
 *  a screen someone left open. */
const TTL_SECONDS = 6 * 60 * 60;

let cachedKey: Promise<CryptoKey> | null = null;

/** The HMAC key.
 *
 *  Derived from a secret the server already has rather than adding another
 *  one to configure — a deployment that forgets a new env var would either
 *  break the catalogue or, worse, quietly fall back to unsigned. The service
 *  role key never leaves the server and is never sent anywhere; only a
 *  derivative of it is used, and only to sign our own URLs.
 *
 *  `SOUND_URL_SIGNING_KEY` overrides it for anyone who would rather the two
 *  secrets be rotated independently. */
function signingKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;
  const secret = process.env.SOUND_URL_SIGNING_KEY || process.env.MY_SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) {
    return Promise.reject(new Error("sound-url-signature: no server secret to derive a key from"));
  }
  cachedKey = crypto.subtle
    .importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
      "sign",
    ])
    .then((base) =>
      crypto.subtle
        .sign("HMAC", base, new TextEncoder().encode(KEY_INFO))
        .then((derived) =>
          crypto.subtle.importKey("raw", derived, { name: "HMAC", hash: "SHA-256" }, false, [
            "sign",
          ]),
        ),
    );
  return cachedKey;
}

function hex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function digest(url: string, expires: number): Promise<string> {
  const key = await signingKey();
  // The expiry is inside the signed payload, so it cannot be extended by
  // editing the query string.
  return hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${url}\n${expires}`)));
}

export type SignedUrl = { sig: string; exp: number };

/** Sign one track URL. Returns null rather than throwing: a catalogue that
 *  answers without signatures is better than one that 500s, and the proxy
 *  refusing an unsigned URL is a visible failure rather than a silent one. */
export async function signTrackUrl(url: string): Promise<SignedUrl | null> {
  try {
    const exp = Math.floor(Date.now() / 1000) + TTL_SECONDS;
    return { sig: await digest(url, exp), exp };
  } catch (error) {
    console.error("sound-url-signature: could not sign", error);
    return null;
  }
}

export async function verifyTrackUrl(url: string, sig: string, exp: number): Promise<boolean> {
  if (!sig || !Number.isFinite(exp)) return false;
  if (exp < Math.floor(Date.now() / 1000)) return false;
  try {
    const expected = await digest(url, exp);
    // Constant-time: a byte-by-byte early exit would let someone with a valid
    // URL and an invalid signature discover the right one a nibble at a time.
    if (expected.length !== sig.length) return false;
    let diff = 0;
    for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
    return diff === 0;
  } catch (error) {
    console.error("sound-url-signature: could not verify", error);
    return false;
  }
}
