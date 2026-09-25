// Tab bar icons + the TABS list itself. Shared by /profile/$username and
// /store-profile/$storeUsername so their tab bars can't drift apart.
//
// react-refresh/only-export-components flags every local icon function here
// because the file's exports (TABS, TabKey) aren't components — even though
// the icons themselves are never exported. There's no split that avoids
// this: TABS is a plain data table, not a component, and it needs these
// icons to build itself. Disabled deliberately, not a baseline exception.
/* eslint-disable react-refresh/only-export-components */
import type { ReactElement } from "react";

function PostsIcon(props: { className?: string }) {
  return (
    <svg
      width="15"
      height="23"
      viewBox="0 0 15 23"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={props.className}
    >
      <path
        d="M2.15625 4.3125C3.34712 4.3125 4.3125 3.34712 4.3125 2.15625C4.3125 0.965382 3.34712 0 2.15625 0C0.965382 0 0 0.965382 0 2.15625C0 3.34712 0.965382 4.3125 2.15625 4.3125ZM2.15625 13.6562C3.34712 13.6562 4.3125 12.6908 4.3125 11.5C4.3125 10.3092 3.34712 9.34375 2.15625 9.34375C0.965382 9.34375 0 10.3092 0 11.5C0 12.6908 0.965382 13.6562 2.15625 13.6562ZM4.3125 20.8438C4.3125 22.0346 3.34712 23 2.15625 23C0.965382 23 0 22.0346 0 20.8438C0 19.6529 0.965382 18.6875 2.15625 18.6875C3.34712 18.6875 4.3125 19.6529 4.3125 20.8438ZM12.2188 4.3125C13.4096 4.3125 14.375 3.34712 14.375 2.15625C14.375 0.965382 13.4096 0 12.2188 0C11.0279 0 10.0625 0.965382 10.0625 2.15625C10.0625 3.34712 11.0279 4.3125 12.2188 4.3125ZM14.375 11.5C14.375 12.6908 13.4096 13.6562 12.2188 13.6562C11.0279 13.6562 10.0625 12.6908 10.0625 11.5C10.0625 10.3092 11.0279 9.34375 12.2188 9.34375C13.4096 9.34375 14.375 10.3092 14.375 11.5ZM12.2188 23C13.4096 23 14.375 22.0346 14.375 20.8438C14.375 19.6529 13.4096 18.6875 12.2188 18.6875C11.0279 18.6875 10.0625 19.6529 10.0625 20.8438C10.0625 22.0346 11.0279 23 12.2188 23Z"
        fill="currentColor"
      />
    </svg>
  );
}

function StoreIcon(props: { className?: string }) {
  return (
    <svg
      width="26"
      height="23"
      viewBox="0 0 26 23"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={props.className}
    >
      <path
        d="M23 12.9285V20.7H24.15V23H1.15V20.7H2.3V12.9285C0.913112 12.0002 0 10.4192 0 8.625C0 7.67379 0.258094 6.75764 0.728203 5.97708L3.8471 0.575C4.05252 0.21919 4.43217 0 4.84302 0H20.457C20.8678 0 21.2475 0.21919 21.4529 0.575L24.5611 5.95898C25.0419 6.75764 25.3 7.67379 25.3 8.625C25.3 10.4192 24.3869 12.0002 23 12.9285ZM20.7 13.7684C20.5112 13.7893 20.3193 13.8 20.125 13.8C18.677 13.8 17.3407 13.1997 16.3875 12.2052C15.4343 13.1997 14.098 13.8 12.65 13.8C11.202 13.8 9.86574 13.1997 8.9125 12.2052C7.95926 13.1997 6.62298 13.8 5.175 13.8C4.98065 13.8 4.7888 13.7893 4.6 13.7684V20.7H20.7V13.7684ZM5.50695 2.3L2.70938 7.14519C2.4427 7.58819 2.3 8.09474 2.3 8.625C2.3 10.2128 3.58718 11.5 5.175 11.5C6.3606 11.5 7.41137 10.7758 7.84506 9.69392C8.23101 8.73106 9.59399 8.73106 9.97994 9.69392C10.4136 10.7758 11.4643 11.5 12.65 11.5C13.8356 11.5 14.8864 10.7758 15.3201 9.69392C15.706 8.73106 17.069 8.73106 17.4549 9.69392C17.8886 10.7758 18.9394 11.5 20.125 11.5C21.7128 11.5 23 10.2128 23 8.625C23 8.09474 22.8573 7.58819 22.5799 7.12708L19.793 2.3H5.50695Z"
        fill="currentColor"
      />
    </svg>
  );
}

