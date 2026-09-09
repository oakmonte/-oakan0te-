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
  ChevronDown,
} from "lucide-react";
import { useLockedViewport } from "@/hooks/use-locked-viewport";
import { useVisibleViewport } from "@/hooks/use-visible-viewport";
import { sanitizeDescriptionHtml } from "@/lib/sanitize-html";
import { findBlockedContent, blockedContentMessage } from "@/lib/content-policy";

// 0 = off, 1 = medium (outlined button, font-weight 600), 2 = heavy (filled
// black button, font-weight 800) -- see cycleBold. Native execCommand("bold")
// is only ever on/off, so this isn't tracked through queryCommandState alone.
type BoldLevel = 0 | 1 | 2;

type FormatState = {
  bold: BoldLevel;
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

// Which of the two levels applies at the current selection/cursor, if any.
// queryCommandState only knows "is there a <b>/<strong> ancestor at all" --
// which level that ancestor is at comes from its own inline font-weight,
// written by cycleBold below (600 = medium/level 1, anything else once a
// bold ancestor exists, including the browser's own UA-stylesheet default
// bold weight, reads as level 1 too -- only an explicit 900 is level 2).
function currentBoldLevel(): BoldLevel {
  if (!document.queryCommandState("bold")) return 0;
  const anchor = window.getSelection()?.anchorNode;
  const el = anchor instanceof Element ? anchor : anchor?.parentElement;
  const boldEl = el?.closest("b, strong");
  return boldEl && window.getComputedStyle(boldEl).fontWeight === "900" ? 2 : 1;
}

// A collapsed cursor (no selection, just typing position) toggling a format
// off via execCommand only changes whether FUTURE typed characters get the
// format -- it leaves text already typed (and already wrapped) completely
// untouched, even with the cursor sitting right after or inside it. That
// read as "the button doesn't turn off" for underline, since the ordinary
// flow is type a word, leave the cursor right after it, tap the button
// again. Expanding to the whole enclosing element first gives execCommand
// a real selection to actually strip the format from.
function selectEnclosingIfCollapsed(tagSelector: string) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || !sel.getRangeAt(0).collapsed) return;
  const anchor = sel.anchorNode;
  const el = anchor instanceof Element ? anchor : anchor?.parentElement;
  const wrapper = el?.closest(tagSelector);
  if (!wrapper) return;
  const range = document.createRange();
  range.selectNodeContents(wrapper);
  sel.removeAllRanges();
  sel.addRange(range);
}

