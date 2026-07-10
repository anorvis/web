"use client";

import { Badge } from "@anorvis/ui/badge";
import { Button } from "@anorvis/ui/button";
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@anorvis/ui/dialog";
import { workspacePageStyles } from "@anorvis/ui/styles";
import { cn } from "@anorvis/ui/utils";
import { useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { WorkspaceCard } from "@/components/layout/workspace";
import { WorkspaceDialog } from "@/components/layout/workspace-dialog";
import {
  fetchHevySettings,
  type HevySyncSummary,
  saveHevySettings as saveHevyConnectionSettings,
  syncHevy as syncHevyWorkouts,
} from "@/features/health/api/health";
import { clearLifeReadCache } from "@/lib/life-intelligence/life-read-cache";
import { queryKeys } from "@/lib/query/keys";

function hevyMeasurementSummary(summary: HevySyncSummary): string {
  return summary.measurementsFetched === undefined
    ? "body measurements unavailable"
    : `${summary.measurementsFetched} measurements (${summary.measurementsCreated ?? 0} new, ${summary.measurementsUpdated ?? 0} updated)`;
}

export function Metric({
  label,
  value,
  note,
  valueClassName,
}: {
  label: string;
  value: string;
  note?: string;
  valueClassName?: string;
}) {
  return (
    <div className="border border-border p-3">
      <p className="text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 text-lg leading-none tracking-[0.04em] text-foreground",
          valueClassName,
        )}
      >
        {value}
      </p>
      {note && <p className="mt-2 text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}

export function RecordRow({
  label,
  value,
  meta,
  tone,
}: {
  label: string;
  value: string;
  meta?: string;
  tone?: string;
}) {
  return (
    <div className={workspacePageStyles.listRow}>
      <div className="min-w-0">
        <p className="text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground">
          {label}
        </p>
        {meta && (
          <p className="truncate text-[0.7rem] text-muted-foreground">{meta}</p>
        )}
      </div>
      <p
        className={cn(
          "max-w-[55%] text-right text-xs leading-relaxed text-foreground",
          tone,
        )}
      >
        {value}
      </p>
    </div>
  );
}

export function Section({
  label,
  title,
  children,
  className,
  headerExtra,
}: {
  label: string;
  title: string;
  children: ReactNode;
  className?: string;
  headerExtra?: ReactNode;
}) {
  return (
    <WorkspaceCard
      label={label}
      title={title}
      className={className}
      headerExtra={headerExtra}
    >
      {children}
    </WorkspaceCard>
  );
}

export function SourceButton({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Button
      asChild
      size="sm"
      variant="outline"
      className="h-7 rounded-none px-2 text-[0.6rem] hover:border-foreground hover:bg-foreground hover:text-background"
    >
      <a href={href}>{children}</a>
    </Button>
  );
}

export type SourceStep = {
  title: string;
  body: string;
  href?: string;
  hrefLabel?: string;
};

export function SourceStepToggle({
  index,
  active,
  onSelect,
}: {
  index: number;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "grid size-8 place-items-center border text-[0.58rem] transition-colors",
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border/70 bg-background/30 text-muted-foreground hover:border-foreground/60 hover:text-foreground",
      )}
      aria-pressed={active}
      aria-label={`show step ${index + 1}`}
      onClick={onSelect}
    >
      {index + 1}
    </button>
  );
}

export function SourceStepDetail({ step }: { step: SourceStep | null }) {
  return (
    <div className="min-h-24 pt-3">
      {step ? (
        <>
          <p className="text-[0.68rem] text-foreground">{step.title}</p>
          <p className="mt-2 max-w-prose break-words text-[0.64rem] leading-relaxed text-muted-foreground">
            {step.body}
          </p>
          {step.href && (
            <a
              className="mt-2 inline-block break-all text-[0.56rem] uppercase tracking-[0.14em] text-foreground underline decoration-border underline-offset-4 hover:text-muted-foreground"
              href={step.href}
              target="_blank"
              rel="noreferrer"
            >
              {step.hrefLabel ?? step.href}
            </a>
          )}
        </>
      ) : null}
    </div>
  );
}

