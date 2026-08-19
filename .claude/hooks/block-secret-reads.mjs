#!/usr/bin/env node
// PreToolUse/Bash hook: refuse shell commands that read secret-bearing files.
//
// The permissions deny list covers Read(./.env), but that only governs the Read
// tool. `head .env`, `grep X .env`, `cat id_rsa` all go through Bash, and several
// of those commands are on the allow list — so without this the deny is theatre.
//
// Once a secret enters the transcript it is exposed; there is no un-reading it.
// Erring toward over-blocking is correct here: a false positive costs one retry,
// a false negative costs a credential rotation.

const PATTERNS = [
  // .env, .env.local, ./.env — but NOT process.env, src/env.ts, VITE_ENV
  /(^|[\s'"=(/])\.env(\s|$|['")]|\.[A-Za-z])/,
  // private keys and certificate bundles
  /[\w./-]+\.(pem|key|p12|pfx|jks|keystore)(\s|$|['")])/i,
  // conventional key filenames, with or without a path
  /(^|[\s'"=(/])(id_rsa|id_dsa|id_ecdsa|id_ed25519)(\s|$|['")])/,
  // a secrets/ or .secrets/ directory anywhere in the command
  /(^|[\s'"=(/])\.?secrets\//,
  // credential stores people actually keep in repos
  /(^|[\s'"=(/])(\.npmrc|\.pgpass|\.netrc|credentials\.json|serviceAccount\w*\.json)(\s|$|['")])/i,
];

let raw = "";
process.stdin.on("data", (chunk) => (raw += chunk));
process.stdin.on("end", () => {
  let command = "";
  try {
    command = JSON.parse(raw)?.tool_input?.command ?? "";
  } catch {
    process.exit(0); // unparseable payload: stay out of the way
  }

  if (!PATTERNS.some((p) => p.test(command))) process.exit(0);

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason:
          "Blocked: this command reads a secret-bearing file (.env, private key, or credential " +
          "store). Anything read here lands in the transcript permanently. If you need a specific " +
          "value, ask the user for it directly rather than reading the file.",
      },
    }),
  );
  process.exit(0);
});
