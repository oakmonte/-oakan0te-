# Product-form UI conventions

The seller-facing product form (`src/routes/store.products_.new.tsx` + this directory) follows a
deliberate mobile pattern. Match it rather than inventing per-screen styling.

- Reuse the primitives in `ui.tsx` (`TextField`, `PriceField`, `StubRow`, `ExpandRow`) before writing
  new styled inputs or rows.
- **Rows, not chips, for anything selectable in a list.** Full-width rounded-`xl` rows: optional
  leading swatch/icon, label, trailing check circle on the right. Chips are only for compact
  secondary pickers (e.g. option-name presets).
- **Selected state is black.** Chips: `bg-black text-white border-black`. Rows: `border-black
  bg-gray-50` plus a filled black check. There is no accent color anywhere in this form.
- Section headers `text-[15px] font-semibold text-gray-900`; hints `text-xs text-gray-400`; inputs
  `rounded-xl px-4 py-4 focus:border-gray-400`.
- Section breaks are an 8px gray bar: `border-b-8 border-gray-50` between page sections, or
  `-mx-4 h-2 bg-gray-50` to split segments inside a full-screen sheet.
- **Always offer one-tap *and* typing** in the same view — curated presets plus a free-text input, no
  mode toggle. Typed values pin above the presets so they survive a preset-list swap.
- **Full-screen sheets**, not bottom drawers: `fixed inset-0 z-50 bg-white flex flex-col min-h-dvh`
  with a sticky Cancel / title / Save header.
- **Any sheet containing a text input must call `useLockedViewport()`** (`@/hooks/use-locked-viewport`)
  so the mobile keyboard overlays the page instead of pushing it up. Easy to forget on new sheets;
  see `OptionEditorSheet.tsx`.

Variants are built and working: `VariantMatrixBuilder.tsx` owns the options list and generated matrix
(with "Apply to all" bulk price/stock); `OptionEditorSheet.tsx` is the full-screen option editor
(preset names, per-name one-tap values, real color swatches, switchable size systems, search-or-create
value input, duplicate-name guard). The cross-seller size chart is **not** built — see the root
`CLAUDE.md` pre-launch note before touching `cm`/`in` values.
