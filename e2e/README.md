# e2e

Playwright, used mainly as a **screenshot sweep for design work** rather than as
an assertion suite. `bun run shots` writes one PNG per route per device into
`e2e/screens/`, which is gitignored.

```
bun run e2e              # run everything
bun run shots            # the screenshot sweep, both devices
bun run shots:iphone     # WebKit / iPhone 13 only
bun run e2e:ui           # Playwright's interactive UI mode
```

The dev server starts automatically, or attaches to one already on :8080.

## What this cannot test

Playwright's WebKit is **not iOS Safari**, and no amount of configuration makes
it one. None of the following exist here, and all of them are load-bearing in
this app:

- the standalone storage jar (`isStandalone()` always reports a browser tab)
- Add to Home Screen, and the `installed_app` stamp that depends on it
- camera permission surviving between launches
- passkeys, Face ID, `beforeinstallprompt`
- anything branching on `isIOS()` — the UA is emulated, the OS behaviour is not

Those need a real phone. See CLAUDE.md, "Installable web app".

## Signed-in routes

`screens.spec.ts` only covers signed-out routes, because a saved session is the
only way in and producing one means typing a password — which Claude does not
do. To capture authed screens yourself:

```
bunx playwright open --save-storage=e2e/.auth/state.json http://localhost:8080/sign-in
```

Sign in in the window that opens, close it, then add
`test.use({ storageState: "e2e/.auth/state.json" })` to a spec. `e2e/.auth/` is
gitignored — the file is a live session token, treat it like a password.
