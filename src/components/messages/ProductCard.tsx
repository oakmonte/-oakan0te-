import { Link } from "@tanstack/react-router";
import { ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SeedProduct } from "@/lib/messages-seed";

export function ProductCard({ product, onAdd }: { product: SeedProduct; onAdd: () => void }) {
  return (
    <article className="w-[252px] overflow-hidden rounded-[18px] border border-chat-border bg-chat-elevated">
      <Link
        to="/store/products/$id"
        params={{ id: product.id }}
        aria-label={`View ${product.name}`}
      >
        <img src={product.image} alt={product.name} className="aspect-square w-full object-cover" />
      </Link>
      <div className="p-3">
        <p className="truncate text-[14px] font-semibold text-chat-text">{product.name}</p>
        <p className="mt-0.5 text-[14px] font-bold text-chat-text">{product.price}</p>
        <p className="mt-0.5 truncate text-[11px] text-chat-muted">{product.store}</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button
            asChild
            size="sm"
            variant="secondary"
            className="h-9 rounded-full bg-chat-soft text-chat-text active:scale-95"
          >
            <Link to="/store/products/$id" params={{ id: product.id }}>
              View
            </Link>
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={onAdd}
            className="h-9 rounded-full bg-chat-text text-chat-inverse active:scale-95"
          >
            <ShoppingBag /> Add
          </Button>
        </div>
      </div>
    </article>
  );
}
