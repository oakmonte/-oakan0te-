import { useEffect, useRef, useState } from "react";
import { useVisibleViewport } from "@/hooks/use-visible-viewport";
import { PageSheet } from "@/components/PageSheet";
import {
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  List,
  ListOrdered,
} from "lucide-react";
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
//
// Bold specifically can be MULTIPLE levels deep here (insertBoldRunAtCaret
// nests a new run inside whatever the caret was already sitting in for the
// medium -> heavy step), so this has to climb out through every nested
// matching ancestor, not just the innermost one -- stopping at the first
// only un-nests one level and leaves the caret still inside the next one
// out, which read as "off" landing back on medium instead of normal.
function escapeFormatIfCollapsed(tagSelector: string) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || !sel.getRangeAt(0).collapsed) return;
  const anchor = sel.anchorNode;
  const el = anchor instanceof Element ? anchor : anchor?.parentElement;
  let wrapper: Element | null = null;
  for (
    let cur = el?.closest(tagSelector) ?? null;
    cur;
    cur = cur.parentElement?.closest(tagSelector) ?? null
  ) {
    wrapper = cur;
  }
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
  const toolbarRef = useRef<HTMLDivElement>(null);
  // The toolbar is the one fixed thing on this page: pinned to the bottom,
  // and lifted to sit on the keyboard while it's up.
  const viewport = useVisibleViewport(true);
  const keyboardUp = viewport.keyboardHeight > 0;
  // Hidden while the page scrolls. iPhones report the keyboard's position a
  // frame or two behind a scroll, so a toolbar shown mid-scroll trails it.
  const [scrolling, setScrolling] = useState(false);
  const [policyError, setPolicyError] = useState<string | null>(null);

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
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onScroll = () => {
      setScrolling(true);
      clearTimeout(timer);
      timer = setTimeout(() => setScrolling(false), 180);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.visualViewport?.addEventListener("scroll", onScroll);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("scroll", onScroll);
      window.visualViewport?.removeEventListener("scroll", onScroll);
    };
  }, []);

  // Typing at the bottom: the browser scrolls the caret just into view,
  // which is behind the toolbar. Nudge it the rest of the way.
  function keepCaretAboveToolbar() {
    const sel = window.getSelection();
    const bar = toolbarRef.current;
    if (!sel || sel.rangeCount === 0 || !bar) return;
    const range = sel.getRangeAt(0);
    const node = range.startContainer;
    const rect =
      range.getClientRects()[0] ??
      (node instanceof Element ? node : node.parentElement)?.getBoundingClientRect();
    if (!rect) return;
    const overlap = rect.bottom + 12 - bar.getBoundingClientRect().top;
    if (overlap > 0) window.scrollBy({ top: overlap, behavior: "instant" });
  }

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

  return (
    <PageSheet
      onClose={onClose}
      className="bg-white flex flex-col animate-in fade-in slide-in-from-bottom-6 duration-[var(--duration-slow)] ease-[var(--ease-smooth-out)]"
    >
      <style>{`
        .oak-description-editor:empty:before {
          content: attr(data-placeholder);
          color: #9CA3AF;
        }
        .oak-description-editor ul { list-style: disc; padding-left: 1.25rem; }
        .oak-description-editor ol { list-style: decimal; padding-left: 1.25rem; }
        .oak-description-editor a { color: #2563EB; text-decoration: underline; }
      `}</style>

      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-gray-100 px-4 h-14 flex items-center justify-between">
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
          keepCaretAboveToolbar();
        }}
        data-placeholder={placeholder}
        className="oak-description-editor flex-1 min-h-[60dvh] px-4 py-5 text-base text-gray-900 outline-none"
      />
      {/* Room to scroll the last lines up past the toolbar and keyboard. */}
      <div aria-hidden className="shrink-0" style={{ height: viewport.keyboardHeight + 72 }} />

      {/* One fixed row -- every button always there, nothing expands or
          slides, so a tap never moves the button next to it. */}
      <div
        ref={toolbarRef}
        className={`fixed inset-x-0 bottom-0 z-30 border-t border-gray-100 bg-white/95 backdrop-blur px-2 pt-1.5 transition-opacity duration-150 ${
          scrolling ? "opacity-0 pointer-events-none" : "opacity-100"
        }`}
        style={{
          transform: keyboardUp ? `translateY(-${viewport.keyboardHeight}px)` : undefined,
          paddingBottom: keyboardUp ? "0.375rem" : "calc(env(safe-area-inset-bottom) + 0.375rem)",
        }}
      >
        <div className="mx-auto flex max-w-[560px] items-center justify-between">
          <ToolbarButton label="Bold" level={formats.bold} onClick={cycleBold}>
            <Bold size={18} />
          </ToolbarButton>
          <ToolbarButton label="Italic" active={formats.italic} onClick={toggleItalic}>
            <Italic size={18} />
          </ToolbarButton>
          <ToolbarButton label="Underline" active={formats.underline} onClick={toggleUnderline}>
            <Underline size={18} />
          </ToolbarButton>
          <span aria-hidden className="h-5 w-px bg-gray-200" />
          {ALIGN_OPTIONS.map(({ command, label, Icon }) => (
            <ToolbarButton
              key={command}
              label={label}
              active={formats[command]}
              onClick={() => exec(command)}
            >
              <Icon size={18} />
            </ToolbarButton>
          ))}
          <span aria-hidden className="h-5 w-px bg-gray-200" />
          {LIST_OPTIONS.map(({ command, label, Icon }) => (
            <ToolbarButton
              key={command}
              label={label}
              active={formats[command]}
              onClick={() => exec(command)}
            >
              <Icon size={18} />
            </ToolbarButton>
          ))}
        </div>
      </div>
    </PageSheet>
  );
}

function ToolbarButton({
  label,
  active,
  level,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  // Bold-only: a third visual state on top of plain on/off. Takes priority
  // over `active` when passed. 0 looks like inactive, 1 is the new outlined
  // "medium" look, 2 reuses the existing filled-black "active" look.
  level?: BoldLevel;
  onClick: () => void;
  children: React.ReactNode;
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
      // pointerdown too: on a phone the tap otherwise takes focus off the
      // text, and the keyboard drops between taps.
      onPointerDown={(e) => e.preventDefault()}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      aria-label={label}
      aria-pressed={level !== undefined ? level > 0 : active}
      // `border` is always present (border-box sizing, so it doesn't shift
      // any button's rendered size) — only its color changes, so level 1's
      // outline doesn't nudge anything relative to its siblings.
      // before:-inset-1.5 grows the actual tappable box ~6px past what's
      // visible on every side (content-less, no background -- invisible)
      // without changing the toolbar's compact look. Not pushed further:
      // these buttons sit gap-0.5 (2px) apart, so a much bigger expansion
      // would have neighboring buttons' hit zones overlap deep into each
      // other rather than just closing the dead space between them.
      className={`relative shrink-0 h-9 min-w-9 px-2 justify-center rounded-lg border flex items-center gap-0.5 transition-colors duration-150 before:content-[''] before:absolute before:-inset-1.5 ${stateClass}`}
    >
      {children}
    </button>
  );
}
