import { createFileRoute } from "@tanstack/react-router";
import { ShoppingBag } from "lucide-react";
import { ComingSoonState } from "@/components/store/ComingSoonState";

export const Route = createFileRoute("/store/orders")({
  component: () => (
    <ComingSoonState
      icon={ShoppingBag}
      title="No orders yet"
      description="This'll fill up once your store starts selling."
    />
  ),
});
