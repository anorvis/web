"use client";

import { Alert, AlertDescription, AlertTitle } from "@anorvis/ui/alert";
import { Badge } from "@anorvis/ui/badge";
import { Button } from "@anorvis/ui/button";
import { Skeleton } from "@anorvis/ui/skeleton";
import { workspacePageStyles } from "@anorvis/ui/styles";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useState } from "react";
import {
  WorkspaceDialog,
  WorkspaceModalFrame,
} from "@/components/layout/workspace-dialog";
import { fetchMaintainerStatus } from "@/features/dev/api/dev";
import {
  ControlsCard,
  GithubTokenCard,
  ModelAuthCard,
  maintainerStatusBadgeClass,
} from "@/features/dev/components/maintainer-actions";
import { MaintainerTicketsSection } from "@/features/dev/components/maintainer-tickets";
import {
  DetailCard,
  devModalClass,
  Metric,
} from "@/features/dev/components/panels";
import {
  hasModelAuth,
  type MaintainerCheck,
  type MaintainerStatus,
  maintainerChecks,
} from "@/features/dev/utils/maintainer";
import { queryKeys } from "@/lib/query/keys";

const LOADING_METRIC_KEYS = [
  "maintainer",
  "model",
  "checks",
  "model-auth",
  "github",
] as const;

function ChecklistRow({ check }: { check: MaintainerCheck }) {
  return (
    <li className="space-y-1 border-b border-border/50 pb-3 last:border-b-0 last:pb-0">
      <div className="flex items-center justify-between gap-3">
        <span className={workspacePageStyles.listLabel}>{check.label}</span>
        <Badge
          variant={check.ok ? "default" : "destructive"}
          className={maintainerStatusBadgeClass}
        >
          {check.ok ? "pass" : "fail"}
        </Badge>
      </div>
      {check.detail ? (
        <p className="break-all text-[0.6rem] text-muted-foreground">
          {check.detail}
        </p>
      ) : null}
      {!check.ok ? (
        <p className="text-[0.6rem] leading-relaxed text-muted-foreground">
          {check.hint}
        </p>
      ) : null}
    </li>
  );
}

export function MaintainerPanelView({
  status,
  loading = false,
  error = null,
  onRetry,
  controls = null,
  authentication = null,
  tickets = null,
}: {
  status: MaintainerStatus | null;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  controls?: ReactNode;
  authentication?: ReactNode;
  tickets?: ReactNode;
}) {
  // The owner reads this tab top-down: what the maintainer is working on
  // first, setup and configuration below.
  return (
    <section className="space-y-4" aria-label="maintainer tickets and setup">
      {tickets}
      <MaintainerSetup
        status={status}
        loading={loading}
        error={error}
        onRetry={onRetry}
        controls={controls}
        authentication={authentication}
      />
    </section>
  );
}

function MaintainerSetup({
  status,
  loading,
  error,
  onRetry,
  controls,
  authentication,
}: {
  status: MaintainerStatus | null;
  loading: boolean;
  error: string | null;
  onRetry?: () => void;
  controls: ReactNode;
  authentication: ReactNode;
}) {
  const [checklistOpen, setChecklistOpen] = useState(false);
  if (loading) {
    return (
      <output
        className="block space-y-4"
        aria-busy="true"
        aria-label="Loading maintainer status"
      >
        <div className={workspacePageStyles.metricsStrip}>
          {LOADING_METRIC_KEYS.map((key) => (
            <Skeleton key={key} className="h-14 rounded-none" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-none" />
      </output>
    );
  }

  if (error || !status) {
    return (
      <Alert variant="destructive" className="rounded-none">
        <AlertTitle>Maintainer status unavailable</AlertTitle>
        <AlertDescription>
          <p>
            The local Anorvis OS gateway could not be reached. Maintainer
            configuration never leaves this machine.
          </p>
          {onRetry ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={workspacePageStyles.actionButton}
              onClick={onRetry}
            >
              retry
            </Button>
          ) : null}
        </AlertDescription>
      </Alert>
    );
  }

  const checks = maintainerChecks(status);
  const passed = checks.filter((check) => check.ok).length;

  return (
    <section className="space-y-4" aria-label="maintainer setup">
      <div className={workspacePageStyles.metricsStrip}>
        <Metric
          label="maintainer"
          value={status.enabled ? "enabled" : "disabled"}
        />
        <Metric label="model" value={status.maintainerModel ?? "default"} />
        <Metric label="checks" value={`${passed}/${checks.length}`} />
        <Metric
          label="model auth"
          value={hasModelAuth(status) ? "ready" : "missing"}
        />
        <Metric
          label="github"
          value={status.githubToken ? "ready" : "missing"}
        />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <div className="grid gap-4">
          <DetailCard
            label="// readiness"
            title={`setup checklist · ${passed}/${checks.length}`}
            onOpen={() => setChecklistOpen(true)}
          >
            <ul className={workspacePageStyles.list}>
              {checks.map((check) => (
                <ChecklistRow key={check.key} check={check} />
              ))}
            </ul>
          </DetailCard>
          {controls}
        </div>
        <div className="grid gap-4">{authentication}</div>
      </div>

      <WorkspaceDialog
        open={checklistOpen}
        onOpenChange={setChecklistOpen}
        className={devModalClass}
      >
        <WorkspaceModalFrame
          title="maintainer setup checklist"
          description="Full readiness detail for the local maintainer sandbox and bot credentials."
        >
          <div className="space-y-4 py-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <Metric label="passed" value={String(passed)} />
              <Metric label="failed" value={String(checks.length - passed)} />
              <Metric label="total" value={String(checks.length)} />
            </div>
            <ul className={workspacePageStyles.list}>
              {checks.map((check) => (
                <li
                  key={check.key}
                  className="space-y-2 border-b border-border pb-4 last:border-b-0"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className={workspacePageStyles.listLabel}>
                      {check.label}
                    </span>
                    <Badge
                      variant={check.ok ? "default" : "destructive"}
                      className={maintainerStatusBadgeClass}
                    >
                      {check.ok ? "pass" : "fail"}
                    </Badge>
                  </div>
                  {check.detail ? (
                    <p className={workspacePageStyles.resourceText}>
                      {check.detail}
                    </p>
                  ) : null}
                  <p className={workspacePageStyles.cardBodyText}>
                    {check.hint}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </WorkspaceModalFrame>
      </WorkspaceDialog>
    </section>
  );
}

export function MaintainerPanel() {
  const queryClient = useQueryClient();
  const [vaultPolling, setVaultPolling] = useState(false);
  const statusQuery = useQuery({
    queryKey: queryKeys.dev.maintainerStatus(),
    queryFn: fetchMaintainerStatus,
    refetchInterval: (query) =>
      vaultPolling && query.state.data?.modelAuth.vault !== true
        ? 5_000
        : 15_000,
  });
  const status = statusQuery.data ?? null;
  const refreshStatus = () =>
    void queryClient.invalidateQueries({
      queryKey: queryKeys.dev.maintainerStatus(),
    });

  return (
    <MaintainerPanelView
      status={status}
      loading={statusQuery.isLoading}
      error={
        statusQuery.error instanceof Error ? statusQuery.error.message : null
      }
      controls={
        status ? (
          <ControlsCard status={status} onStatusChanged={refreshStatus} />
        ) : null
      }
      authentication={
        status ? (
          <>
            <ModelAuthCard
              status={status}
              onVaultLoginStarted={() => setVaultPolling(true)}
            />
            <GithubTokenCard status={status} onStatusChanged={refreshStatus} />
          </>
        ) : null
      }
      tickets={<MaintainerTicketsSection />}
    />
  );
}
