import { createFileRoute } from "@tanstack/react-router";
import { TrendingUp } from "lucide-react";
import { ComingSoonState } from "@/components/store/ComingSoonState";

export const Route = createFileRoute("/store/growth")({
  component: () => (
    <ComingSoonState
      icon={TrendingUp}
      title="Nothing to show yet"
      description="Growth insights will show up here once you start selling."
    />
  ),
});
