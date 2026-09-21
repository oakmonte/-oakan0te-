# Routes

TanStack Start uses **file-based routing**. Every `.tsx` file in this directory
defines a route. Do **not** create `src/pages/`, `src/routes/_app/index.tsx`, or
`app/layout.tsx` — those are Next.js / Remix conventions. The only root layout
is `src/routes/__root.tsx`.

## Conventions

| File                     | URL                                                     |
| ------------------------ | ------------------------------------------------------- |
| `index.tsx`              | `/`                                                     |
| `about.tsx`              | `/about`                                                |
| `users/index.tsx`        | `/users`                                                |
| `users/$id.tsx`          | `/users/:id` (dynamic — bare `$`, no curly braces)      |
| `posts/{-$category}.tsx` | `/posts/:category?` (optional segment)                  |
| `files/$.tsx`            | `/files/*` (splat — read via `_splat` param, never `*`) |
| `_layout.tsx`            | layout route (renders children via `<Outlet />`)        |
| `__root.tsx`             | app shell — wraps every page; preserve `<Outlet />`     |

`routeTree.gen.ts` is auto-generated. Don't edit it by hand.

## Back navigation is hierarchical, not historical

The iOS edge-swipe walks the **browser history stack** — every screen the user has ever
visited, in order. Native apps walk the **hierarchy**: Settings goes up to Profile no matter
how you arrived. The gesture itself cannot be intercepted, blocked or scoped by any web API,
so the only lever is keeping the history stack shallow and shaped like the hierarchy.

Three rules make that work. Breaking any one of them re-introduces the bug.

1. **A back affordance must never `navigate()` to a hardcoded destination.** That pushes a
   new entry, so tapping "back" makes the stack _longer_ and the swipe replays the growth.
   Use `<BackButton>` (`src/components/BackButton.tsx`), or `useBack()` directly.
   `useBack` pops to the ancestor when it is behind us and only replaces when it is not.
2. **Root screens must sit at history index 0.** `BottomNav` routes every tab through
   `useGoRoot()`, which unwinds the stack before replacing. This is what lets the swipe
   leave the app from `/home` instead of walking back through old screens.
3. **An overlay that covers the screen needs a history entry.** `useOverlayHistory(open, onClose)`
   pushes one so back closes the sheet rather than leaving the page under it.

The hierarchy itself is `parentOf()` in `src/lib/nav-hierarchy.ts`; `null` means "root".

### `/create` is deliberately excluded

`isUnmanaged()` returns true for the whole `/create` tree, so none of the above applies there
and nothing in that flow changed. That is not an oversight — the camera flow returns by
**origin**, not by stack, and three separate mechanisms depend on it:

- `create.after-shot.publish.tsx` picks its back destination from `media.origin`, because a
  video-editor post never passes through the after-shot screen.
- `create.after-shot.tsx` self-evicts to `/create` with `replace: true` once the capture has
  been consumed — `capture-handoff.ts` yields its payload exactly once.
- `create.index.tsx` uses `getLastNonCreateRoute()` rather than `history.back()`, because
  `back()` competes with the host app's own handling inside the Instagram/TikTok webview.

**To bring `/create` in:** drop it from `UNMANAGED_PREFIXES`, add its parents to `parentOf`
(`/create/after-shot/*` → `/create/after-shot`, and the origin-dependent publish case via
`BackButton`'s `to` prop, the same way `store.collections_.new.tsx` passes its `returnTo`),
then swap each hand-rolled chevron for `<BackButton>`. The studio's unsaved-work confirm maps
onto `BackButton`'s `onIntercept` prop. All three mechanisms above must survive; the
consumed-capture guard in particular is fragile and must not be leaned on by the stack.
