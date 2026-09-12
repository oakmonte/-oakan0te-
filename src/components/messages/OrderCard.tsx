import type { SeedMessage } from "@/lib/messages-seed";

const STEPS = ["Paid", "Dispatched", "Delivered"];

export function OrderCard({ message }: { message: SeedMessage }) {
  const order = message.order;
  if (!order) return null;
  return (
    <article className="w-[270px] rounded-[18px] border border-chat-border bg-chat-elevated p-3">
      <div className="flex items-center gap-3">
        <img src={order.image} alt={order.title} className="h-14 w-14 rounded-md object-cover" />
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-chat-muted">{order.code}</p>
          <p className="truncate text-[14px] font-semibold text-chat-text">{order.title}</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3">
        {STEPS.map((step, index) => (
          <div key={step} className="relative text-center">
            {index > 0 && <span className={`absolute right-1/2 top-[5px] h-px w-full ${index <= order.step ? "bg-chat-text" : "bg-chat-border"}`} />}
            <span className={`relative z-10 mx-auto block h-[11px] w-[11px] rounded-full border ${index <= order.step ? "border-chat-text bg-chat-text" : "border-chat-muted bg-chat-elevated"}`} />
            <span className={`mt-2 block text-[9px] ${index <= order.step ? "text-chat-text" : "text-chat-muted"}`}>{step}</span>
          </div>
        ))}
      </div>
    </article>
  );
}