function WardrobeIcon(props: { className?: string }) {
  return (
    <svg
      width="21"
      height="22"
      viewBox="0 0 209 224"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={props.className}
    >
      <path
        d="M195.968 153.089L103.968 206.739L11.9685 153.089C10.1469 152.182 8.04822 152.004 6.09953 152.589C4.15085 153.175 2.49864 154.482 1.47921 156.243C0.459779 158.004 0.149738 160.087 0.612192 162.069C1.07465 164.05 2.27484 165.781 3.96848 166.909L99.9685 222.909C101.192 223.623 102.582 223.998 103.998 223.998C105.415 223.998 106.805 223.623 108.028 222.909L204.028 166.909C204.951 166.388 205.76 165.688 206.409 164.851C207.059 164.014 207.536 163.056 207.812 162.034C208.088 161.011 208.159 159.944 208.019 158.893C207.88 157.843 207.533 156.831 207 155.916C206.466 155.001 205.756 154.201 204.91 153.562C204.065 152.924 203.101 152.46 202.075 152.197C201.049 151.934 199.98 151.877 198.932 152.03C197.884 152.184 196.877 152.544 195.968 153.089Z"
        fill="currentColor"
      />
      <path
        d="M195.968 105.089L103.968 158.739L11.9685 105.089C10.1469 104.182 8.04822 104.004 6.09953 104.589C4.15085 105.175 2.49864 106.482 1.47921 108.243C0.459779 110.004 0.149738 112.087 0.612192 114.069C1.07465 116.05 2.27484 117.781 3.96848 118.909L99.9685 174.909C101.192 175.623 102.582 175.998 103.998 175.998C105.415 175.998 106.805 175.623 108.028 174.909L204.028 118.909C204.951 118.388 205.76 117.688 206.409 116.851C207.059 116.014 207.536 115.056 207.812 114.034C208.088 113.011 208.159 111.944 208.019 110.893C207.88 109.843 207.533 108.831 207 107.916C206.466 107.001 205.756 106.201 204.91 105.562C204.065 104.924 203.101 104.46 202.075 104.197C201.049 103.934 199.98 103.877 198.932 104.03C197.884 104.184 196.877 104.544 195.968 105.089Z"
        fill="currentColor"
      />
      <path
        d="M3.96864 70.9092L99.9686 126.909C101.192 127.623 102.583 127.998 103.999 127.998C105.415 127.998 106.805 127.623 108.029 126.909L204.029 70.9092C205.236 70.2047 206.238 69.1959 206.935 67.9835C207.631 66.7711 207.997 65.3974 207.997 63.9992C207.997 62.6011 207.631 61.2273 206.935 60.0149C206.238 58.8025 205.236 57.7938 204.029 57.0892L108.029 1.0892C106.805 0.375866 105.415 0 103.999 0C102.583 0 101.192 0.375866 99.9686 1.0892L3.96864 57.0892C2.76099 57.7938 1.75907 58.8025 1.06275 60.0149C0.366422 61.2273 0 62.6011 0 63.9992C0 65.3974 0.366422 66.7711 1.06275 67.9835C1.75907 69.1959 2.76099 70.2047 3.96864 70.9092Z"
        fill="currentColor"
      />
    </svg>
  );
}

