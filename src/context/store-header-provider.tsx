import { useState, ReactNode } from "react";
import { StoreHeaderContext } from "./store-header-context";

export function StoreHeaderProvider({ children }: { children: ReactNode }) {
  const [rightAction, setRightAction] = useState<ReactNode>(null);

  return (
    <StoreHeaderContext.Provider value={{ rightAction, setRightAction }}>
      {children}
    </StoreHeaderContext.Provider>
  );
}
