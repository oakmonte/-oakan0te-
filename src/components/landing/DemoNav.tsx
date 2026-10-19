import { GLASS_RIM, glassLens, glassLight } from "@/lib/liquid-glass";
import websiteIcon from "@/assets/website.svg";
import messagesIcon from "@/assets/messages.svg";
import createIcon from "@/assets/create.svg";
import storeIcon from "@/assets/Home.svg";
import profileIcon from "@/assets/profile.svg";

/** The app's bottom bar (components/BottomNav.tsx), drawn for the landing
 *  demos. `active` lights a tab; changing it slides the lens across, the way
 *  the real bar does. Styled by the sp-nav rules in routes/index.tsx. */
const NAV = [storeIcon, websiteIcon, createIcon, messagesIcon, profileIcon];

export const NAV_STORE = 0;
export const NAV_MESSAGES = 3;

export function DemoNav({ active }: { active: number }) {
  return (
    <nav className={`sp-nav ${GLASS_RIM}`} style={glassLight}>
      <span
        className={`sp-nav-lens ${GLASS_RIM}`}
        style={{ ...glassLens, transform: `translateX(${active * 100}%)` }}
      />
      {NAV.map((icon, i) => (
        <img key={icon} src={icon} alt="" className={i === active ? "is-on" : ""} />
      ))}
    </nav>
  );
}
