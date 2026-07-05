import { createContext, useContext } from "react";

const HealthActionsContext = createContext<unknown>(null);

export const HealthActionsProvider = HealthActionsContext.Provider;

export function useHealthActions<T>() {
  const actions = useContext(HealthActionsContext);
  if (!actions) {
    throw new Error(
      "useHealthActions must be used within HealthActionsProvider",
    );
  }
  return actions as T;
}
