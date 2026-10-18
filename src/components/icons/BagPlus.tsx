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
      <path d="M2 4h2.4l3.1 11.2h10.4l2.3-7.4" />
      <path d="M15.5 2.4v6.2M12.4 5.5h6.2" />
      <circle cx="8.6" cy="19.6" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="16.9" cy="19.6" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}
