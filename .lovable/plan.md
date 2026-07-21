# Fix: page pans sideways on mobile

## Root cause
The mobile menu drawer (`src/routes/index.tsx` line 302) and its inner sub-menu panel (line 338) sit off-screen at `translate-x-full` when closed. Because nothing clips the horizontal axis at the page or drawer-container level, that off-screen content extends the scrollable width of the page — so on touch devices the user can swipe/pan sideways and reveal empty space (and briefly the hidden drawer).

## Change
Add a global `overflow-x: hidden` guard so off-screen transformed elements never contribute to page width. No layout, spacing, animation, or drawer behavior changes.

### Technical detail
In `src/styles.css`, add:

```css
html, body {
  overflow-x: hidden;
  overscroll-behavior-x: none;
}
```

- `overflow-x: hidden` clips the horizontal axis so the off-screen drawer can't be scrolled/swiped into view as page content.
- `overscroll-behavior-x: none` disables the rubber-band horizontal bounce on iOS Safari for the same reason.
- Vertical scrolling is untouched.

## Verification
- On mobile viewport, try swiping left/right on the home page — page should stay put.
- Open the hamburger menu, tap into Products/Solutions/etc. — drawer + sub-panel slide-in animations still work exactly as before.
- Close menu — no residual horizontal scroll.
