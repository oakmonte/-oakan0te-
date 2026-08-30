import { createContext, useContext, useState, ReactNode } from "react";

export type StoreHeaderContextValue = {
  rightAction: ReactNode;
  setRightAction: (node: ReactNode) => void;
};

const StoreHeaderContext = createContext<StoreHeaderContextValue | null>(null);

export function StoreHeaderProvider({ children }: { children: ReactNode }) {
  const [rightAction, setRightAction] = useState<ReactNode>(null);

  return (
    <StoreHeaderContext.Provider value={{ rightAction, setRightAction }}>
      {children}
    </StoreHeaderContext.Provider>
  );
}

export function useStoreHeader() {
  const ctx = useContext(StoreHeaderContext);
  if (!ctx) throw new Error("useStoreHeader must be used within StoreHeaderProvider");
  return ctx;
}