export function AddSourceButton({ domain }: { domain: SourceDomain }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const sources = sourceOptions[domain];
  const [configuringSourceLabel, setConfiguringSourceLabel] = useState<
    string | null
  >(null);
  const [googleClientId, setGoogleClientId] = useState("");
  const [googleClientSecret, setGoogleClientSecret] = useState("");
  const [googleCanConnect, setGoogleCanConnect] = useState(false);
  const [googleSaving, setGoogleSaving] = useState(false);
  const [googleMessage, setGoogleMessage] = useState<string | null>(null);
  const [hevyApiKey, setHevyApiKey] = useState("");
  const [hevyConnected, setHevyConnected] = useState(false);
  const [hevySaving, setHevySaving] = useState(false);
  const [hevyMessage, setHevyMessage] = useState<string | null>(null);
  const [openStepKey, setOpenStepKey] = useState<string | null>(null);
  const hasGoogleSource = sources.some(
    (source) => source.label === "google calendar",
  );
  const hasHevySource = sources.some((source) => source.label === "hevy");

  const refreshGoogleCredentialState = async () => {
    if (!hasGoogleSource) return;
    const settings = (await fetch("/api/integrations/google/settings")
      .then((response) => (response.ok ? response.json() : null))
      .catch(() => null)) as { hasClientConfig?: boolean } | null;
    setGoogleCanConnect(Boolean(settings?.hasClientConfig));
  };

  const refreshHevyCredentialState = async () => {
    if (!hasHevySource) return;
    const settings = await fetchHevySettings().catch(() => null);
    setHevyConnected(Boolean(settings?.connected || settings?.hasApiKey));
  };

  const openGoogleSetup = async () => {
    setConfiguringSourceLabel("google calendar");
    setOpenStepKey(`google calendar-${googleSetupSteps[0]?.title ?? ""}`);
    setGoogleMessage(null);
    await refreshGoogleCredentialState();
    setGoogleClientId("");
    setGoogleClientSecret("");
  };

  const openHevySetup = async () => {
    setConfiguringSourceLabel("hevy");
    setOpenStepKey(`hevy-${hevySetupSteps[0]?.title ?? ""}`);
    setHevyMessage(null);
    await refreshHevyCredentialState();
    setHevyApiKey("");
  };

  const saveGoogleSetup = async () => {
    setGoogleSaving(true);
    setGoogleMessage(null);
    try {
      const response = await fetch("/api/integrations/google/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: googleClientId,
          clientSecret: googleClientSecret,
        }),
      });
      if (!response.ok) throw new Error(await response.text());
      setGoogleCanConnect(true);
      setGoogleClientId("");
      setGoogleClientSecret("");
      setGoogleMessage(
        "OAuth client saved securely. Continue with Google sign-in.",
      );
    } catch {
      setGoogleMessage("couldn't save Google OAuth client");
    } finally {
      setGoogleSaving(false);
    }
  };

  const saveHevySetup = async () => {
    setHevySaving(true);
    setHevyMessage(null);
    try {
      await saveHevyConnectionSettings(hevyApiKey);
      const syncResult = await syncHevyWorkouts();
      clearLifeReadCache();
      setHevyConnected(true);
      setHevyApiKey("");
      setHevyMessage(
        `API key saved · ${syncResult.fetched} workouts (${syncResult.created} new, ${syncResult.updated} updated) · ${hevyMeasurementSummary(syncResult)}`,
      );
      void queryClient.invalidateQueries({
        queryKey: queryKeys.health.dashboard(),
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.overview() });
      void queryClient.invalidateQueries({ queryKey: ["life"] });
    } catch {
      setHevyMessage("couldn't save or sync Hevy API key");
    } finally {
      setHevySaving(false);
    }
  };

  const syncExistingHevySetup = async () => {
    setHevySaving(true);
    setHevyMessage(null);
    try {
      const syncResult = await syncHevyWorkouts();
      clearLifeReadCache();
      setHevyMessage(
        `synced ${syncResult.fetched} workouts (${syncResult.created} new, ${syncResult.updated} updated) · ${hevyMeasurementSummary(syncResult)}`,
      );
      void queryClient.invalidateQueries({
        queryKey: queryKeys.health.dashboard(),
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.overview() });
      void queryClient.invalidateQueries({ queryKey: ["life"] });
    } catch {
      setHevyMessage("couldn't sync Hevy workouts and measurements");
    } finally {
      setHevySaving(false);
    }
  };

  const configuringSource =
    sources.find((source) => source.label === configuringSourceLabel) ?? null;
  const selectedStep =
    configuringSource?.steps.find(
      (step) => `${configuringSource.label}-${step.title}` === openStepKey,
    ) ?? null;

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="h-7 rounded-none px-2 text-[0.6rem] hover:border-foreground hover:bg-foreground hover:text-background"
        onClick={() => {
          setOpen(true);
          void refreshGoogleCredentialState();
          void refreshHevyCredentialState();
        }}
      >
        add source
      </Button>
      <WorkspaceDialog
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) {
            setConfiguringSourceLabel(null);
            setOpenStepKey(null);
          }
        }}
        className="flex h-[min(520px,88vh)] w-[min(860px,calc(100vw-2rem))] !max-w-none flex-col overflow-hidden p-5"
      >
        <DialogHeader className="shrink-0 gap-1">
          <DialogTitle className="text-sm">add source</DialogTitle>
          <DialogDescription className="max-w-xl text-xs">
            connect one source, then follow only the steps you need
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1 [scrollbar-gutter:stable]">
          {!configuringSource &&
            sources.map((source) => (
              <button
                key={source.label}
                type="button"
                className={cn(
                  "group grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-border/60 px-3 py-4 text-left transition-colors last:border-b-0 hover:border-foreground/40",
                  ((source.label === "google calendar" && googleCanConnect) ||
                    (source.label === "hevy" && hevyConnected)) &&
                    "bg-foreground/[0.03]",
                )}
                onClick={() => {
                  if (source.label === "google calendar") {
                    void openGoogleSetup();
                    return;
                  }
                  if (source.label === "hevy") {
                    void openHevySetup();
                    return;
                  }
                  setConfiguringSourceLabel(source.label);
                  setOpenStepKey(
                    `${source.label}-${source.steps[0]?.title ?? ""}`,
                  );
                }}
              >
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-foreground">
                      {source.label}
                    </span>
                    {source.label === "google calendar" && googleCanConnect && (
                      <span className="border border-foreground/30 px-1.5 py-0.5 text-[0.52rem] uppercase tracking-[0.16em] text-foreground">
                        credentials saved
                      </span>
                    )}
                    {source.label === "hevy" && hevyConnected && (
                      <span className="border border-foreground/30 px-1.5 py-0.5 text-[0.52rem] uppercase tracking-[0.16em] text-foreground">
                        api key saved
                      </span>
                    )}
                  </span>
                  {source.description && (
                    <span className="mt-1 block text-[0.65rem] leading-relaxed text-muted-foreground">
                      {source.description}
                    </span>
                  )}
                </span>
                <span className="text-[0.58rem] uppercase tracking-[0.18em] text-muted-foreground transition-colors group-hover:text-foreground">
                  {(source.label === "google calendar" && googleCanConnect) ||
                  (source.label === "hevy" && hevyConnected)
                    ? "review"
                    : "configure"}
                </span>
              </button>
            ))}
          {configuringSource && (
            <form
              className="grid min-h-full grid-rows-[minmax(0,1fr)_auto] gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                if (configuringSource.label === "google calendar") {
                  void saveGoogleSetup();
                }
                if (configuringSource.label === "hevy") {
                  void saveHevySetup();
                }
              }}
            >
              <div className="grid min-h-0 gap-8 lg:grid-cols-[minmax(16rem,0.82fr)_minmax(0,1fr)]">
                <section className="min-w-0 space-y-3">
                  <div>
                    <p className={workspacePageStyles.cardLabel}>
                      {configuringSource.label === "google calendar" ||
                      configuringSource.label === "hevy"
                        ? "// credentials"
                        : `// ${configuringSource.label}`}
                    </p>
                    <p className="mt-2 max-w-sm text-[0.65rem] leading-relaxed text-muted-foreground">
                      {configuringSource.label === "google calendar"
                        ? googleCanConnect
                          ? "Your Google OAuth client is already saved. Sign in now, or replace the credentials below if you changed the Google Cloud client."
                          : "Create a Google OAuth web client, whitelist the callback URL, then save the client credentials here."
                        : configuringSource.label === "hevy"
                          ? hevyConnected
                            ? "Your Hevy API key is already saved. Leave this blank unless you want to replace it, or paste a new key and sync again."
                            : "Paste your Hevy API key here. Anorvis stores it locally through anorvis-os, then syncs workouts into health."
                          : configuringSource.description}
                    </p>
                  </div>
                  {configuringSource.label === "google calendar" ? (
                    <div className="space-y-2">
                      {googleCanConnect && (
                        <div className="border border-foreground/25 bg-foreground/[0.04] p-3">
                          <p className="text-[0.6rem] uppercase tracking-[0.16em] text-foreground">
                            oauth client saved
                          </p>
                          <p className="mt-1 text-[0.62rem] leading-relaxed text-muted-foreground">
                            Client ID and secret are stored locally. Leave these
                            fields blank unless you want to replace them.
                          </p>
                        </div>
                      )}
                      <input
                        className={`w-full ${workspacePageStyles.inlineInput}`}
                        value={googleClientId}
                        onChange={(event) =>
                          setGoogleClientId(event.target.value)
                        }
                        placeholder={
                          googleCanConnect ? "replace client id" : "client id"
                        }
                      />
                      <input
                        className={`w-full ${workspacePageStyles.inlineInput}`}
                        type="password"
                        value={googleClientSecret}
                        onChange={(event) =>
                          setGoogleClientSecret(event.target.value)
                        }
                        placeholder={
                          googleCanConnect
                            ? "replace client secret"
                            : "client secret"
                        }
                      />
                      {googleMessage && (
                        <p className={workspacePageStyles.cardBodyText}>
                          {googleMessage}
                        </p>
                      )}
                    </div>
                  ) : configuringSource.label === "hevy" ? (
                    <div className="space-y-2">
                      {hevyConnected && (
                        <div className="border border-foreground/25 bg-foreground/[0.04] p-3">
                          <p className="text-[0.6rem] uppercase tracking-[0.16em] text-foreground">
                            hevy api key saved
                          </p>
                          <p className="mt-1 text-[0.62rem] leading-relaxed text-muted-foreground">
                            Workouts can sync from this modal. Leave the field
                            blank unless you want to replace the key.
                          </p>
                        </div>
                      )}
                      <input
                        className={`w-full ${workspacePageStyles.inlineInput}`}
                        type="password"
                        value={hevyApiKey}
                        onChange={(event) => setHevyApiKey(event.target.value)}
                        placeholder={
                          hevyConnected
                            ? "replace hevy api key"
                            : "hevy api key"
                        }
                      />
                      {hevyMessage && (
                        <p className={workspacePageStyles.cardBodyText}>
                          {hevyMessage}
                        </p>
                      )}
                    </div>
                  ) : (
                    <SourceButton href={configuringSource.href}>
                      {configuringSource.action}
                    </SourceButton>
                  )}
                </section>
                <section className="min-w-0 pr-1">
                  <p className={workspacePageStyles.cardLabel}>
                    {"// setup guide"}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {configuringSource.steps.map((step, index) => {
                      const stepKey = `${configuringSource.label}-${step.title}`;
                      return (
                        <SourceStepToggle
                          key={stepKey}
                          index={index}
                          active={openStepKey === stepKey}
                          onSelect={() =>
                            setOpenStepKey((current) =>
                              current === stepKey ? null : stepKey,
                            )
                          }
                        />
                      );
                    })}
                  </div>
                  <SourceStepDetail step={selectedStep} />
                </section>
              </div>
              <DialogFooter className="flex items-center justify-end gap-2 border-t border-border pt-3">
                <button
                  type="button"
                  className={workspacePageStyles.modalButton}
                  onClick={() => {
                    setConfiguringSourceLabel(null);
                    setOpenStepKey(null);
                  }}
                >
                  back
                </button>
                {configuringSource.label === "google calendar" && (
                  <>
                    <button
                      type="submit"
                      className={workspacePageStyles.modalButton}
                      disabled={
                        googleSaving ||
                        !googleClientId.trim() ||
                        !googleClientSecret.trim()
                      }
                    >
                      {googleSaving ? "..." : "save keys"}
                    </button>
                    {googleCanConnect && (
                      <a
                        className={workspacePageStyles.modalButton}
                        href="/api/integrations/connect?provider=google&next=/life"
                      >
                        sign in
                      </a>
                    )}
                  </>
                )}
                {configuringSource.label === "hevy" && (
                  <>
                    <button
                      type="submit"
                      className={workspacePageStyles.modalButton}
                      disabled={hevySaving || !hevyApiKey.trim()}
                    >
                      {hevySaving ? "..." : "save + sync"}
                    </button>
                    {hevyConnected && (
                      <button
                        type="button"
                        className={workspacePageStyles.modalButton}
                        disabled={hevySaving}
                        onClick={() => void syncExistingHevySetup()}
                      >
                        sync workouts + measurements
                      </button>
                    )}
                  </>
                )}
              </DialogFooter>
            </form>
          )}
        </div>
      </WorkspaceDialog>
    </>
  );
}

