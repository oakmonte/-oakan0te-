import { useEffect, useRef, useState } from "react";
import {
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  List,
  ListOrdered,
  Link2,
  ChevronDown,
} from "lucide-react";
import { useLockedViewport } from "@/hooks/use-locked-viewport";
import { useVisibleViewport } from "@/hooks/use-visible-viewport";

type FormatState = {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  justifyLeft: boolean;
  justifyCenter: boolean;
  justifyRight: boolean;
  insertUnorderedList: boolean;
  insertOrderedList: boolean;
};

const ALIGN_OPTIONS = [
  { command: "justifyLeft", label: "Align left", Icon: AlignLeft },
  { command: "justifyCenter", label: "Align center", Icon: AlignCenter },
  { command: "justifyRight", label: "Align right", Icon: AlignRight },
] as const;

const LIST_OPTIONS = [
  { command: "insertUnorderedList", label: "Bulleted list", Icon: List },
  { command: "insertOrderedList", label: "Numbered list", Icon: ListOrdered },
] as const;

type ToolbarGroup = "align" | "list" | null;

function readFormats(): FormatState {
  return {
    bold: document.queryCommandState("bold"),
    italic: document.queryCommandState("italic"),
    underline: document.queryCommandState("underline"),
    justifyLeft: document.queryCommandState("justifyLeft"),
    justifyCenter: document.queryCommandState("justifyCenter"),
    justifyRight: document.queryCommandState("justifyRight"),
    insertUnorderedList: document.queryCommandState("insertUnorderedList"),
    insertOrderedList: document.queryCommandState("insertOrderedList"),
  };
}

