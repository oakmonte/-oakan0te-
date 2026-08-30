import { createContext, ReactNode } from "react";

export type StoreHeaderContextValue = {
  rightAction: ReactNode;
  setRightAction: (node: ReactNode) => void;
};

export const StoreHeaderContext = createContext<StoreHeaderContextValue | null>(null);
