import { createContext, useContext } from "react";
import type { GlobalContext } from "@/api/types";

export interface ConnectionContextValue {
  connectionId: string | null;
  globalContext: GlobalContext | null;
}

export const ConnectionContext = createContext<ConnectionContextValue>({
  connectionId: null,
  globalContext: null,
});

export function useConnectionContext(): ConnectionContextValue {
  return useContext(ConnectionContext);
}