type SourceDomain = "life" | "health" | "finance";

const GOOGLE_CALENDAR_API_URL =
  "https://console.cloud.google.com/apis/library/calendar-json.googleapis.com";
const GOOGLE_CREDENTIALS_URL =
  "https://console.cloud.google.com/apis/credentials";
const GOOGLE_CALLBACK_URL =
  "http://127.0.0.1:8787/v1/integrations/google/auth/callback";

const googleSetupSteps: SourceStep[] = [
  {
    title: "Enable Calendar API",
    body: "Open Google Cloud Console and enable the Google Calendar API for your project.",
    href: GOOGLE_CALENDAR_API_URL,
    hrefLabel: "open Google Calendar API",
  },
  {
    title: "Create OAuth web client",
    body: "Open Credentials, create an OAuth client ID, and choose Web application.",
    href: GOOGLE_CREDENTIALS_URL,
    hrefLabel: "open Google Credentials",
  },
  {
    title: "Whitelist the gateway callback",
    body: `Add ${GOOGLE_CALLBACK_URL} as an authorized redirect URI. If ANORVIS_OS_URL uses a different gateway origin, keep the same path and replace only the origin.`,
  },
  {
    title: "Save and sign in",
    body: "Paste the client ID and client secret here, save them through anorvis-os, then sign in.",
  },
];

