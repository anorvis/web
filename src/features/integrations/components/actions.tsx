import { createContext, use } from "react";
import type {
  FatSecretSettings,
  GoogleSettings,
  HevySettings,
  NutritionixSettings,
  PinterestSettings,
  WorkspaceSourceSettings,
} from "@/features/integrations/components/card";

type IntegrationSettingsState = {
  integration: { id: string };
  saving: boolean;
  settings: WorkspaceSourceSettings | null;
  googleSettings: GoogleSettings | null;
  pinterestSettings: PinterestSettings | null;
  hevySettings: HevySettings | null;
  nutritionixSettings: NutritionixSettings | null;
  fatSecretSettings: FatSecretSettings | null;
  googleCanStartOAuth: boolean;
  pinterestCanStartOAuth: boolean;
  googleClientId: string;
  googleClientSecret: string;
  pinterestClientId: string;
  pinterestClientSecret: string;
  hevyApiKey: string;
  nutritionixAppId: string;
  nutritionixApiKey: string;
  fatSecretClientId: string;
  fatSecretClientSecret: string;
  syncResult: string | null;
  setGoogleClientId: (value: string) => void;
  setGoogleClientSecret: (value: string) => void;
  setPinterestClientId: (value: string) => void;
  setPinterestClientSecret: (value: string) => void;
  setHevyApiKey: (value: string) => void;
  setNutritionixAppId: (value: string) => void;
  setNutritionixApiKey: (value: string) => void;
  setFatSecretClientId: (value: string) => void;
  setFatSecretClientSecret: (value: string) => void;
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
