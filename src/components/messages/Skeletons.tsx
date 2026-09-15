/** Shimmer placeholders. The `messages-skeleton` utility lives in styles.css. */

export function ConversationSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div aria-hidden className="pt-2">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex items-center gap-3.5 px-5 py-3">
          <div className="messages-skeleton h-14 w-14 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <div
              className="messages-skeleton h-[13px] rounded-full"
              style={{ width: `${44 + ((index * 13) % 34)}%` }}
            />
            <div
              className="messages-skeleton h-[11px] rounded-full"
              style={{ width: `${58 + ((index * 9) % 30)}%` }}
            />
          </div>
          <div className="messages-skeleton h-[10px] w-7 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function ThreadSkeleton() {
  const widths = [58, 72, 40, 66, 48];
  return (
    <div aria-hidden className="space-y-3 px-4 pt-4">
      {widths.map((width, index) => (
        <div key={index} className={`flex ${index % 2 ? "justify-end" : "justify-start"}`}>
          <div
            className="messages-skeleton h-[38px] rounded-[22px]"
            style={{ width: `${width}%` }}
          />
        </div>
      ))}
    </div>
  );
}
