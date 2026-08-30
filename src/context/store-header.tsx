import { createContext, useState, ReactNode } from "react";

export type StoreHeaderContextValue = {
  rightAction: ReactNode;
  setRightAction: (node: ReactNode) => void;
};

export const StoreHeaderContext = createContext<StoreHeaderContextValue | null>(null);

export function StoreHeaderProvider({ children }: { children: ReactNode }) {
  const [rightAction, setRightAction] = useState<ReactNode>(null);

  return (
    <StoreHeaderContext.Provider value={{ rightAction, setRightAction }}>
      {children}
    </StoreHeaderContext.Provider>
  );
}