function readFormats(): FormatState {
  return {
    bold: currentBoldLevel(),
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
  placeholder = "Describe your product and try to answer questions you know your customers will ask.",
  onSave,
  onClose,
}: {
  value: string; // HTML
  // Collections reuse this same sheet -- "product" only makes sense as the
  // default when nothing more specific is passed in.
  placeholder?: string;
  onSave: (html: string) => void;
  onClose: () => void;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [formats, setFormats] = useState<FormatState>({
    bold: 0,
    italic: false,
    underline: false,
    justifyLeft: true,
    justifyCenter: false,
    justifyRight: false,
    insertUnorderedList: false,
    insertOrderedList: false,
  });
  const [openGroup, setOpenGroup] = useState<ToolbarGroup>(null);
  const [policyError, setPolicyError] = useState<string | null>(null);

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
    // Sanitized on the way in too, not just on save — a draft stashed before
    // this fix (or restored via product-draft-handoff) could still carry
    // unsanitized HTML.
    el.innerHTML = sanitizeDescriptionHtml(value);

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

  function toggleUnderline() {
    if (document.queryCommandState("underline")) selectEnclosingIfCollapsed("u");
    exec("underline");
  }

  function toggleItalic() {
    if (document.queryCommandState("italic")) selectEnclosingIfCollapsed("i, em");
    exec("italic");
  }

  // Sets font-weight directly on every <b>/<strong> the current selection
  // touches. Only ever called right after execCommand("bold") guaranteed a
  // wrapper exists for a real (non-collapsed) selection -- execCommand
  // reliably creates/removes that wrapper synchronously in that case, which
  // is what makes walking for it here safe. A collapsed cursor (typing fresh
  // text with nothing selected yet) is a known gap: execCommand("bold") only
  // sets the browser's internal "next typed characters are bold" state
  // without inserting an element yet in most browsers, so there is nothing
  // here to set a weight on until text actually exists to select and re-tap.
  function setBoldWeightOnSelection(weight: string) {
    const sel = window.getSelection();
    const root = editorRef.current;
    if (!sel || sel.rangeCount === 0 || !root) return;
    const range = sel.getRangeAt(0);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, {
      acceptNode: (node) =>
        (node.nodeName === "B" || node.nodeName === "STRONG") && range.intersectsNode(node)
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_SKIP,
    });
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      (node as HTMLElement).style.fontWeight = weight;
    }
  }

  // Cycles off -> medium -> heavy -> off, rather than execCommand("bold")'s
  // native plain toggle. 0 -> 1 and 2 -> 0 both go through execCommand
  // itself, since creating/removing the <b>/<strong> wrapper across an
  // arbitrary (possibly multi-node) selection is exactly the Range-splitting
  // work the browser's own editing engine already handles correctly; 1 -> 2
  // only needs to re-stamp the weight on whatever wrapper already exists.
  function cycleBold() {
    editorRef.current?.focus();
    const level = currentBoldLevel();
    if (level === 0) {
      document.execCommand("bold", false);
      setBoldWeightOnSelection("600");
    } else if (level === 1) {
      setBoldWeightOnSelection("900");
    } else {
      // Same collapsed-cursor gap as underline/italic -- without this, a
      // bare cursor sitting right after already-typed heavy-bold text can't
      // turn it back off, only stop new characters from being bold.
      selectEnclosingIfCollapsed("b, strong");
      document.execCommand("bold", false);
    }
    setFormats(readFormats());
  }

  function handleSave() {
    const el = editorRef.current;
    const text = el?.textContent ?? "";
    const found = findBlockedContent(text);
    if (found.length > 0) {
      setPolicyError(blockedContentMessage(found));
      return;
    }
    const html = text.trim() ? (el?.innerHTML ?? "") : "";
    onSave(sanitizeDescriptionHtml(html));
  }

  const activeAlign = ALIGN_OPTIONS.find((o) => formats[o.command]) ?? ALIGN_OPTIONS[0];

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col animate-in fade-in slide-in-from-bottom-6 duration-300 ease-out">
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

        {policyError && (
          <p className="shrink-0 px-4 py-2 text-xs text-red-500 bg-red-50 border-b border-red-100">
            {policyError}
          </p>
        )}

        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={() => {
            setFormats(readFormats());
            setPolicyError(null);
          }}
          data-placeholder={placeholder}
          className="oak-description-editor flex-1 min-h-0 overflow-y-auto px-4 py-5 text-base text-gray-900 outline-none"
        />

        <div className="shrink-0 bg-white/95 backdrop-blur border-t border-gray-100 px-2 pt-1.5 pb-[30px] flex items-center gap-0.5 overflow-x-auto">
          <ToolbarButton label="Bold" level={formats.bold} onClick={cycleBold}>
            <Bold size={18} />
          </ToolbarButton>
          <ToolbarButton label="Italic" active={formats.italic} onClick={toggleItalic}>
            <Italic size={18} />
          </ToolbarButton>
          <ToolbarButton label="Underline" active={formats.underline} onClick={toggleUnderline}>
            <Underline size={18} />
          </ToolbarButton>

          {openGroup === "align" ? (
            ALIGN_OPTIONS.map(({ command, label, Icon }, i) => (
              <ToolbarButton
                key={command}
                label={label}
                active={formats[command]}
                onClick={() => applyAndCollapse(command)}
                style={{ animationDelay: `${i * 30}ms` }}
                className="animate-in fade-in slide-in-from-left-2 duration-200 ease-out fill-mode-both"
              >
                <Icon size={18} />
              </ToolbarButton>
            ))
          ) : (
            <ToolbarButton
              label="Alignment"
              onClick={() => setOpenGroup((g) => (g === "align" ? null : "align"))}
              className="animate-in fade-in duration-200 ease-out"
            >
              <activeAlign.Icon size={18} />
              <ChevronDown size={12} className="text-gray-400" />
            </ToolbarButton>
          )}

          {openGroup === "list" ? (
            LIST_OPTIONS.map(({ command, label, Icon }, i) => (
              <ToolbarButton
                key={command}
                label={label}
                active={formats[command]}
                onClick={() => applyAndCollapse(command)}
                style={{ animationDelay: `${i * 30}ms` }}
                className="animate-in fade-in slide-in-from-left-2 duration-200 ease-out fill-mode-both"
              >
                <Icon size={18} />
              </ToolbarButton>
            ))
          ) : (
            <ToolbarButton
              label="List"
              active={formats.insertUnorderedList || formats.insertOrderedList}
              onClick={() => setOpenGroup((g) => (g === "list" ? null : "list"))}
              className="animate-in fade-in duration-200 ease-out"
            >
              <List size={18} />
              <ChevronDown size={12} className="text-gray-400" />
            </ToolbarButton>
          )}
        </div>
      </div>
    </div>
  );
}

function ToolbarButton({
  label,
  active,
  level,
  onClick,
  children,
  className = "",
  style,
}: {
  label: string;
  active?: boolean;
  // Bold-only: a third visual state on top of plain on/off. Takes priority
  // over `active` when passed. 0 looks like inactive, 1 is the new outlined
  // "medium" look, 2 reuses the existing filled-black "active" look.
  level?: BoldLevel;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  const stateClass =
    level === 2
      ? "bg-gray-900 text-white border-transparent"
      : level === 1
        ? "bg-white text-gray-900 border-gray-900"
        : level === 0
          ? "text-gray-700 border-transparent"
          : active
            ? "bg-gray-900 text-white border-transparent"
            : "text-gray-700 border-transparent";
  return (
    <button
      type="button"
      // Keeps the editor's selection alive when tapping a toolbar button —
      // without this, focus moves to the button and execCommand has nothing
      // to apply to.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      aria-label={label}
      aria-pressed={level !== undefined ? level > 0 : active}
      style={style}
      // `border` is always present (border-box sizing, so it doesn't shift
      // any button's rendered size) — only its color changes, so level 1's
      // outline doesn't nudge anything relative to its siblings.
      // before:-inset-1.5 grows the actual tappable box ~6px past what's
      // visible on every side (content-less, no background -- invisible)
      // without changing the toolbar's compact look. Not pushed further:
      // these buttons sit gap-0.5 (2px) apart, so a much bigger expansion
      // would have neighboring buttons' hit zones overlap deep into each
      // other rather than just closing the dead space between them.
      className={`relative shrink-0 h-9 px-2.5 rounded-lg border flex items-center gap-0.5 transition-colors duration-150 before:content-[''] before:absolute before:-inset-1.5 ${stateClass} ${className}`}
    >
      {children}
    </button>
  );
}