// Rich-text description as a full-screen sheet, not the old inline-expand
// textarea — matches the seller's mental model of "open, edit, Save/Cancel"
// for anything more involved than a single line.
export function DescriptionSheet({
  value,
  onSave,
  onClose,
}: {
  value: string; // HTML
  onSave: (html: string) => void;
  onClose: () => void;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [formats, setFormats] = useState<FormatState>({
    bold: false,
    italic: false,
    underline: false,
    justifyLeft: true,
    justifyCenter: false,
    justifyRight: false,
    insertUnorderedList: false,
    insertOrderedList: false,
  });
  const [openGroup, setOpenGroup] = useState<ToolbarGroup>(null);

  // Stops iOS from scrolling the document to reveal the focused field (which
  // drags position:fixed elements with it) — necessary but not sufficient on
  // its own; see useVisibleViewport below for what actually keeps the
  // toolbar glued above the keyboard instead of sliding out of view under it.
  useLockedViewport();

  // The toolbar used to be `sticky bottom-0`, which anchors to the LAYOUT
  // viewport — full screen height, since interactive-widget=overlays-content
  // means the keyboard covers content rather than resizing it. That put the
  // toolbar behind the keyboard instead of above it. Sizing this sheet to the
  // keyboard-free band (same fix as the camera's TextPanel) means the
  // non-scrolling toolbar, as the last flex child, lands exactly at its edge.
  const viewport = useVisibleViewport(true);

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    el.innerHTML = value;

    el.focus({ preventScroll: true });
    requestAnimationFrame(() => {
      if (!el.isConnected) return;
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
      setFormats(readFormats());
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handler = () => setFormats(readFormats());
    document.addEventListener("selectionchange", handler);
    return () => document.removeEventListener("selectionchange", handler);
  }, []);

  function exec(command: string, arg?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, arg);
    setFormats(readFormats());
  }

  function applyAndCollapse(command: string) {
    exec(command);
    setOpenGroup(null);
  }

  function handleLink() {
    const url = window.prompt("Link URL");
    if (!url) return;
    exec("createLink", url);
  }

  function handleSave() {
    const el = editorRef.current;
    const html = el && el.textContent?.trim() ? el.innerHTML : "";
    onSave(html);
  }

  const activeAlign = ALIGN_OPTIONS.find((o) => formats[o.command]) ?? ALIGN_OPTIONS[0];

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      <style>{`
        .oak-description-editor:empty:before {
          content: attr(data-placeholder);
          color: #9CA3AF;
        }
        .oak-description-editor ul { list-style: disc; padding-left: 1.25rem; }
        .oak-description-editor ol { list-style: decimal; padding-left: 1.25rem; }
        .oak-description-editor a { color: #2563EB; text-decoration: underline; }
      `}</style>

      {/* Sized to the keyboard-free band, not the full sheet — the outer div
          above is always full-screen white, so if this estimate undershoots
          (Safari's visualViewport doesn't reliably account for its own
          "Prev/Next/Done" accessory bar), what shows below is blank white
          from the outer div, never the form page underneath. */}
      <div className="flex flex-col min-h-0" style={{ height: viewport.height || "100%" }}>
        <div className="shrink-0 bg-white/95 backdrop-blur border-b border-gray-100 px-4 h-14 flex items-center justify-between">
          <button onClick={onClose} type="button" className="text-sm text-gray-500">
            Cancel
          </button>
          <span className="font-semibold text-[15px] absolute left-1/2 -translate-x-1/2">
            Description
          </span>
          <button onClick={handleSave} type="button" className="text-sm font-medium text-black">
            Save
          </button>
        </div>

        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={() => setFormats(readFormats())}
          data-placeholder="Describe your product…"
          className="oak-description-editor flex-1 min-h-0 overflow-y-auto px-4 py-5 text-base text-gray-900 outline-none"
        />

        <div className="shrink-0 bg-white/95 backdrop-blur border-t border-gray-100 px-2 py-1.5 flex items-center gap-0.5 overflow-x-auto">
          <ToolbarButton label="Bold" active={formats.bold} onClick={() => exec("bold")}>
            <Bold size={18} />
          </ToolbarButton>
          <ToolbarButton label="Italic" active={formats.italic} onClick={() => exec("italic")}>
            <Italic size={18} />
          </ToolbarButton>
          <ToolbarButton
            label="Underline"
            active={formats.underline}
            onClick={() => exec("underline")}
          >
            <Underline size={18} />
          </ToolbarButton>

          {openGroup === "align" ? (
            ALIGN_OPTIONS.map(({ command, label, Icon }) => (
              <ToolbarButton
                key={command}
                label={label}
                active={formats[command]}
                onClick={() => applyAndCollapse(command)}
              >
                <Icon size={18} />
              </ToolbarButton>
            ))
          ) : (
            <ToolbarButton
              label="Alignment"
              onClick={() => setOpenGroup((g) => (g === "align" ? null : "align"))}
            >
              <activeAlign.Icon size={18} />
              <ChevronDown size={12} className="text-gray-400" />
            </ToolbarButton>
          )}

          {openGroup === "list" ? (
            LIST_OPTIONS.map(({ command, label, Icon }) => (
              <ToolbarButton
                key={command}
                label={label}
                active={formats[command]}
                onClick={() => applyAndCollapse(command)}
              >
                <Icon size={18} />
              </ToolbarButton>
            ))
          ) : (
            <ToolbarButton
              label="List"
              active={formats.insertUnorderedList || formats.insertOrderedList}
              onClick={() => setOpenGroup((g) => (g === "list" ? null : "list"))}
            >
              <List size={18} />
              <ChevronDown size={12} className="text-gray-400" />
            </ToolbarButton>
          )}

          <ToolbarButton label="Link" onClick={handleLink}>
            <Link2 size={18} />
          </ToolbarButton>
        </div>
      </div>
    </div>
  );
}

function ToolbarButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      // Keeps the editor's selection alive when tapping a toolbar button —
      // without this, focus moves to the button and execCommand has nothing
      // to apply to.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={`shrink-0 h-9 px-2.5 rounded-lg flex items-center gap-0.5 ${
        active ? "bg-gray-900 text-white" : "text-gray-700"
      }`}
    >
      {children}
    </button>
  );
}
