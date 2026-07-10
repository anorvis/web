"use client";

import { Card, CardContent, CardHeader } from "@anorvis/ui/card";
import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@anorvis/ui/dialog";
import { integrationStyles, workspacePageStyles } from "@anorvis/ui/styles";
import { cn } from "@anorvis/ui/utils";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { WorkspaceDialog } from "@/components/layout/workspace-dialog";
import {
  deleteIntegrationAction,
  fetchIntegrationSettings,
  postIntegrationAction,
  saveIntegrationSettings,
} from "@/features/integrations/api/integrations";
import { IntegrationSettingsProvider } from "@/features/integrations/components/actions";
import { IntegrationDialogActions } from "@/features/integrations/components/dialog-actions";
import { PROVIDER_MARK } from "@/features/integrations/components/provider-mark";
import { Settings } from "@/features/integrations/components/settings";
import type { IntegrationCatalogEntry } from "@/features/overview/types/overview";
import { clearLifeReadCache } from "@/lib/life-intelligence/life-read-cache";
import { queryKeys } from "@/lib/query/keys";
import { getStatusTone } from "@/lib/workspace/view-utils";

export type WorkspaceSourceSettings = {
  connected: boolean;
  vaultPath: string | null;
  notesDirectory: string | null;
  availableVaults: { name: string; path: string }[];
  availableFolders: string[];
  linkedFolders: { name: string; sourcePath: string; linkPath: string }[];
  notesRoot: string;
};

export type HevySettings = {
  connected: boolean;
  hasApiKey: boolean;
  lastCheckedAt: string | null;
  secretProvider: string | null;
};
type HevySyncSummary = {
  fetched: number;
  created: number;
  updated: number;
  measurementsFetched?: number;
  measurementsCreated?: number;
  measurementsUpdated?: number;
};
function hevyMeasurementSummary(summary: HevySyncSummary): string {
  return summary.measurementsFetched === undefined
    ? "body measurements unavailable"
    : `${summary.measurementsFetched} measurements (${summary.measurementsCreated ?? 0} new, ${summary.measurementsUpdated ?? 0} updated)`;
}

type OAuthSettings = {
  connected: boolean;
  hasClientConfig: boolean;
  hasClientId: boolean;
  hasClientSecret: boolean;
  scopes: string[];
  canAutoRenew?: boolean;
  accessTokenExpiresAt?: number | null;
};

export type GoogleSettings = OAuthSettings;
export type PinterestSettings = OAuthSettings;

export type NutritionixSettings = {
  connected: boolean;
  hasAppId: boolean;
  hasApiKey: boolean;
  lastCheckedAt: string | null;
  secretProvider: string | null;
};

export type FatSecretSettings = {
  connected: boolean;
  hasClientId: boolean;
  hasClientSecret: boolean;
  lastCheckedAt: string | null;
  secretProvider: string | null;
};

