export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={`inline-block h-[18px] w-[18px] rounded-full border-2 border-current/25 border-t-current animate-spin ${className}`}
    />
  );
}
