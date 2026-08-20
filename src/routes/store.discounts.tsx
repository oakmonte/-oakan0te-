import { createFileRoute } from "@tanstack/react-router";
import { Tag } from "lucide-react";
import { ComingSoonState } from "@/components/store/ComingSoonState";

export const Route = createFileRoute("/store/discounts")({
  component: () => (
    <ComingSoonState
      icon={Tag}
      title="Discounts aren't live yet"
      description="You'll be able to create these once your store starts selling."
    />
  ),
});
