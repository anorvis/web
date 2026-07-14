import { createContext, use } from "react";
import type {
  GoogleSettings,
  HevySettings,
  PinterestSettings,
  SnapTradeSettings,
  WorkspaceSourceSettings,
} from "@/features/integrations/components/card";

export type IntegrationSettingsState = {
  integration: { id: string };
  saving: boolean;
  settings: WorkspaceSourceSettings | null;
  googleSettings: GoogleSettings | null;
  pinterestSettings: PinterestSettings | null;
  hevySettings: HevySettings | null;
  snapTradeSettings: SnapTradeSettings | null;
  googleCanStartOAuth: boolean;
  pinterestCanStartOAuth: boolean;
  googleClientId: string;
  googleClientSecret: string;
  pinterestClientId: string;
  pinterestClientSecret: string;
  hevyApiKey: string;
  snapTradeClientId: string;
  snapTradeConsumerKey: string;
  syncResult: string | null;
  setGoogleClientId: (value: string) => void;
  setGoogleClientSecret: (value: string) => void;
  setPinterestClientId: (value: string) => void;
  setPinterestClientSecret: (value: string) => void;
  setHevyApiKey: (value: string) => void;
  setSnapTradeClientId: (value: string) => void;
  setSnapTradeConsumerKey: (value: string) => void;
  addWorkspaceSourcePath: (path: string) => void;
  addWorkspaceSource: () => void;
  removeWorkspaceSource: (path: string) => void;
  syncHevy: () => void;
};

const IntegrationSettingsContext =
  createContext<IntegrationSettingsState | null>(null);

export const IntegrationSettingsProvider = IntegrationSettingsContext.Provider;

export function useIntegrationSettings() {
  const value = use(IntegrationSettingsContext);
  if (!value) {
    throw new Error(
      "useIntegrationSettings must be used within IntegrationSettingsProvider",
    );
  }
  return value;
}
