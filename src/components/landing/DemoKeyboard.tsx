/** An iPhone keyboard for the landing's messaging demo. `open` slides it up
 *  from the bottom of the screen; `pressed` is the character just typed, and
 *  its key pops the way iOS shows a tap. Styled by the kb-* rules in
 *  routes/index.tsx. */
const ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];

export function DemoKeyboard({ open, pressed }: { open: boolean; pressed: string | null }) {
  const key = pressed?.toLowerCase() ?? null;
  const hit = (k: string) => (key === k ? " is-hit" : "");
  return (
    <div className={`kb${open ? " is-open" : ""}`} aria-hidden="true">
      <div className="kb-inner">
        <div className="kb-row">
          {[...ROWS[0]].map((k) => (
            <span key={k} className={`kb-key${hit(k)}`}>
              {k}
            </span>
          ))}
        </div>
        <div className="kb-row kb-row-2">
          {[...ROWS[1]].map((k) => (
            <span key={k} className={`kb-key${hit(k)}`}>
              {k}
            </span>
          ))}
        </div>
        <div className="kb-row">
          <span className="kb-key kb-mod">⇧</span>
          {[...ROWS[2]].map((k) => (
            <span key={k} className={`kb-key${hit(k)}`}>
              {k}
            </span>
          ))}
          <span className="kb-key kb-mod">⌫</span>
        </div>
        <div className="kb-row">
          <span className={`kb-key kb-mod kb-wide${key && /[0-9!.]/.test(key) ? " is-hit" : ""}`}>
            123
          </span>
          <span className={`kb-key kb-space${hit(" ")}`}>space</span>
          <span className="kb-key kb-mod kb-wide">return</span>
        </div>
      </div>
    </div>
  );
}
