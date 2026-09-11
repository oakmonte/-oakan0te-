export function TypingDots({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-[3px] ${className}`} aria-label="Typing">
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className="block h-[6px] w-[6px] rounded-full bg-current motion-reduce:animate-none"
          style={{ animation: `messages-typing-bounce 1.05s ${index * 0.14}s infinite ease-in-out` }}
        />
      ))}
    </span>
  );
}
