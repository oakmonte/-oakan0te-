import {
  useEffect,
  useState,
  type CSSProperties,
  type ElementType,
  type KeyboardEvent,
} from "react";
import { Minus } from "lucide-react";
import { FONT_OPTIONS, ensureThemeFont, ensureThemePickerFonts, type FontId } from "./fonts";
import type { TextFieldId, ThemeEditingProps } from "./edit-types";

// iOS Safari force-zooms on focus below this computed font size; styles.css
// holds every input in the app at it. See the long note in EditableText.
const ZOOM_FLOOR_PX = 16;
// Pinned so the counter-scaled wrapper's height is arithmetic, not a
// measurement — these mirror the field's own py-1 / 1px border in
// editClassName. Change one and change the other.
const FIELD_LINE_HEIGHT = 1.3;
const FIELD_PAD_Y = 4;
const FIELD_BORDER = 1;

// Shared view/edit toggle for every piece of copy in the preview. In view
// mode it's pixel-identical to a plain static element — same tag, same
// classes, same style — and renders nothing at all once emptied (an empty
// string IS the "removed" state, no separate flag needed). In edit mode it's
// always an input/textarea (visual parity comes from forwarding the same
// className/style, not from trying to keep the semantic tag), with a dashed
// underline as the edit hint. Commits on blur, not on every keystroke.
//
// Focusing the field reveals a font control docked to the right edge of the
// screen (fixed, not relative to the field, so it reads the same regardless
// of where on the page the field sits). It starts collapsed to a single
// "Change font" pill — tap it to expand into a scrollable list of every
// option, with the field's current font highlighted in place; picking one
// collapses it back to the pill. Both the pill and the list disappear
// entirely once the field blurs. Every text box can carry its own font,
// never forced to match the rest of the storefront.
// A small remove button sits at the field's own top-right corner whenever
// it currently holds text, letting a seller delete just that line and fall
// back to the editorial default rather than removing a whole block.
export function EditableText({
  value,
  onChange,
  isEditing,
  as = "span",
  className,
  style,
  multiline = false,
  placeholder,
  currentFont,
  onFontChange,
  onRemove,
}: {
  value: string;
  onChange: (next: string) => void;
  isEditing: boolean;
  as?: ElementType;
  className?: string;
  style?: CSSProperties;
  multiline?: boolean;
  placeholder?: string;
  currentFont?: FontId;
  onFontChange?: (font: FontId) => void;
  onRemove?: () => void;
}) {
  const [local, setLocal] = useState(value);
  const [focused, setFocused] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    setLocal(value);
  }, [value]);

  // How much of the layout viewport the on-screen keyboard is covering, so
  // the font control can sit just above it. visualViewport is the only thing
  // that reports this: window.innerHeight does not change when the keyboard
  // opens, and position:fixed still resolves against the layout viewport.
  const [keyboardInset, setKeyboardInset] = useState(0);
  useEffect(() => {
    if (!focused) return;
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () =>
      setKeyboardInset(Math.max(0, window.innerHeight - vv.height - vv.offsetTop));
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, [focused]);

  if (!isEditing) {
    if (!value) return null;
    const Tag = as;
    return (
      <Tag className={className} style={style}>
        {value}
      </Tag>
    );
  }

  const editClassName = `${className ?? ""} w-full resize-none rounded-md border border-white/25 bg-white/5 px-2 py-1 outline-none focus:border-white/60 focus:bg-white/10`;

  // iOS Safari force-zooms the viewport when it focuses a text control whose
  // COMPUTED font size is under 16px, and styles.css keeps every input at
  // that floor app-wide precisely so nobody has to disable pinch-zoom.
  //
  // Theme copy goes down to 11px, so this field is caught between the two:
  // let the 16px floor win and the text outgrows the tight max-w/flex box it
  // was designed for (a single-line input cannot wrap, so the overflow reads
  // as chopped-off text); override it down to the design size and the forced
  // zoom comes back. Swapping the viewport meta on focus — what this used to
  // do — does not settle it either: iOS ignores user-scalable=no, and it
  // takes pinch-zoom away from the seller while they type.
  //
  // So: keep the real font-size at 16px, which is the property iOS actually
  // measures, and counter-scale the field with a CSS transform, which it does
  // not. The field computes as 16px and renders at its design size. The
  // transform is laid out inside a wrapper of the exact visual height and
  // taken out of flow, since a transform does not shrink the layout box it
  // came from and a 145%-wide box left in flow would push the page sideways.
  const sizeMatch = className?.match(/text-\[(\d+(?:\.\d+)?)px\]/);
  const intendedPx = sizeMatch ? parseFloat(sizeMatch[1]) : null;
  // At or above the threshold there is nothing to defeat, and with no size
  // class at all the styles.css floor already applies.
  const scale = intendedPx !== null && intendedPx < ZOOM_FLOOR_PX ? intendedPx / ZOOM_FLOOR_PX : 1;
  // Every term is pinned rather than measured, so the wrapper's height is
  // known on the first paint and nothing reflows once the field mounts.
  const rows = multiline ? 2 : 1;
  const fieldHeight = ZOOM_FLOOR_PX * FIELD_LINE_HEIGHT * rows + 2 * FIELD_PAD_Y + 2 * FIELD_BORDER;
  const editStyle: CSSProperties = {
    ...style,
    fontSize: `${ZOOM_FLOOR_PX}px`,
    lineHeight: FIELD_LINE_HEIGHT,
    height: fieldHeight,
  };

  function commit() {
    if (local !== value) onChange(local);
  }

  function handleFocus() {
    setFocused(true);
    setPickerOpen(false);
  }

  function handleBlur() {
    commit();
    setFocused(false);
    setPickerOpen(false);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") e.currentTarget.blur();
  }

  const visualHeight = fieldHeight * scale;
  const field = multiline ? (
    <textarea
      rows={2}
      value={local}
      placeholder={placeholder}
      onChange={(e) => setLocal(e.target.value)}
      onFocus={handleFocus}
      onBlur={handleBlur}
      className={editClassName}
      style={editStyle}
    />
  ) : (
    <input
      type="text"
      value={local}
      placeholder={placeholder}
      onChange={(e) => setLocal(e.target.value)}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className={editClassName}
      style={editStyle}
    />
  );

  return (
    <span className="relative block w-full">
      {focused && onFontChange && (
        // Docked just above the keyboard rather than centred on the screen:
        // the field being edited is pushed up against the keyboard too, so a
        // control halfway up the page meant looking in one place and reaching
        // in another. Bottom-anchored also lets the list grow upward, away
        // from the thumb. keyboardInset comes from visualViewport above.
        <div
          className="fixed right-3 z-30 flex justify-end duration-200 ease-out animate-in fade-in slide-in-from-bottom-2"
          style={{ bottom: keyboardInset + 12 }}
        >
          {pickerOpen ? (
            <div
              className="max-h-[260px] w-fit overflow-y-auto overscroll-contain rounded-2xl bg-neutral-900 p-1.5 shadow-xl duration-200 ease-out animate-in fade-in zoom-in-95 slide-in-from-bottom-4"
              style={{ minWidth: "10.5rem" }}
            >
              {FONT_OPTIONS.map((f) => {
                const active = currentFont ? currentFont === f.id : f.id === "sans";
                return (
                  <button
                    key={f.id}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      onFontChange(f.id);
                      setPickerOpen(false);
                    }}
                    className="block w-full rounded-lg px-3 py-2 text-left text-[13px] font-medium whitespace-nowrap text-white"
                    style={{
                      fontFamily: f.fontFamily,
                      background: active ? "rgba(255,255,255,0.2)" : "transparent",
                      opacity: active ? 1 : 0.65,
                    }}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>
          ) : (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                ensureThemePickerFonts();
                setPickerOpen(true);
              }}
              className="rounded-full bg-neutral-900 px-3 py-2 text-[13px] font-medium whitespace-nowrap text-white shadow-xl"
            >
              Change font
            </button>
          )}
        </div>
      )}
      {onRemove && value && (
        <button
          type="button"
          aria-label="Remove this text"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onRemove}
          className="absolute -right-1.5 -top-1.5 z-20 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-black/70 text-white/70 hover:text-white"
        >
          <Minus size={8} />
        </button>
      )}
      {scale === 1 ? (
        field
      ) : (
        <span
          style={{ position: "relative", display: "block", width: "100%", height: visualHeight }}
        >
          <span
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: `${100 / scale}%`,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
            }}
          >
            {field}
          </span>
        </span>
      )}
    </span>
  );
}

