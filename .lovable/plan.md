# Finish the Oakmonte Messages experience

## Goal
Replace the current `/messages` mockup with a polished, mobile-first marketplace inbox and thread experience, following the uploaded brief and using the reference screenshots only for layout rhythm and density.

## What will be built
- A functional inbox with live debounced search, highlights, empty results, unread/presence/typing/status states, timestamps, and touch swipe actions.
- A working multi-select filter sheet with count, clear, apply, and removable active-filter chips.
- Designed Offers and Orders previews with blurred sample cards and a smoothly sliding tab indicator.
- A compact story rail and auto-dismissing availability notice.
- In-page thread navigation with browser/phone back support, sticky contact header, label menu, date dividers, grouped bubbles, timestamps, seen state, typing state, and safe auto-scroll behavior.
- Long-press reactions and actions, swipe-to-reply, quoted replies, quick replies, and a growing mobile composer that replaces the bottom navigation while chatting.
- Marketplace-native product, offer, and order message cards with local interactions.
- Skeleton loading, reduced-motion support, touch-friendly controls, and mobile verification at 390 × 844.

## Technical details
- Preserve the existing `support_messages` read, insert, realtime subscription, auth handling, errors, and `messagingClient` cast exactly in behavior.
- Keep all other conversations as removable Postgres-shaped local seed data; do not change the database.
- Split the interface into focused files under the existing messages component area, while leaving the route mostly responsible for state and wiring.
- Use the existing Oakmonte black/white palette, semantic styling, Lucide controls, and liquid-glass treatment; no Instagram colors, gradients, badge, or icon copying.
- Keep the thread inside `/messages`, with `history.pushState`/back handling so inbox scroll position survives.
- Run typecheck, lint, tests, production build, then verify the complete interaction flow in the browser at 390 × 844.
