import { useEffect, useState } from "react";
import { authedFetch } from "@/lib/authed-fetch";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { supabase } from "@/lib/integrations/my-supabase/client";
import { CheckoutShell } from "@/components/checkout/CheckoutShell";
import { DeliveryCheckout } from "@/components/checkout/DeliveryCheckout";

export const Route = createFileRoute("/checkout/$productId")({
  validateSearch: (s: Record<string, unknown>): { variant?: string; offer?: string } => ({
    variant: typeof s.variant === "string" && s.variant ? s.variant : undefined,
    // An accepted offer (Messages -> Offers): checkout charges its agreed price.
    offer: typeof s.offer === "string" && s.offer ? s.offer : undefined,
  }),
  head: () => ({ meta: [{ title: "Checkout — Oakmonte" }] }),
  component: CheckoutPage,
});

type Summary = {
  title: string;
  variantLabel: string | null;
  price: number | null;
  image: string | null;
};

async function loadSummary(productId: string, variantId?: string): Promise<Summary | null> {
  const { data } = await supabase
    .from("products")
    .select("title, product_variants(id, price, option1_value, main_image_url)")
    .eq("id", productId)
    .eq("status", "active")
    .maybeSingle();
  if (!data) return null;
  const variants = data.product_variants ?? [];
  const v = variants.find((x) => x.id === variantId) ?? variants[0];
  return {
    title: data.title ?? "Untitled",
    variantLabel: variants.length > 1 ? (v?.option1_value ?? null) : null,
    price: v?.price ?? null,
    image: v?.main_image_url ?? null,
  };
}

// Buy Now: one product, straight from its page. The address, courier and
// payment steps are DeliveryCheckout, shared with the bag's checkout.
function CheckoutPage() {
  const { productId } = Route.useParams();
  const { variant, offer } = Route.useSearch();
  const navigate = useNavigate();
  const [summary, setSummary] = useState<Summary | null | undefined>(undefined);

  useEffect(() => {
    void loadSummary(productId, variant).then(async (s) => {
      // The agreed price, for show. The server re-checks the offer and charges
      // its price whatever this page says.
      if (s && offer) {
        try {
          const res = await authedFetch("/api/offers");
          const body = (await res.json()) as {
            offers?: { id: string; agreed: number | null; status: string }[];
          };
          const o = body.offers?.find((x) => x.id === offer && x.status === "accepted");
          if (o?.agreed != null) s = { ...s, price: o.agreed };
        } catch {
          // Shows the list price; the order still uses the offer's.
        }
      }
      setSummary(s);
    });
  }, [productId, variant, offer]);

  function back() {
    if (window.history.length > 1) window.history.back();
    else void navigate({ to: "/home" });
  }

  return (
    <CheckoutShell
      back={
        <button
          type="button"
          onClick={back}
          aria-label="Back"
          className="grid h-10 w-10 place-items-center rounded-full bg-white/10"
        >
          <ChevronLeft size={22} />
        </button>
      }
    >
      {summary === null && <p className="text-white/60">This product isn&apos;t available.</p>}
      {summary && (
        <div className="flex items-center gap-3 rounded-2xl bg-white/[0.06] p-3">
          {summary.image && (
            <img src={summary.image} alt="" className="h-16 w-16 rounded-xl object-cover" />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-medium">{summary.title}</p>
            {summary.variantLabel && (
              <p className="text-[13px] text-white/55">{summary.variantLabel}</p>
            )}
          </div>
          {summary.price != null && (
            <p className="text-[15px]">₦{summary.price.toLocaleString()}</p>
          )}
        </div>
      )}

      <DeliveryCheckout
        lines={{ productId, variantId: variant }}
        offerId={offer}
        subtotal={summary?.price ?? null}
        subtotalLabel="Item"
      />
    </CheckoutShell>
  );
}