function useIntegrationCardController(integration: IntegrationCatalogEntry) {
  const { refresh } = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<WorkspaceSourceSettings | null>(
    null,
  );
  const [googleSettings, setGoogleSettings] = useState<GoogleSettings | null>(
    null,
  );
  const [pinterestSettings, setPinterestSettings] =
    useState<PinterestSettings | null>(null);
  const [hevySettings, setHevySettings] = useState<HevySettings | null>(null);
  const [nutritionixSettings, setNutritionixSettings] =
    useState<NutritionixSettings | null>(null);
  const [fatSecretSettings, setFatSecretSettings] =
    useState<FatSecretSettings | null>(null);
  const vaultPath = useRef("");
  const notesDirectory = useRef("");
  const [hevyApiKey, setHevyApiKey] = useState("");
  const [googleClientId, setGoogleClientId] = useState("");
  const [googleClientSecret, setGoogleClientSecret] = useState("");
  const [pinterestClientId, setPinterestClientId] = useState("");
  const [pinterestClientSecret, setPinterestClientSecret] = useState("");
  const [nutritionixAppId, setNutritionixAppId] = useState("");
  const [nutritionixApiKey, setNutritionixApiKey] = useState("");
  const [fatSecretClientId, setFatSecretClientId] = useState("");
  const [fatSecretClientSecret, setFatSecretClientSecret] = useState("");
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const googleCanStartOAuth =
    integration.id === "google" &&
    (googleSettings?.hasClientConfig ||
      integration.setupHint === "Ready to connect through Google OAuth.");
  const pinterestCanStartOAuth =
    integration.id === "pinterest" &&
    (pinterestSettings?.hasClientConfig ||
      integration.setupHint === "Ready to connect through Pinterest OAuth.");

  const loadWorkspaceSourceSettings = async (nextVaultPath?: string) => {
    const params = new URLSearchParams();
    if (nextVaultPath) params.set("vaultPath", nextVaultPath);
    const data = await fetchIntegrationSettings<WorkspaceSourceSettings>(
      `/api/integrations/obsidian/settings${params.size > 0 ? `?${params.toString()}` : ""}`,
    ).catch(() => null);
    if (!data) return;
    setSettings(data);
    vaultPath.current = data.vaultPath ?? "";
    notesDirectory.current = data.notesDirectory ?? "";
  };

  const loadSettings = () => {
    if (integration.id === "obsidian") void loadWorkspaceSourceSettings();
    if (integration.id === "google") void loadGoogleSettings();
    if (integration.id === "pinterest") void loadPinterestSettings();
    if (integration.id === "hevy") void loadHevySettings();
    if (integration.id === "nutritionix") void loadNutritionixSettings();
    if (integration.id === "fatsecret") void loadFatSecretSettings();
  };

  const loadHevySettings = async () => {
    const data = await fetchIntegrationSettings<HevySettings>(
      "/api/integrations/hevy/settings",
    ).catch(() => null);
    if (!data) return;
    setHevySettings(data);
    setHevyApiKey("");
  };

  const loadGoogleSettings = async () => {
    const data = await fetchIntegrationSettings<GoogleSettings>(
      "/api/integrations/google/settings",
    ).catch(() => null);
    if (!data) return;
    setGoogleSettings(data);
    setGoogleClientId("");
    setGoogleClientSecret("");
  };

  const loadPinterestSettings = async () => {
    const data = await fetchIntegrationSettings<PinterestSettings>(
      "/api/integrations/pinterest/settings",
    ).catch(() => null);
    if (!data) return;
    setPinterestSettings(data);
    setPinterestClientId("");
    setPinterestClientSecret("");
  };

  const loadNutritionixSettings = async () => {
    const data = await fetchIntegrationSettings<NutritionixSettings>(
      "/api/integrations/nutritionix/settings",
    ).catch(() => null);
    if (!data) return;
    setNutritionixSettings(data);
    setNutritionixAppId("");
    setNutritionixApiKey("");
  };

  const loadFatSecretSettings = async () => {
    const data = await fetchIntegrationSettings<FatSecretSettings>(
      "/api/integrations/fatsecret/settings",
    ).catch(() => null);
    if (!data) return;
    setFatSecretSettings(data);
    setFatSecretClientId("");
    setFatSecretClientSecret("");
  };

  const openModal = () => {
    setOpen(true);
    loadSettings();
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) loadSettings();
  };

  const refreshIntegrationState = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.overview() });
    void queryClient.invalidateQueries({
      queryKey: queryKeys.health.dashboard(),
    });
    void queryClient.invalidateQueries({ queryKey: ["life"] });
    refresh();
  };

  const refreshAndClose = () => {
    refreshIntegrationState();
    setOpen(false);
  };

  const saveHevySettings = async () => {
    setSaving(true);
    setSyncResult(null);
    try {
      await saveIntegrationSettings<HevySettings>(
        "/api/integrations/hevy/settings",
        { apiKey: hevyApiKey },
      );
      const syncData = await postIntegrationAction<HevySyncSummary>(
        "/api/integrations/hevy/sync",
      );
      clearLifeReadCache();
      setSyncResult(
        `connected · ${syncData.fetched} workouts (${syncData.created} new, ${syncData.updated} updated) · ${hevyMeasurementSummary(syncData)}`,
      );
      refreshAndClose();
    } finally {
      setSaving(false);
    }
  };

  const syncHevy = async () => {
    setSaving(true);
    setSyncResult(null);
    try {
      const data = await postIntegrationAction<HevySyncSummary>(
        "/api/integrations/hevy/sync",
      );
      clearLifeReadCache();
      setSyncResult(
        `synced ${data.fetched} workouts (${data.created} new, ${data.updated} updated) · ${hevyMeasurementSummary(data)}`,
      );
      refreshIntegrationState();
    } finally {
      setSaving(false);
    }
  };

  const saveGoogleSettings = async () => {
    setSaving(true);
    try {
      const data = await saveIntegrationSettings<GoogleSettings>(
        "/api/integrations/google/settings",
        { clientId: googleClientId, clientSecret: googleClientSecret },
      );
      setGoogleSettings(data);
      setGoogleClientId("");
      setGoogleClientSecret("");
      refreshIntegrationState();
    } finally {
      setSaving(false);
    }
  };

  const savePinterestSettings = async () => {
    setSaving(true);
    try {
      const data = await saveIntegrationSettings<PinterestSettings>(
        "/api/integrations/pinterest/settings",
        { clientId: pinterestClientId, clientSecret: pinterestClientSecret },
      );
      setPinterestSettings(data);
      setPinterestClientId("");
      setPinterestClientSecret("");
      refreshIntegrationState();
    } finally {
      setSaving(false);
    }
  };

  const saveNutritionixSettings = async () => {
    await saveSecretSettings("/api/integrations/nutritionix/settings", {
      appId: nutritionixAppId,
      apiKey: nutritionixApiKey,
    });
  };

  const saveFatSecretSettings = async () => {
    await saveSecretSettings("/api/integrations/fatsecret/settings", {
      clientId: fatSecretClientId,
      clientSecret: fatSecretClientSecret,
    });
  };

  const saveSecretSettings = async (url: string, body: object) => {
    setSaving(true);
    try {
      await saveIntegrationSettings(url, body);
      refreshAndClose();
    } finally {
      setSaving(false);
    }
  };

  const saveWorkspaceSourceSettings = async () => {
    await saveSecretSettings("/api/integrations/obsidian/settings", {
      enabled: true,
      vaultPath: vaultPath.current,
      notesDirectory: notesDirectory.current,
    });
  };

  const addWorkspaceSource = async () => {
    const picked = await fetch("/api/system/pick-folder", { method: "POST" });
    const payload = (await picked.json()) as {
      path?: string;
      cancelled?: boolean;
    };
    if (!payload.path || payload.cancelled) return;
    await addWorkspaceSourcePath(payload.path);
  };

  const addWorkspaceSourcePath = async (sourcePath: string) => {
    setSaving(true);
    try {
      const data = await saveIntegrationSettings<WorkspaceSourceSettings>(
        "/api/integrations/obsidian/links",
        { sourcePath },
      );
      setSettings(data);
      refreshIntegrationState();
    } finally {
      setSaving(false);
    }
  };

  const removeWorkspaceSource = async (sourcePath: string) => {
    setSaving(true);
    try {
      const data = await deleteIntegrationAction<WorkspaceSourceSettings>(
        "/api/integrations/obsidian/links",
        { sourcePath },
      );
      setSettings(data);
      refreshIntegrationState();
    } finally {
      setSaving(false);
    }
  };

  const disconnect = async () => {
    setSaving(true);
    try {
      await postIntegrationAction(
        `/api/integrations/${integration.id}/disconnect`,
      );
      refreshAndClose();
    } finally {
      setSaving(false);
    }
  };

  return {
    open,
    saving,
    settings,
    googleSettings,
    pinterestSettings,
    hevySettings,
    nutritionixSettings,
    fatSecretSettings,
    googleCanStartOAuth,
    pinterestCanStartOAuth,
    googleClientId,
    googleClientSecret,
    pinterestClientId,
    pinterestClientSecret,
    hevyApiKey,
    nutritionixAppId,
    nutritionixApiKey,
    fatSecretClientId,
    fatSecretClientSecret,
    syncResult,
    setGoogleClientId,
    setGoogleClientSecret,
    setPinterestClientId,
    setPinterestClientSecret,
    setHevyApiKey,
    setNutritionixAppId,
    setNutritionixApiKey,
    setFatSecretClientId,
    setFatSecretClientSecret,
    addWorkspaceSourcePath,
    addWorkspaceSource,
    removeWorkspaceSource,
    syncHevy,
    handleOpenChange,
    openModal,
    saveHevySettings,
    saveGoogleSettings,
    savePinterestSettings,
    saveNutritionixSettings,
    saveFatSecretSettings,
    saveWorkspaceSourceSettings,
    disconnect,
  };
}

