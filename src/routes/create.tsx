// create.tsx
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useEffect } from "react";
import { BlobManager } from "@/lib/blob-manager";

export const Route = createFileRoute("/create")({
  component: CreateLayout,
});

function CreateLayout() {
  useEffect(() => {
    // Fires once when the user navigates out of the entire /create hierarchy
    return () => {
      BlobManager.revokeAll();
    };
  }, []);

  return <Outlet />;
}
