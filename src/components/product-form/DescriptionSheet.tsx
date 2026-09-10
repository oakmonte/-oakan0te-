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

// Used only as an invisible spot for the caret to land on outside a format
// wrapper it's escaping (or inside a brand-new one) -- stripped back out on
// Save by stripEditorArtifacts, never meant to be real content.
const ZERO_WIDTH_SPACE = "\u200B";
const ZERO_WIDTH_SPACE_RE = /\u200B/g;

// Every format button here is a pure "what happens to the NEXT character
// typed" switch -- never a retroactive edit of text already on the page,
// even when the cursor sits right next to (or "inside") already-formatted
// text. That's what these two helpers exist to guarantee.
//
// Turning a format OFF from a collapsed cursor: execCommand flips its own
// internal "next typed chars" flag correctly, but the caret is still
// physically positioned inside the existing <u>/<i>/<b> element's DOM
// boundary, and browsers keep extending that same element for whatever
// gets typed next regardless of the flag -- this is what read as "the
// button doesn't turn off" / "I can't switch back". A text node inserted
// via Range.insertNode() at that same point would still land AS A CHILD of
// that element (inheriting its style), so the only way to genuinely escape
// is to place a marker as the element's next SIBLING instead -- outside its
// closing tag. The marker is an invisible zero-width space so the caret has
// somewhere to sit; it's stripped back out on Save (stripEditorArtifacts).
function escapeFormatIfCollapsed(tagSelector: string) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || !sel.getRangeAt(0).collapsed) return;
  const anchor = sel.anchorNode;
  const el = anchor instanceof Element ? anchor : anchor?.parentElement;
  const wrapper = el?.closest(tagSelector);
  if (!wrapper || !wrapper.parentNode) return;
  const marker = document.createTextNode(ZERO_WIDTH_SPACE);
  wrapper.parentNode.insertBefore(marker, wrapper.nextSibling);
  const range = document.createRange();
  range.setStart(marker, 1);
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
}

// Starting (or stepping up) a bold run from a collapsed cursor: rather than
// restyling whatever <b>/<strong> element the caret happens to be inside
// (which would retroactively change text already typed at the OLD weight),
// this always creates a brand-new <b> with its own explicit weight and
// inserts it right at the caret. An inline style always wins over an
// inherited one, so even if this ends up nested inside an existing bold
// wrapper, the old text keeps its own weight and only this new node (and
// whatever gets typed into it next) renders at the new one.
function insertBoldRunAtCaret(weight: "600" | "900") {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || !sel.getRangeAt(0).collapsed) return;
  const range = sel.getRangeAt(0);
  const marker = document.createTextNode(ZERO_WIDTH_SPACE);
  const wrap = document.createElement("b");
  wrap.style.fontWeight = weight;
  wrap.appendChild(marker);
  range.insertNode(wrap);
  const newRange = document.createRange();
  newRange.setStart(marker, 1);
  newRange.collapse(true);
  sel.removeAllRanges();
  sel.addRange(newRange);
}

// Strips the zero-width-space caret anchors the two helpers above leave
// behind, and any wrapper that ended up with nothing typed into it (tapped
// a format, then saved without adding text) -- neither is real content.
function stripEditorArtifacts(html: string): string {
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  const walker = document.createTreeWalker(tmp, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    n.textContent = (n.textContent ?? "").replace(ZERO_WIDTH_SPACE_RE, "");
  }
  let removed = true;
  while (removed) {
    removed = false;
    tmp.querySelectorAll("b, strong, i, em, u").forEach((el) => {
      if (!el.textContent) {
        el.remove();
        removed = true;
      }
    });
  }
  return tmp.innerHTML;
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

  // Turning OFF from a collapsed cursor needs the escape hatch (see
  // escapeFormatIfCollapsed above); turning ON never does -- a fresh <u>/<i>
  // wrapper for a collapsed cursor is exactly what execCommand already
  // handles correctly on its own, lazily, the moment a character is typed.
  function toggleUnderline() {
    const turningOff = document.queryCommandState("underline");
    exec("underline");
    if (turningOff) escapeFormatIfCollapsed("u");
  }

  function toggleItalic() {
    const turningOff = document.queryCommandState("italic");
    exec("italic");
    if (turningOff) escapeFormatIfCollapsed("i, em");
  }

  // Restyles font-weight directly on every <b>/<strong> a REAL (non-collapsed)
  // selection touches -- i.e. the seller explicitly selected existing text and
  // tapped Bold to act on it, which is the one case where changing already-
  // typed text on the page is actually the intended behavior. The collapsed-
  // cursor "carry forward to whatever I type next" case never calls this --
  // see insertBoldRunAtCaret above, which creates a new element instead of
  // touching whatever the caret happens to be sitting inside.
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

  // Cycles off -> medium -> heavy -> off, purely off the button's own
  // last-known state (`formats.bold`) -- never re-derived from the DOM mid-
  // cycle, which is what makes tapping the button three times in a row work
  // with no typing in between (there's often no <b> element to inspect yet
  // at all). A real selection restyles that selection directly
  // (setBoldWeightOnSelection); a collapsed cursor always starts a brand-new
  // run instead of mutating whatever it's sitting inside
  // (insertBoldRunAtCaret / escapeFormatIfCollapsed) so nothing already
  // typed ever changes weight.
  function cycleBold() {
    editorRef.current?.focus();
    const next: BoldLevel = formats.bold === 2 ? 0 : ((formats.bold + 1) as BoldLevel);
    const sel = window.getSelection();
    const collapsed = !sel || sel.rangeCount === 0 || sel.getRangeAt(0).collapsed;

    if (next === 0) {
      document.execCommand("bold", false);
      if (collapsed) escapeFormatIfCollapsed("b, strong");
    } else if (!collapsed) {
      if (formats.bold === 0) document.execCommand("bold", false);
      setBoldWeightOnSelection(next === 2 ? "900" : "600");
    } else {
      if (formats.bold === 0) document.execCommand("bold", false);
      insertBoldRunAtCaret(next === 2 ? "900" : "600");
    }
    setFormats((f) => ({ ...f, bold: next }));
  }

  function handleSave() {
    const el = editorRef.current;
    const text = el?.textContent ?? "";
    const found = findBlockedContent(text);
    if (found.length > 0) {
      setPolicyError(blockedContentMessage(found));
      return;
    }
    const html = text.trim() ? stripEditorArtifacts(el?.innerHTML ?? "") : "";
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
