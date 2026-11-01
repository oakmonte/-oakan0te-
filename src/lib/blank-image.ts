/** A transparent stand-in for a missing photo, so an <img> with no picture
 *  shows its own background (bg-*) instead of calling out to a placeholder
 *  site -- which could be slow, blocked, or gone. */
export const BLANK_IMAGE =
  "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='1'%20height='1'/%3E";
