// Hand-rolled sanitizer for the product/collection description editor
// (DescriptionSheet.tsx). No third-party dependency — DOMPurify would need a
// bunfig.toml minimumReleaseAge exclusion, which CLAUDE.md says to ask about
// first; this is ~40 lines instead. See POSTPONED.md 2.5 for the background:
// nothing renders a saved description back as HTML today, so this isn't
// closing a live exploit, it's making sure the day something does, the
// stored HTML is already safe.
//
// Allow-lists rather than blocklists: a tag or attribute this forgot to list
// is dropped by default, not let through by default. Only tags the editor's
// own toolbar (bold/italic/underline/align/lists/links) can actually produce
// are kept.

const ALLOWED_TAGS = new Set([
  "B",
  "STRONG",
  "I",
  "EM",
  "U",
  "P",
  "DIV",
  "BR",
  "UL",
  "OL",
  "LI",
  "A",
  "SPAN",
]);

// Tags dropped along with their entire contents, not just unwrapped — these
// have no safe rendering as inert text (a <style> block's text content is
// still CSS the moment it's reinserted into a real document, etc).
const DROP_ENTIRELY = new Set([
  "SCRIPT",
  "STYLE",
  "IFRAME",
  "OBJECT",
  "EMBED",
  "SVG",
  "MATH",
  "TEMPLATE",
  "LINK",
  "META",
  "BASE",
  "FORM",
  "INPUT",
  "BUTTON",
  "TEXTAREA",
  "SELECT",
  "NOSCRIPT",
]);

// execCommand's justifyLeft/Center/Right write this exact inline style —
// the only `style` value the editor's own toolbar can produce.
const ALIGN_STYLE = /^text-align:\s*(left|center|right)\s*;?$/i;

// The Bold button's two levels (see DescriptionSheet's cycleBold) write this
// exact inline style on a <b>/<strong> it creates -- 600 for the outlined
// "medium" level, 900 for the filled-black "heavy" level. Exact values only,
// same allow-list-not-blocklist reasoning as ALIGN_STYLE: this is not "allow
// the style attribute," it's "allow these two specific values and nothing
// else written to it."
const FONT_WEIGHT_STYLE = /^font-weight:\s*(600|900)\s*;?$/i;

function isSafeHref(href: string): boolean {
  try {
    // Base URL only supplies a scheme for a relative href to inherit when
    // checking protocol below; it never appears in the sanitized output.
    const url = new URL(href, "https://oakmonte.invalid");
    return url.protocol === "https:" || url.protocol === "http:" || url.protocol === "mailto:";
  } catch {
    return false;
  }
}

function sanitizeAttributes(el: Element) {
  for (const attr of [...el.attributes]) {
    if (el.tagName === "A" && attr.name === "href" && isSafeHref(attr.value)) continue;
    if (
      attr.name === "style" &&
      (ALIGN_STYLE.test(attr.value) || FONT_WEIGHT_STYLE.test(attr.value))
    )
      continue;
    el.removeAttribute(attr.name);
  }
}

function sanitizeChildren(el: Element) {
  for (const child of [...el.childNodes]) {
    if (child.nodeType === Node.COMMENT_NODE) {
      el.removeChild(child);
      continue;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) continue;

    const childEl = child as Element;
    if (DROP_ENTIRELY.has(childEl.tagName)) {
      el.removeChild(childEl);
      continue;
    }
    if (!ALLOWED_TAGS.has(childEl.tagName)) {
      // Unwrap, don't drop: keep whatever real content a pasted wrapper tag
      // (e.g. <font>, <table>) held, lose only the tag itself.
      while (childEl.firstChild) el.insertBefore(childEl.firstChild, childEl);
      el.removeChild(childEl);
      continue;
    }
    sanitizeAttributes(childEl);
    sanitizeChildren(childEl);
  }
}

export function sanitizeDescriptionHtml(html: string): string {
  if (!html.trim()) return "";
  const doc = new DOMParser().parseFromString(html, "text/html");
  sanitizeChildren(doc.body);
  return doc.body.innerHTML;
}