const hevySetupSteps: SourceStep[] = [
  {
    title: "Copy your Hevy API key",
    body: "Open Hevy settings and create or copy your API key.",
    href: "https://hevy.com/settings",
    hrefLabel: "open Hevy settings",
  },
  {
    title: "Paste it here",
    body: "Save the key in this modal. Anorvis stores it through the local OS secret manager.",
  },
  {
    title: "Sync health data",
    body: "After saving, Anorvis syncs workouts and your complete Hevy body-measurement history.",
  },
];

const sourceOptions = {
  life: [
    {
      label: "google calendar",
      description: "",
      href: "/api/integrations/connect?provider=google&next=/life",
      action: "connect",
      steps: googleSetupSteps,
    },
  ],
  health: [
    {
      label: "hevy",
      description: "API-token connection for workout import and sync",
      href: "https://hevy.com/settings",
      action: "open Hevy settings",
      steps: hevySetupSteps,
    },
    {
      label: "fatsecret",
      description: "API credentials for global food search and macro lookup",
      href: "/integrations",
      action: "open integrations",
      steps: [
        {
          title: "Create a FatSecret app",
          body: "Create an API application in the FatSecret Platform dashboard.",
          href: "https://platform.fatsecret.com",
          hrefLabel: "open FatSecret Platform",
        },
        {
          title: "Copy credentials",
          body: "Copy the client ID and client secret.",
        },
        {
          title: "Save credentials",
          body: "Open integrations, choose FatSecret, save credentials, then use food search.",
          href: "/integrations",
          hrefLabel: "open integrations",
        },
      ],
    },
    {
      label: "nutritionix",
      description: "API credentials for branded/common food search",
      href: "/integrations",
      action: "open integrations",
      steps: [
        {
          title: "Create a Nutritionix app",
          body: "Create an app in the Nutritionix developer portal.",
          href: "https://developer.nutritionix.com",
          hrefLabel: "open Nutritionix developer portal",
        },
        {
          title: "Copy credentials",
          body: "Copy the application ID and API key.",
        },
        {
          title: "Save credentials",
          body: "Open integrations, choose Nutritionix, save credentials, then use food search.",
          href: "/integrations",
          hrefLabel: "open integrations",
        },
      ],
    },
  ],
  finance: [
    {
      label: "csv upload",
      description:
        "Import bank or card statements into the canonical Finance store",
      href: "/finance",
      action: "open finance",
      steps: [
        {
          title: "Open Finance",
          body: "Open the Finance workspace and choose Add source.",
          href: "/finance",
          hrefLabel: "open Finance",
        },
        {
          title: "Choose CSV upload",
          body: "Select CSV upload before the file input appears, then choose your statement file.",
        },
        {
          title: "Import records",
          body: "Review the detected mapping and import. Duplicate fingerprints are skipped safely.",
        },
      ],
    },
    {
      label: "snaptrade personal",
      description:
        "Read-only brokerage sync using your own SnapTrade developer keys",
      href: "/finance",
      action: "open finance",
      steps: [
        {
          title: "Open Finance",
          body: "Open the Finance workspace and choose Add source.",
          href: "/finance",
          hrefLabel: "open Finance",
        },
        {
          title: "Choose SnapTrade Personal",
          body: "Select SnapTrade Personal before credential inputs appear.",
        },
        {
          title: "Configure read-only access",
          body: "Save your Personal client ID and consumer key, then open the read-only connection portal.",
        },
      ],
    },
  ],
} as const;

export function StatusBadge({
  children,
  tone,
}: {
  children: ReactNode;
  tone?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(workspacePageStyles.badgeSmall, "rounded-none", tone)}
    >
      {children}
    </Badge>
  );
}