export function IntegrationCard({
  integration,
}: {
  integration: IntegrationCatalogEntry;
}) {
  const controller = useIntegrationCardController(integration);
  const {
    open,
    saving,
    settings,
    googleSettings,
    pinterestSettings,
    hevySettings,
    nutritionixSettings,
    fatSecretSettings,
    googleCanStartOAuth,
    pinterestCanStartOAuth,
    googleClientId,
    googleClientSecret,
    pinterestClientId,
    pinterestClientSecret,
    hevyApiKey,
    nutritionixAppId,
    nutritionixApiKey,
    fatSecretClientId,
    fatSecretClientSecret,
    syncResult,
    setGoogleClientId,
    setGoogleClientSecret,
    setPinterestClientId,
    setPinterestClientSecret,
    setHevyApiKey,
    setNutritionixAppId,
    setNutritionixApiKey,
    setFatSecretClientId,
    setFatSecretClientSecret,
    addWorkspaceSourcePath,
    addWorkspaceSource,
    removeWorkspaceSource,
    syncHevy,
    handleOpenChange,
    openModal,
    saveHevySettings,
    saveGoogleSettings,
    savePinterestSettings,
    saveNutritionixSettings,
    saveFatSecretSettings,
    saveWorkspaceSourceSettings,
    disconnect,
  } = controller;
  const canConnect =
    integration.status !== "connected" && integration.connectProvider;
  const isDisabled = integration.status === "unavailable" && !canConnect;
  const mark = PROVIDER_MARK[integration.id] ?? integration.displayName[0];
  const stateLabel =
    integration.status === "connected"
      ? "connected"
      : integration.status === "pending"
        ? "pending"
        : canConnect
          ? "connect"
          : "unavailable";
  const stateClassName = cn(
    "inline-flex h-7 items-center justify-center rounded-none border px-2.5 text-[0.5rem] uppercase tracking-[0.2em] transition-colors",
    getStatusTone(
      integration.status === "available"
        ? "partial"
        : integration.status === "pending"
          ? "elevated"
          : integration.status === "connected"
            ? "connected"
            : "disconnected",
    ),
    canConnect && "hover:border-foreground hover:text-foreground",
  );

  return (
    <>
      <Card
        className={cn(
          integrationStyles.card,
          isDisabled && integrationStyles.disabled,
        )}
        aria-disabled={isDisabled}
        onClick={openModal}
      >
        <CardHeader className={integrationStyles.cardHeader}>
          <div className={integrationStyles.cardHeaderRow}>
            <div className="flex min-w-0 items-center gap-2.5">
              <div className={integrationStyles.mark}>{mark}</div>
              <div className="min-w-0">
                <p className={workspacePageStyles.cardTitle}>
                  {integration.displayName}
                </p>
                <p className={workspacePageStyles.cardLabel}>
                  {integration.category} · {integration.authType}
                </p>
              </div>
            </div>
            {canConnect &&
            integration.id !== "obsidian" &&
            integration.id !== "hevy" &&
            integration.id !== "nutritionix" &&
            integration.id !== "fatsecret" &&
            integration.connectProvider ? (
              <Link
                href={`/api/integrations/connect?provider=${integration.connectProvider}&next=/`}
                onClick={(event) => event.stopPropagation()}
                className={stateClassName}
              >
                {stateLabel}
              </Link>
            ) : (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  openModal();
                }}
                className={stateClassName}
              >
                {stateLabel}
              </button>
            )}
          </div>
        </CardHeader>
        <CardContent className={integrationStyles.body}>
          <p className={workspacePageStyles.cardBodyText}>
            {integration.description}
          </p>
          {integration.capabilities.length > 0 && (
            <div className={integrationStyles.capabilityList}>
              {integration.capabilities.map((capability) => (
                <span key={capability} className={integrationStyles.capability}>
                  {capability}
                </span>
              ))}
            </div>
          )}
          {integration.setupHint && (
            <p className={workspacePageStyles.metricLabel}>
              {integration.setupHint}
            </p>
          )}
        </CardContent>
      </Card>
      <WorkspaceDialog
        open={open}
        onOpenChange={handleOpenChange}
        className={`${workspacePageStyles.dialogContent} ${integrationStyles.dialog}`}
      >
        <DialogHeader className="gap-1">
          <DialogTitle className={integrationStyles.dialogTitle}>
            {integration.displayName}
          </DialogTitle>
          <DialogDescription className={integrationStyles.dialogDescription}>
            {integration.description}
          </DialogDescription>
        </DialogHeader>
        <div className={integrationStyles.dialogBody}>
          <div className={integrationStyles.capabilityList}>
            {integration.capabilities.map((capability) => (
              <span key={capability} className={integrationStyles.capability}>
                {capability}
              </span>
            ))}
          </div>
          <IntegrationSettingsProvider
            value={{
              integration,
              saving,
              settings,
              googleSettings,
              pinterestSettings,
              hevySettings,
              nutritionixSettings,
              fatSecretSettings,
              googleCanStartOAuth,
              pinterestCanStartOAuth,
              googleClientId,
              googleClientSecret,
              pinterestClientId,
              pinterestClientSecret,
              hevyApiKey,
              nutritionixAppId,
              nutritionixApiKey,
              fatSecretClientId,
              fatSecretClientSecret,
              syncResult,
              setGoogleClientId,
              setGoogleClientSecret,
              setPinterestClientId,
              setPinterestClientSecret,
              setHevyApiKey,
              setNutritionixAppId,
              setNutritionixApiKey,
              setFatSecretClientId,
              setFatSecretClientSecret,
              addWorkspaceSourcePath,
              addWorkspaceSource,
              removeWorkspaceSource,
              syncHevy,
            }}
          >
            <Settings />
          </IntegrationSettingsProvider>
        </div>
        <IntegrationDialogActions
          integration={integration}
          canConnect={Boolean(canConnect)}
          saving={saving}
          googleClientId={googleClientId}
          googleClientSecret={googleClientSecret}
          googleCanStartOAuth={googleCanStartOAuth}
          pinterestClientId={pinterestClientId}
          pinterestClientSecret={pinterestClientSecret}
          pinterestCanStartOAuth={pinterestCanStartOAuth}
          hevyApiKey={hevyApiKey}
          nutritionixAppId={nutritionixAppId}
          nutritionixApiKey={nutritionixApiKey}
          fatSecretClientId={fatSecretClientId}
          fatSecretClientSecret={fatSecretClientSecret}
          onDisconnect={disconnect}
          onSaveWorkspaceSource={saveWorkspaceSourceSettings}
          onSaveGoogle={saveGoogleSettings}
          onSavePinterest={savePinterestSettings}
          onSaveHevy={saveHevySettings}
          onSaveNutritionix={saveNutritionixSettings}
          onSaveFatSecret={saveFatSecretSettings}
        />
      </WorkspaceDialog>
    </>
  );
}
