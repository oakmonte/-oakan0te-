/** A shopping bag with a plus inside: "add to bag". Drawn on lucide's own
 *  shopping-bag outline (same 24px grid, 2px round stroke) so it sits beside
 *  lucide icons without looking borrowed; lucide has no bag-plus of its own. */
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
      <path d="M3.103 6.034h17.794" />
      <path d="M3.4 5.467a2 2 0 0 0-.4 1.2V20a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6.667a2 2 0 0 0-.4-1.2l-2-2.667A2 2 0 0 0 17 2H7a2 2 0 0 0-1.6.8z" />
      <path d="M12 10.5v7" />
      <path d="M8.5 14h7" />
    </svg>
  );
}
