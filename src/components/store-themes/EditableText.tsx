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
  // iOS Safari auto-zooms the page on focus for any input under 16px. Every
  // theme sets its copy size via a Tailwind arbitrary class (text-[Npx]), so
  // pull that intended size back out of className to know what we're
  // overriding. Below 16px we force the real font-size to 16px (satisfying
  // iOS's check, which looks at the computed property, not the rendered
  // size) and counter-scale with a CSS transform so the field still *looks*
  // its original size instead of blowing up and overflowing its container —
  // without touching the viewport meta tag, so a user's own pinch-zoom still
  // works exactly as normal.
  const sizeMatch = className?.match(/text-\[(\d+(?:\.\d+)?)px\]/);
  const intendedPx = sizeMatch ? parseFloat(sizeMatch[1]) : null;
  const needsZoomFix = intendedPx !== null && intendedPx < 16;
  const scale = needsZoomFix ? intendedPx / 16 : 1;
  const editStyle = { ...style, fontSize: needsZoomFix ? "16px" : style?.fontSize };
  const scaleWrapperStyle: CSSProperties | undefined = needsZoomFix
    ? {
        display: "block",
        width: `${100 / scale}%`,
        transform: `scale(${scale})`,
        transformOrigin: "top center",
      }
    : undefined;

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

  return (
    <span className="relative block w-full">
      {focused && onFontChange && (
        <div className="fixed right-3 top-1/2 z-30 -translate-y-1/2">
          {pickerOpen ? (
            <div
              className="max-h-[65vh] w-fit overflow-y-auto rounded-2xl bg-neutral-900 p-1.5 shadow-xl"
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
      <div style={scaleWrapperStyle}>
        {multiline ? (
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
        )}
      </div>
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
