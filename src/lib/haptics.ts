// A light tick for wheel pickers. Best effort and silent on failure: no
// browser exposes real haptics to a web page.
//
//  - Android: navigator.vibrate.
//  - iPhone (iOS 18+): Safari fires a haptic when a native `<input switch>`
//    toggles, so a hidden one gets clicked through its label. Older iOS, and
//    any tick that isn't inside a user gesture, simply does nothing.

let ticker: HTMLLabelElement | null = null;

function ensureTicker(): HTMLLabelElement {
  if (ticker?.isConnected) return ticker;
  const input = document.createElement("input");
  input.type = "checkbox";
  input.setAttribute("switch", "");
  input.tabIndex = -1;
  const label = document.createElement("label");
  label.setAttribute("aria-hidden", "true");
  label.style.cssText =
    "position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none;";
  label.append(input);
  document.body.append(label);
  ticker = label;
  return label;
}

export function hapticTick(): void {
  if (typeof document === "undefined") return;
  try {
    if (typeof navigator.vibrate === "function") navigator.vibrate(4);
    else ensureTicker().click();
  } catch {
    // Haptics are decoration; never let one break the screen.
  }
}
