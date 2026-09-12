export function DateDivider({ label }: { label: string }) {
  return (
    <div className="flex justify-center py-5" role="separator">
      <span className="text-[11px] font-semibold uppercase text-chat-muted">{label}</span>
    </div>
  );
}
