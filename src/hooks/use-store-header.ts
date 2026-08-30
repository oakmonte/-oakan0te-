import { useContext } from "react";
import { StoreHeaderContext } from "@/context/store-header-context";

export function useStoreHeader() {
  const ctx = useContext(StoreHeaderContext);
  if (!ctx) throw new Error("useStoreHeader must be used within StoreHeaderProvider");
  return ctx;
}
