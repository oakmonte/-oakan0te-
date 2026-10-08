import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/integrations/my-supabase/client";
import { ProductPage } from "@/components/store-themes/ProductPage";
import { CatalogTile } from "@/components/store-themes/full-preview-blocks";
import { SalesLockedNotice } from "@/components/store-themes/SalesLockedNotice";
import type { PreviewTile } from "@/components/store-themes/storefront-catalog";
import { readStorefrontLook, type StorefrontLook } from "@/components/store-themes/storefront-look";

type ShopProduct = {
  tile: PreviewTile;
  brand: string;
};

type Row = {
  id: string;
  title: string | null;
  stores: { brand_name: string } | null;
  product_variants:
    | {
        price: number | null;
        compare_at_price: number | null;
        main_image_url: string | null;
        additional_image_urls: string[] | null;
      }[]
    | null;
};

async function fetchShopProducts(): Promise<ShopProduct[]> {
  const { data, error } = await supabase
    .from("products")
    .select(
      "id, title, stores(brand_name), product_variants(price, compare_at_price, main_image_url, additional_image_urls)",
    )
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .order("created_at", { referencedTable: "product_variants", ascending: true })
    .limit(80);
  if (error) {
    console.error("ShopFeed: failed to load products", error);
    throw error;
  }
  return (
    ((data ?? []) as unknown as Row[])
      .map((p) => {
        const variants = p.product_variants ?? [];
        const photos = variants.flatMap((v, vi) =>
          [v.main_image_url, ...(v.additional_image_urls ?? [])]
            .filter((u): u is string => !!u && u.trim() !== "")
            .map((url) => ({ url, variant: vi })),
        );
        const tile: PreviewTile = {
          id: p.id,
          title: p.title ?? "Untitled",
          photos,
          variantCount: variants.length,
          price: variants[0]?.price ?? null,
          compareAtPrice: variants[0]?.compare_at_price ?? null,
        };
        return { tile, brand: p.stores?.brand_name ?? "" };
      })
      // No photo means nothing to show; no real price means it cannot be bought.
      .filter((p) => p.tile.photos.length > 0 && (p.tile.price ?? 0) > 0)
  );
}

// Same tile as a storefront: swipe between photos, dots, the glass "..."
// button bottom right. Home is the app's own surface, so it takes the chat-*
// colours; the accent must be a literal colour (the tile computes readable
// text against it).
function Card({ item, onOpen, wide }: { item: ShopProduct; onOpen: () => void; wide?: boolean }) {
  return (
    <div className={wide ? "w-[190px] shrink-0" : "w-full"}>
      <CatalogTile
        tile={item.tile}
        mode="products"
        textColor="var(--color-chat-text)"
        mutedColor="var(--color-chat-muted)"
        tileBg="transparent"
        accent="#7596ff"
        onTap={onOpen}
        onOpen={onOpen}
      />
    </div>
  );
}

function Shelf({
  title,
  items,
  onOpen,
}: {
  title: string;
  items: ShopProduct[];
  onOpen: (item: ShopProduct) => void;
}) {
  if (items.length === 0) return null;
  return (
    <section className="mt-6">
      <h2 className="px-4 text-[22px] font-bold tracking-[-0.02em] text-chat-text">{title}</h2>
      <div className="mt-2.5 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((it) => (
          <Card key={it.tile.id} item={it} wide onOpen={() => onOpen(it)} />
        ))}
      </div>
    </section>
  );
}

/** The Shop tab: a feature banner, then shelves across every store, then the
 *  whole catalogue as a grid. A tap opens the same product page a storefront
 *  uses; the page's own Buy Now carries on to checkout. */
export function ShopFeed() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [opened, setOpened] = useState<{ item: ShopProduct; look: StorefrontLook } | null>(null);
  const [locked, setLocked] = useState(false);
  const { data: products, isPending } = useQuery({
    queryKey: ["home-shop-products"],
    queryFn: fetchShopProducts,
    staleTime: 60_000,
  });

  function open(item: ShopProduct) {
    const look = readStorefrontLook(rootRef.current, {
      textColor: "var(--color-chat-text)",
      mutedColor: "var(--color-chat-muted)",
      tileBg: "var(--color-chat-soft)",
      accent: "var(--color-chat-accent)",
    });
    setOpened({ item, look });
  }

  if (isPending) {
    return (
      <div className="px-4 pt-24">
        <div className="aspect-[4/5] animate-pulse rounded-[18px] bg-chat-soft" />
      </div>
    );
  }
  if (!products || products.length === 0) {
    return (
      <div className="px-8 pt-[40vh] text-center">
        <p className="text-[17px] font-semibold text-chat-text">No pieces yet</p>
        <p className="mt-1 text-[14px] text-chat-muted">
          Listed products from every store show up here.
        </p>
      </div>
    );
  }

  const [feature, ...rest] = products;
  const onSale = products.filter(
    (p) =>
      p.tile.compareAtPrice != null && p.tile.price != null && p.tile.compareAtPrice > p.tile.price,
  );
  return (
    <div ref={rootRef} className="pb-6 pt-20">
      <button
        type="button"
        onClick={() => open(feature)}
        className="relative mx-4 block aspect-[4/5] w-[calc(100%-2rem)] overflow-hidden rounded-[22px] bg-chat-soft text-left"
      >
        <img
          src={feature.tile.photos[0].url}
          alt=""
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-5 pb-5 pt-16 text-white">
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-white/70">
            {feature.brand || "Just in"}
          </p>
          <p className="mt-0.5 text-[26px] font-black leading-[1.05] tracking-[-0.02em]">
            {feature.tile.title}
          </p>
          <span className="mt-3 inline-flex h-10 items-center rounded-full bg-white px-5 text-[14px] font-semibold text-black">
            Shop now
          </span>
        </div>
      </button>

      <Shelf title="New arrivals" items={rest.slice(0, 10)} onOpen={open} />
      <Shelf title="On sale" items={onSale.slice(0, 10)} onOpen={open} />

      {rest.length > 10 && (
        <section className="mt-6 px-4">
          <h2 className="text-[22px] font-bold tracking-[-0.02em] text-chat-text">All pieces</h2>
          <div className="mt-2.5 grid grid-cols-2 gap-3">
            {rest.slice(10).map((it) => (
              <Card key={it.tile.id} item={it} onOpen={() => open(it)} />
            ))}
          </div>
        </section>
      )}

      {opened && (
        <ProductPage
          tile={opened.item.tile}
          look={opened.look}
          onClose={() => setOpened(null)}
          onAction={() => setLocked(true)}
        />
      )}
      {locked && <SalesLockedNotice onClose={() => setLocked(false)} />}
    </div>
  );
}
