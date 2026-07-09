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
import { type ReactNode, useState } from "react";
import { WorkspaceCard } from "@/components/layout/workspace";
import {
  WorkspaceDialog,
  workspaceModalFooterClass,
} from "@/components/layout/workspace-dialog";

export function Metric({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="border border-border p-3">
      <p className="text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-lg leading-none tracking-[0.04em] text-foreground">
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

type SourceStep = {
  title: string;
  body: string;
  href?: string;
  hrefLabel?: string;
};

function SourceStepBlock({ step, index }: { step: SourceStep; index: number }) {
  return (
    <details className="group border border-border bg-background/40">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-3 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="block text-[0.56rem] uppercase tracking-[0.22em] text-muted-foreground">
            step {index + 1}
          </span>
          <span className="mt-1 block truncate text-[0.72rem] text-foreground">
            {step.title}
          </span>
        </span>
        <span className="shrink-0 text-[0.6rem] text-muted-foreground group-open:rotate-180">
          ▾
        </span>
      </summary>
      <div className="border-t border-border px-3 pt-2 pb-3">
        <p className="text-[0.65rem] leading-relaxed text-muted-foreground">
          {step.body}
        </p>
        {step.href && (
          <a
            className="mt-2 inline-block break-all text-[0.62rem] uppercase tracking-[0.14em] text-foreground underline decoration-border underline-offset-4 hover:text-muted-foreground"
            href={step.href}
            target="_blank"
            rel="noreferrer"
          >
            {step.hrefLabel ?? step.href}
          </a>
        )}
      </div>
    </details>
  );
}

export function AddSourceButton({ domain }: { domain: SourceDomain }) {
  const [open, setOpen] = useState(false);
  const sources = sourceOptions[domain];
  const [configuringGoogle, setConfiguringGoogle] = useState(false);
  const [googleClientId, setGoogleClientId] = useState("");
  const [googleClientSecret, setGoogleClientSecret] = useState("");
  const [googleCanConnect, setGoogleCanConnect] = useState(false);
  const [googleSaving, setGoogleSaving] = useState(false);
  const [googleMessage, setGoogleMessage] = useState<string | null>(null);

  if (sources.length === 0) return null;

  const openGoogleSetup = async () => {
    setConfiguringGoogle(true);
    setGoogleMessage(null);
    const settings = (await fetch("/api/integrations/google/settings")
      .then((response) => (response.ok ? response.json() : null))
      .catch(() => null)) as { hasClientConfig?: boolean } | null;
    setGoogleCanConnect(Boolean(settings?.hasClientConfig));
    setGoogleClientId("");
    setGoogleClientSecret("");
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

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="h-7 rounded-none px-2 text-[0.6rem] hover:border-foreground hover:bg-foreground hover:text-background"
        onClick={() => setOpen(true)}
      >
        add source
      </Button>
      <WorkspaceDialog open={open} onOpenChange={setOpen}>
        <DialogHeader>
          <DialogTitle className="text-sm">add source</DialogTitle>
          <DialogDescription className="text-xs">
            configure external services that need keys, OAuth, or an account
            connection
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4 space-y-2">
          {sources.map((source) => (
            <div
              key={source.label}
              className="space-y-2 border border-border p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-foreground">{source.label}</p>
                  {source.description && (
                    <p className="text-[0.7rem] text-muted-foreground">
                      {source.description}
                    </p>
                  )}
                </div>
                {source.label === "google calendar" ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 shrink-0 rounded-none px-2 text-[0.6rem] hover:border-foreground hover:bg-foreground hover:text-background"
                    onClick={openGoogleSetup}
                  >
                    configure
                  </Button>
                ) : (
                  <SourceButton href={source.href}>
                    {source.action}
                  </SourceButton>
                )}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {source.steps.map((step, index) => (
                  <SourceStepBlock
                    key={`${source.label}-${step.title}`}
                    step={step}
                    index={index}
                  />
                ))}
              </div>
            </div>
          ))}
          {configuringGoogle && (
            <form
              className="mt-4 flex min-h-0 flex-1 flex-col space-y-3 border border-border p-3"
              onSubmit={(event) => {
                event.preventDefault();
                void saveGoogleSetup();
              }}
            >
              <div>
                <p className={workspacePageStyles.cardLabel}>
                  {"// google calendar oauth"}
                </p>
                <p className={workspacePageStyles.cardBodyText}>
                  Create a Google OAuth web client, whitelist the anorvis-os
                  callback URL, paste the client ID/secret here, then sign in.
                </p>
                <div className="mt-3 grid gap-2">
                  {googleSetupSteps.map((step, index) => (
                    <SourceStepBlock
                      key={`google-config-${step.title}`}
                      step={step}
                      index={index}
                    />
                  ))}
                </div>
              </div>
              <input
                className={`w-full ${workspacePageStyles.inlineInput}`}
                value={googleClientId}
                onChange={(event) => setGoogleClientId(event.target.value)}
                placeholder={googleCanConnect ? "client id saved" : "client id"}
              />
              <input
                className={`w-full ${workspacePageStyles.inlineInput}`}
                type="password"
                value={googleClientSecret}
                onChange={(event) => setGoogleClientSecret(event.target.value)}
                placeholder={
                  googleCanConnect ? "client secret saved" : "client secret"
                }
              />
              {googleMessage && (
                <p className={workspacePageStyles.cardBodyText}>
                  {googleMessage}
                </p>
              )}
              <DialogFooter className={workspaceModalFooterClass}>
                <button
                  type="button"
                  className={workspacePageStyles.modalButton}
                  onClick={() => setConfiguringGoogle(false)}
                >
                  back
                </button>
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
      href: "/integrations",
      action: "open integrations",
      steps: [
        {
          title: "Open Hevy API settings",
          body: "Go to Hevy settings and create or copy your API key.",
          href: "https://hevy.com/settings",
          hrefLabel: "open Hevy settings",
        },
        {
          title: "Save the token",
          body: "Open the integrations page, choose Hevy, and paste the API key.",
          href: "/integrations",
          hrefLabel: "open integrations",
        },
        {
          title: "Run sync",
          body: "Run sync; workouts will appear as native health records.",
        },
      ],
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
  finance: [],
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
