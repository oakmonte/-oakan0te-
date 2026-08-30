import { createContext, useContext, useState, ReactNode, useCallback } from "react";

export type StoreHeaderContextValue = {
  setRightAction: (node: ReactNode) => void;
};

const StoreHeaderContext = createContext<StoreHeaderContextValue | null>(null);

export function StoreHeaderProvider({ children }: { children: ReactNode }) {
  const [rightAction, setRightActionState] = useState<ReactNode>(null);

  const setRightAction = useCallback((node: ReactNode) => {
    setRightActionState(node);
  }, []);

  return (
    <StoreHeaderContext.Provider value={{ setRightAction }}>
      {children}
      {rightAction && (
        <div className="sr-only" aria-hidden="true">
          {rightAction}
        </div>
      )}
    </StoreHeaderContext.Provider>
  );
}

export function useStoreHeader() {
  const ctx = useContext(StoreHeaderContext);
  if (!ctx) throw new Error("useStoreHeader must be used within StoreHeaderProvider");
  return ctx;
}
