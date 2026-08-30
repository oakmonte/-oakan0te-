# Faster location picker + head-start loading for onboarding

Two separate improvements: make the location sheet open instantly with Nigeria and USA ready while the rest of the world's cities stream in behind it, and make each onboarding step start fetching the next screen (and its images) before the user taps anything.

## 1. Location data: Nigeria + USA first, everything else in the background

Yes, this is possible, and it won't make anything slower.

The 8.4 MB chunk isn't countries or states — those are small (roughly 95 KB of countries, 550 KB of states). The weight is one 8 MB file containing every city on earth. Today the sheet imports all three together, so it can't show anything until the whole 8 MB lands.

The split:

- **Immediately (small, loads with the sheet):** the full country list and the full state/province list for every country. Nothing about country or state selection changes — every country is there from the first render.
- **Immediately (tiny):** a pre-built city list for Nigeria and the USA only, generated at build time from the same dataset. So a seller in Lagos or New York can pick their city with zero wait.
- **In the background (starts the moment the sheet opens):** the full world city dataset, fetched without blocking anything. When it arrives, the city picker silently upgrades to complete coverage.

If someone opens the city picker for a third country before the background load finishes, they see a brief "loading cities…" line in the picker, and the existing "type your own city" fallback still works, so they're never blocked. In practice the background fetch will usually be done first.

Nothing is removed. All countries, all states, all cities still load — just in a smarter order.

## 2. Onboarding: start loading the next page before the tap

Every onboarding step already knows exactly which screen comes next (the flow order lives in one shared file). Right now nothing is fetched until the user taps.

Change: on each onboarding screen, as soon as it settles, quietly begin fetching the next screen's code in the background. By the time the user finishes typing or picking and taps, the next screen is already in memory and appears instantly. This is a pure prefetch — no behaviour, layout, copy, or flow changes.

Steps that get this: choose username, seller type, where did you hear about us, name your store, find your fit, what's your style.

### Find your fit gets extra treatment

That screen carries 19 body-type illustrations plus two large measurement guides — the heaviest onboarding screen by far. On the step *before* it ("where did you hear about us"), we'll also start warming its images in the background, in priority order:

1. The body-type illustrations shown in the first visible row.
2. The remaining illustrations.
3. The two measurement guide images.

So by the time the user lands there, the pictures are already decoded and appear without the current pop-in. Existing lazy-loading on the page stays exactly as is — the warm-up just fills the browser cache ahead of time.

## Technical notes

- A build-time script writes a small `ng-us-cities` JSON asset from `country-state-city`'s dataset; `LocationSheet` imports `Country`/`State` statically and resolves cities through a small module that returns the seed set synchronously and swaps in the dynamically imported full `City` dataset when ready.
- Prefetch uses TanStack Router's `router.preloadRoute` for the next step from `nextRoute(...)`, fired in an effect after mount (idle-callback deferred so it never competes with the current screen's own render).
- Image warming uses `new Image()` preloads against the already-imported asset URLs, batched in priority tiers behind `requestIdleCallback`.
- Verification: production build to confirm the initial location chunk drops from ~8.4 MB to well under 1 MB, plus a preview network check that the next onboarding route's chunk is requested before any tap.
