import { useId } from "react";

/** "Add to bag": master-piece's Cart tab bag (src/assets/cart.svg, a filled
 *  bag and its handle, strap holes left out) with a plus cut out of its
 *  body, so the video shows through the plus. */
export function BagPlus({ size = 24, className }: { size?: number; className?: string }) {
  // Unique per instance: every card in the feed draws one.
  const mask = `bag-plus-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <mask id={mask}>
          <rect width="24" height="24" fill="white" />
          <path
            d="M12 13.4v5.6M9.2 16.2h5.6"
            stroke="black"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </mask>
      </defs>
      <path
        mask={`url(#${mask})`}
        fill="currentColor"
        d="M12.0049 0.999756C14.7663 0.999756 17.0049 3.23833 17.0049 5.99975V7.99975H20.0049C20.5572 7.99975 21.0049 8.44747 21.0049 8.99975V20.9998C21.0049 21.5521 20.5572 21.9998 20.0049 21.9998H4.00488C3.4526 21.9998 3.00488 21.5521 3.00488 20.9998V8.99975C3.00488 8.44747 3.4526 7.99975 4.00488 7.99975H7.00488V5.99975C7.00488 3.23833 9.24346 0.999756 12.0049 0.999756ZM12.0049 2.99975C10.4072 2.99975 9.10122 4.24867 9.00998 5.82348L9.00488 5.99975V7.99975H15.0049V5.99975C15.0049 4.40207 13.756 3.09609 12.1812 3.00485L12.0049 2.99975Z"
      />
    </svg>
  );
}