// Convenience wrapper for every theme-copy field: resolves the current value/
// font against the shared `editing` state and wires the change/font/remove
// handlers, so call sites don't repeat that plumbing for every one of the
// ~10 editable fields across all five themes.
export function ThemeText({
  editing,
  field,
  defaultValue = "",
  placeholder,
  as,
  className,
  style,
  multiline,
}: {
  editing?: ThemeEditingProps;
  field: TextFieldId;
  defaultValue?: string;
  placeholder?: string;
  as?: ElementType;
  className?: string;
  style?: CSSProperties;
  multiline?: boolean;
}) {
  const value = editing?.text[field] ?? defaultValue;
  const fontId = editing?.textFonts[field];

  // Theme fonts are loaded on demand (fonts.ts): the moment a field renders
  // in a non-core face, fetch that one family. No-op for sans/serif/display.
  useEffect(() => {
    ensureThemeFont(fontId);
  }, [fontId]);

  const fontFamily = fontId ? FONT_OPTIONS.find((f) => f.id === fontId)?.fontFamily : undefined;
  const mergedStyle = fontFamily ? { ...style, fontFamily } : style;

  if (!editing) {
    if (!value) return null;
    const Tag = as ?? "span";
    return (
      <Tag className={className} style={mergedStyle}>
        {value}
      </Tag>
    );
  }

  return (
    <EditableText
      as={as}
      isEditing={editing.isEditing}
      value={value}
      onChange={(v) => editing.onTextChange(field, v)}
      placeholder={placeholder ?? defaultValue}
      className={className}
      style={mergedStyle}
      multiline={multiline}
      currentFont={fontId}
      onFontChange={(f) => editing.onTextFontChange(field, f)}
      onRemove={value ? () => editing.onTextChange(field, "") : undefined}
    />
  );
}
