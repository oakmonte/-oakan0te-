export function VerifiedBadge({ size = 14 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-label="Verified"
      role="img"
      className="shrink-0"
    >
      <path
        fill="#3897f0"
        d="M12 1.5l2.6 2.2 3.4-.3.9 3.3 2.9 1.8-1.4 3.1 1.4 3.1-2.9 1.8-.9 3.3-3.4-.3L12 22.5l-2.6-2.2-3.4.3-.9-3.3L2.2 15.5l1.4-3.1-1.4-3.1L5.1 7.5l.9-3.3 3.4.3z"
      />
      <path fill="#fff" d="M10.7 15.6l-3-3 1.3-1.3 1.7 1.7 4.3-4.3 1.3 1.3z" />
    </svg>
  );
}
