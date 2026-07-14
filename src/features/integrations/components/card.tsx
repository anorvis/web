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
import { useRouter } from "next/navigation";
import { useState } from "react";
import { WorkspaceDialog } from "@/components/layout/workspace-dialog";
import {
  fetchIntegrationSettings,
  postIntegrationAction,
  saveIntegrationSettings,
  startGoogleOAuth,
  startPinterestOAuth,
} from "@/features/integrations/api/integrations";
import { IntegrationSettingsProvider } from "@/features/integrations/components/actions";
import { IntegrationDialogActions } from "@/features/integrations/components/dialog-actions";
import { PROVIDER_MARK } from "@/features/integrations/components/provider-mark";
import { Settings } from "@/features/integrations/components/settings";
import type { IntegrationCatalogEntry } from "@/features/overview/types/overview";
import { convexClient } from "@/lib/convex-client";
import { convexApi } from "@/lib/convex-functions";
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

export type SnapTradeSettings = {
  connected: boolean;
  hasClientId: boolean;
  hasConsumerKey: boolean;
  lastCheckedAt: string | null;
  secretProvider: string | null;
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

function useIntegrationCardController(integration: IntegrationCatalogEntry) {
  const { refresh } = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const settings: WorkspaceSourceSettings | null = null;
  const [googleSettings, setGoogleSettings] = useState<GoogleSettings | null>(
    null,
  );
  const [pinterestSettings, setPinterestSettings] =
    useState<PinterestSettings | null>(null);
  const [hevySettings, setHevySettings] = useState<HevySettings | null>(null);
  const [snapTradeSettings, setSnapTradeSettings] =
    useState<SnapTradeSettings | null>(null);
  const [hevyApiKey, setHevyApiKey] = useState("");
  const [googleClientId, setGoogleClientId] = useState("");
  const [googleClientSecret, setGoogleClientSecret] = useState("");
  const [pinterestClientId, setPinterestClientId] = useState("");
  const [pinterestClientSecret, setPinterestClientSecret] = useState("");
  const [snapTradeClientId, setSnapTradeClientId] = useState("");
  const [snapTradeConsumerKey, setSnapTradeConsumerKey] = useState("");
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const googleCanStartOAuth =
    integration.id === "google" &&
    (googleSettings?.hasClientConfig ||
      integration.setupHint === "Ready to connect through Google OAuth.");
  const pinterestCanStartOAuth =
    integration.id === "pinterest" &&
    (pinterestSettings?.hasClientConfig ||
      integration.setupHint === "Ready to connect through Pinterest OAuth.");

  const loadSettings = () => {
    if (integration.id === "google") void loadGoogleSettings();
    if (integration.id === "pinterest") void loadPinterestSettings();
    if (integration.id === "hevy") void loadHevySettings();
    if (integration.id === "snaptrade") void loadSnapTradeSettings();
  };

  const loadHevySettings = async () => {
    const data = await fetchIntegrationSettings<HevySettings>(
      "/api/integrations/hevy/settings",
    ).catch(() => null);
    if (!data) return;
    setHevySettings(data);
    setHevyApiKey("");
  };

  const loadSnapTradeSettings = async () => {
    const data = await fetchIntegrationSettings<SnapTradeSettings>(
      "/api/integrations/snaptrade/settings",
    ).catch(() => null);
    if (!data) return;
    setSnapTradeSettings(data);
    setSnapTradeClientId("");
    setSnapTradeConsumerKey("");
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
      const data = await startGoogleOAuth({
        clientId: googleClientId,
        clientSecret: googleClientSecret,
      });
      window.location.assign(data.authorizationUrl);
    } finally {
      setSaving(false);
    }
  };

  const savePinterestSettings = async () => {
    setSaving(true);
    try {
      const data = await startPinterestOAuth({
        clientId: pinterestClientId,
        clientSecret: pinterestClientSecret,
      });
      window.location.assign(data.authorizationUrl);
    } finally {
      setSaving(false);
    }
  };

  const saveSnapTradeSettings = async () => {
    setSaving(true);
    try {
      await saveIntegrationSettings<SnapTradeSettings>(
        "/api/integrations/snaptrade/settings",
        {
          clientId: snapTradeClientId,
          consumerKey: snapTradeConsumerKey,
        },
      );
      const portal = (await convexClient.action(
        convexApi.snaptrade.createConnectionPortal,
        { customRedirect: window.location.href },
      )) as { redirectUri: string };
      window.location.assign(portal.redirectUri);
    } finally {
      setSaving(false);
    }
  };

  const addWorkspaceSource = () => {
    throw new Error("Workspace source picker is local-only and disabled");
  };

  const addWorkspaceSourcePath = () => {
    throw new Error("Workspace source links are local-only and disabled");
  };

  const removeWorkspaceSource = () => {
    throw new Error("Workspace source links are local-only and disabled");
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
    snapTradeSettings,
    googleCanStartOAuth,
    pinterestCanStartOAuth,
    googleClientId,
    googleClientSecret,
    pinterestClientId,
    pinterestClientSecret,
    hevyApiKey,
    snapTradeClientId,
    snapTradeConsumerKey,
    syncResult,
    setGoogleClientId,
    setGoogleClientSecret,
    setPinterestClientId,
    setPinterestClientSecret,
    setHevyApiKey,
    setSnapTradeClientId,
    setSnapTradeConsumerKey,
    addWorkspaceSourcePath,
    addWorkspaceSource,
    removeWorkspaceSource,
    syncHevy,
    handleOpenChange,
    openModal,
    saveHevySettings,
    saveGoogleSettings,
    savePinterestSettings,
    saveSnapTradeSettings,
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
    snapTradeSettings,
    googleCanStartOAuth,
    pinterestCanStartOAuth,
    googleClientId,
    googleClientSecret,
    pinterestClientId,
    pinterestClientSecret,
    hevyApiKey,
    snapTradeClientId,
    snapTradeConsumerKey,
    syncResult,
    setGoogleClientId,
    setGoogleClientSecret,
    setPinterestClientId,
    setPinterestClientSecret,
    setHevyApiKey,
    setSnapTradeClientId,
    setSnapTradeConsumerKey,
    addWorkspaceSourcePath,
    addWorkspaceSource,
    removeWorkspaceSource,
    syncHevy,
    handleOpenChange,
    openModal,
    saveHevySettings,
    saveGoogleSettings,
    saveSnapTradeSettings,
    savePinterestSettings,
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
              snapTradeSettings,
              googleCanStartOAuth,
              pinterestCanStartOAuth,
              googleClientId,
              googleClientSecret,
              pinterestClientId,
              pinterestClientSecret,
              hevyApiKey,
              snapTradeClientId,
              snapTradeConsumerKey,
              syncResult,
              setGoogleClientId,
              setGoogleClientSecret,
              setPinterestClientId,
              setPinterestClientSecret,
              setHevyApiKey,
              setSnapTradeClientId,
              setSnapTradeConsumerKey,
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
          saving={saving}
          googleClientId={googleClientId}
          googleClientSecret={googleClientSecret}
          pinterestClientId={pinterestClientId}
          pinterestClientSecret={pinterestClientSecret}
          hevyApiKey={hevyApiKey}
          snapTradeClientId={snapTradeClientId}
          snapTradeConsumerKey={snapTradeConsumerKey}
          onDisconnect={disconnect}
          onSaveGoogle={saveGoogleSettings}
          onSavePinterest={savePinterestSettings}
          onSaveHevy={saveHevySettings}
          onSaveSnapTrade={saveSnapTradeSettings}
        />
      </WorkspaceDialog>
    </>
  );
}
