import {
  useEffect,
  useState,
  type CSSProperties,
  type ElementType,
  type KeyboardEvent,
} from "react";

// Shared view/edit toggle for every piece of copy in the preview. In view
// mode it's pixel-identical to a plain static element — same tag, same
// classes, same style. In edit mode it's always an input/textarea (visual
// parity comes from forwarding the same className/style, not from trying to
// keep the semantic tag), with a dashed underline as the only edit hint.
// Commits on blur, not on every keystroke.
export function EditableText({
  value,
  onChange,
  isEditing,
  as = "span",
  className,
  style,
  multiline = false,
  placeholder,
}: {
  value: string;
  onChange: (next: string) => void;
  isEditing: boolean;
  as?: ElementType;
  className?: string;
  style?: CSSProperties;
  multiline?: boolean;
  placeholder?: string;
}) {
  const [local, setLocal] = useState(value);

  useEffect(() => {
    setLocal(value);
  }, [value]);

  if (!isEditing) {
    const Tag = as;
    return (
      <Tag className={className} style={style}>
        {value}
      </Tag>
    );
  }

  const editClassName = `${className ?? ""} w-full resize-none border-b border-dashed border-white/30 bg-transparent outline-none focus:border-white/70`;

  function commit() {
    if (local !== value) onChange(local);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") e.currentTarget.blur();
  }

  if (multiline) {
    return (
      <textarea
        rows={2}
        value={local}
        placeholder={placeholder}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={commit}
        className={editClassName}
        style={style}
      />
    );
  }

  return (
    <input
      type="text"
      value={local}
      placeholder={placeholder}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={commit}
      onKeyDown={handleKeyDown}
      className={editClassName}
      style={style}
    />
  );
}
