import { createFileRoute } from "@tanstack/react-router";
import { Image as ImageIcon } from "lucide-react";
import { ComingSoonState } from "@/components/store/ComingSoonState";

export const Route = createFileRoute("/store/content")({
  component: () => (
    <ComingSoonState
      icon={ImageIcon}
      title="No content yet"
      description="This'll fill up once you start posting."
    />
  ),
});
