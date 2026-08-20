import { createFileRoute } from "@tanstack/react-router";
import { Users } from "lucide-react";
import { ComingSoonState } from "@/components/store/ComingSoonState";

export const Route = createFileRoute("/store/customers")({
  component: () => (
    <ComingSoonState
      icon={Users}
      title="No customers yet"
      description="This'll be available once shoppers start following your store."
    />
  ),
});
