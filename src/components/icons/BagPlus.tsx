/** "Add to cart": a cart with a plus over it, line-drawn to match the rest of
 *  the feed rail. The previous filled bag (read as a padlock at a glance) is
 *  kept as BagPlusClassic; to switch back, return <BagPlusClassic {...props} />
 *  here. */
export function BagPlus({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* Handle, then the basket: down the left side, along the bottom, and
          up the right side towards the plus. */}
      <path d="M2 3.2h2.6l4.3 14.1h10.3l2.4-9.6" />
      <path d="M14 4.6v7M10.5 8.1h7" />
      <circle cx="9.2" cy="21.2" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="17.6" cy="21.2" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}