function RepostIcon(props: { className?: string }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={props.className}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M17 7H7V11H5V7C5 5.89543 5.89543 5 7 5H17V2L21 6L17 10V7ZM7 17H17V13H19V17C19 18.1046 18.1046 19 17 19H7V22L3 18L7 14V17Z"
        fill="currentColor"
      />
    </svg>
  );
}

function WishlistIcon(props: { className?: string }) {
  return (
    <svg
      width="17"
      height="22"
      viewBox="0 0 17 22"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={props.className}
    >
      <path
        d="M1.0625 0H15.9375C16.5243 0 17 0.477142 17 1.06572V21.467C17 21.7613 16.7621 22 16.4688 22C16.369 22 16.2711 21.9717 16.1865 21.9185L8.5 17.0848L0.81344 21.9185C0.564857 22.0748 0.237001 21.9995 0.0811429 21.7501C0.0281241 21.6653 0 21.5672 0 21.467V1.06572C0 0.477142 0.475702 0 1.0625 0ZM14.875 2.13143H2.125V18.578L8.5 14.5691L14.875 18.578V2.13143Z"
        fill="currentColor"
      />
    </svg>
  );
}

function LikedVideosIcon(props: { className?: string }) {
  return (
    <svg
      width="20"
      height="19"
      viewBox="0 0 20 19"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={props.className}
    >
      <path
        d="M10.001 1.52853C12.35 -0.579999 15.98 -0.509999 18.2426 1.75736C20.5053 4.02472 20.583 7.637 18.4786 9.993L9.9999 18.485L1.52138 9.993C-0.582952 7.637 -0.504292 4.01901 1.75736 1.75736C4.02157 -0.506849 7.64519 -0.583129 10.001 1.52853Z"
        fill="currentColor"
      />
    </svg>
  );
}

function DraftsIcon(props: { className?: string }) {
  return (
    <svg
      width="21"
      height="20"
      viewBox="0 0 21 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={props.className}
    >
      <path
        d="M17 0C17.5523 0 18 0.44772 18 1V4.757L16 6.757V2H2V18H16V15.242L18 13.242V19C18 19.5523 17.5523 20 17 20H1C0.44772 20 0 19.5523 0 19V1C0 0.44772 0.44772 0 1 0H17ZM18.7782 6.80761L20.1924 8.2218L12.4142 16L10.9979 15.9979L11 14.5858L18.7782 6.80761ZM10 10V12H5V10H10ZM13 6V8H5V6H13Z"
        fill="currentColor"
      />
    </svg>
  );
}

export type TabKey =
  | "posts"
  | "store"
  | "wardrobe"
  | "reposts"
  | "wishlist"
  | "likedVideos"
  | "drafts";

export const TABS: {
  key: TabKey;
  label: string;
  Icon: (p: { className?: string }) => ReactElement;
  size?: string;
}[] = [
  { key: "posts", label: "Posts", Icon: PostsIcon },
  { key: "store", label: "Store", Icon: StoreIcon },
  { key: "wardrobe", label: "Wardrobe", Icon: WardrobeIcon },
  { key: "reposts", label: "Reposts", Icon: RepostIcon, size: "w-[26px] h-[26px]" },
  { key: "wishlist", label: "Wishlist", Icon: WishlistIcon },
  { key: "likedVideos", label: "Liked videos", Icon: LikedVideosIcon },
  { key: "drafts", label: "Drafts", Icon: DraftsIcon },
];

/** The store profile's tabs. A store still gets the wardrobe/gallery slot —
 *  unlike a personal profile it can't literally own clothes, but it can show
 *  pieces that aren't for sale, backed by `store_pieces` (store_id, not
 *  user_id) rather than the personal-profile wardrobe concept. Label swaps to
 *  "Gallery" for an Artist store, same isArtist ternary used in
 *  name-your-store.tsx. Everything else stays in the same order, so the two
 *  profile shapes still read as siblings. */
export function storeTabsFor(storeType: string | null): typeof TABS {
  const isArtist = storeType === "Artist";
  return TABS.map((t) =>
    t.key === "wardrobe" ? { ...t, label: isArtist ? "Gallery" : "Wardrobe" } : t,
  );
}
