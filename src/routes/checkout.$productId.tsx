import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { supabase } from "@/lib/integrations/my-supabase/client";
import { CheckoutShell } from "@/components/checkout/CheckoutShell";
import { DeliveryCheckout } from "@/components/checkout/DeliveryCheckout";
import { SALES_LOCKED } from "@/lib/launch-locks";

export const Route = createFileRoute("/checkout/$productId")({
  // Until launch there's no checkout to reach, even by typing the address
  // (lib/launch-locks.ts).
  beforeLoad: () => {
    if (SALES_LOCKED) throw redirect({ to: "/" });
  },
  validateSearch: (s: Record<string, unknown>): { variant?: string } => ({
    variant: typeof s.variant === "string" && s.variant ? s.variant : undefined,
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
  const { variant } = Route.useSearch();
  const navigate = useNavigate();
  const [summary, setSummary] = useState<Summary | null | undefined>(undefined);

  useEffect(() => {
    void loadSummary(productId, variant).then(setSummary);
  }, [productId, variant]);

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
        subtotal={summary?.price ?? null}
        subtotalLabel="Item"
      />
    </CheckoutShell>
  );
}
