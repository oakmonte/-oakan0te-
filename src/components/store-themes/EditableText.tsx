import {
  useEffect,
  useState,
  type CSSProperties,
  type ElementType,
  type KeyboardEvent,
} from "react";
import { Minus } from "lucide-react";
import { FONT_OPTIONS, type FontId } from "./fonts";
import type { TextFieldId, ThemeEditingProps } from "./edit-types";

// Shared view/edit toggle for every piece of copy in the preview. In view
// mode it's pixel-identical to a plain static element — same tag, same
// classes, same style — and renders nothing at all once emptied (an empty
// string IS the "removed" state, no separate flag needed). In edit mode it's
// always an input/textarea (visual parity comes from forwarding the same
// className/style, not from trying to keep the semantic tag), with a dashed
// underline as the edit hint. Commits on blur, not on every keystroke.
//
// Focusing the field reveals a small font-picker row above it (Sans/Serif/
// Display, all already-loaded families — see fonts.ts) so every text box can
// carry its own font, never forced to match the rest of the storefront. A
// small remove button sits at the field's own top-right corner whenever it
// currently holds text, letting a seller delete just that line and fall back
// to the editorial default rather than removing a whole block.
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
  // iOS Safari auto-zooms the page on focus for any input under 16px. Forcing
  // 16px here (inputs only — view mode is untouched) satisfies that threshold
  // without touching the viewport meta tag, so a user's own pinch-zoom still
  // works exactly as normal.
  const editStyle = { ...style, fontSize: "max(16px, 1em)" };

  function commit() {
    if (local !== value) onChange(local);
  }

  function handleBlur() {
    commit();
    setFocused(false);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") e.currentTarget.blur();
  }

  return (
    <span className="relative block w-full">
      {focused && onFontChange && (
        <div className="absolute -top-9 left-0 z-20 flex max-w-[240px] flex-wrap gap-0.5 rounded-xl bg-neutral-900 p-1 shadow-lg">
          {FONT_OPTIONS.map((f) => {
            const active = currentFont ? currentFont === f.id : f.id === "sans";
            return (
              <button
                key={f.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onFontChange(f.id)}
                className="rounded-full px-1.5 py-0.5 text-[9px] font-medium whitespace-nowrap text-white"
                style={{
                  fontFamily: f.fontFamily,
                  background: active ? "rgba(255,255,255,0.2)" : "transparent",
                  opacity: active ? 1 : 0.55,
                }}
              >
                {f.label}
              </button>
            );
          })}
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
      {multiline ? (
        <textarea
          rows={2}
          value={local}
          placeholder={placeholder}
          onChange={(e) => setLocal(e.target.value)}
          onFocus={() => setFocused(true)}
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
          onFocus={() => setFocused(true)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className={editClassName}
          style={editStyle}
        />
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
