"use client";

import { Badge } from "@anorvis/ui/badge";
import { Button } from "@anorvis/ui/button";
import { Card, CardContent, CardHeader } from "@anorvis/ui/card";
import { Input } from "@anorvis/ui/input";
import { Spinner } from "@anorvis/ui/spinner";
import { workspacePageStyles } from "@anorvis/ui/styles";
import { useState } from "react";
import {
  runMaintainerPreflight,
  runMaintainerSmoke,
  runMaintainerVaultLogin,
  saveMaintainerCredentials,
  updateMaintainerSettings,
} from "@/features/dev/api/dev";
import {
  type MaintainerStatus,
  PREFLIGHT_PASS_VERDICT,
  type PreflightResult,
  type SmokeResult,
  submitCredentials,
} from "@/features/dev/utils/maintainer";
import { errorMessage } from "@/lib/effect/errors";

const FIELD_LABEL_CLASS =
  "text-[0.55rem] uppercase tracking-[0.25em] text-muted-foreground";
const SECRET_INPUT_CLASS = `${workspacePageStyles.formInput} rounded-none`;
const HELP_TEXT_CLASS = "text-[0.6rem] leading-relaxed text-muted-foreground";
export const maintainerStatusBadgeClass = `${workspacePageStyles.badgeSmall} inline-flex h-5 items-center px-2 py-0 leading-none`;

function CardHeading({ label, title }: { label: string; title: string }) {
  return (
    <CardHeader className={workspacePageStyles.cardHeader}>
      <p className={workspacePageStyles.cardLabel}>{label}</p>
      <h2 className={workspacePageStyles.cardTitle}>{title}</h2>
    </CardHeader>
  );
}

function ConfiguredBadge({
  configured,
  label,
}: {
  configured: boolean;
  label: string;
}) {
  return (
    <Badge
      variant={configured ? "default" : "outline"}
      className={maintainerStatusBadgeClass}
    >
      {configured ? `${label} configured` : `${label} not configured`}
    </Badge>
  );
}

export function ControlsCard({
  status,
  onStatusChanged,
}: {
  status: MaintainerStatus;
  onStatusChanged: () => void;
}) {
  const [toggleBusy, setToggleBusy] = useState(false);
  const [toggleError, setToggleError] = useState<string | null>(null);
  const [preflightBusy, setPreflightBusy] = useState(false);
  const [preflight, setPreflight] = useState<PreflightResult | null>(null);
  const [preflightError, setPreflightError] = useState<string | null>(null);
  const [smokeBusy, setSmokeBusy] = useState(false);
  const [smoke, setSmoke] = useState<SmokeResult | null>(null);
  const [smokeError, setSmokeError] = useState<string | null>(null);

  const toggle = async () => {
    setToggleBusy(true);
    setToggleError(null);
    try {
      await updateMaintainerSettings(!status.enabled);
      onStatusChanged();
    } catch (error) {
      setToggleError(errorMessage(error));
    } finally {
      setToggleBusy(false);
    }
  };

  const verifyPush = async () => {
    setPreflightBusy(true);
    setPreflightError(null);
    try {
      setPreflight(await runMaintainerPreflight());
    } catch (error) {
      setPreflight(null);
      setPreflightError(errorMessage(error));
    } finally {
      setPreflightBusy(false);
    }
  };

  const runSmoke = async () => {
    setSmokeBusy(true);
    setSmokeError(null);
    try {
      setSmoke(await runMaintainerSmoke());
    } catch (error) {
      setSmoke(null);
      setSmokeError(errorMessage(error));
    } finally {
      setSmokeBusy(false);
    }
  };

  return (
    <Card className={workspacePageStyles.card}>
      <CardHeading label="// controls" title="maintainer settings" />
      <CardContent className="space-y-4 px-5 py-4">
        <section
          className="flex flex-col gap-3 border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
          aria-label="maintainer runtime status"
        >
          <div className="flex min-w-0 items-center gap-3">
            <Badge
              variant={status.enabled ? "default" : "outline"}
              className={maintainerStatusBadgeClass}
            >
              {status.enabled ? "enabled" : "disabled"}
            </Badge>
            <div className="min-w-0 space-y-1">
              <h3 className={workspacePageStyles.listLabel}>
                maintainer runtime
              </h3>
              <p className={HELP_TEXT_CLASS}>
                {status.enabled
                  ? "Accepting approved owner tickets."
                  : "Paused until it is enabled by the owner."}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={workspacePageStyles.actionButton}
              disabled={toggleBusy}
              onClick={() => void toggle()}
            >
              {status.enabled ? "disable maintainer" : "enable maintainer"}
            </Button>
            {toggleBusy ? <Spinner className="size-3" /> : null}
          </div>
        </section>
        {toggleError ? (
          <p className={workspacePageStyles.errorText}>{toggleError}</p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={workspacePageStyles.actionButton}
            disabled={preflightBusy}
            onClick={() => void verifyPush()}
          >
            {preflightBusy ? "verifying…" : "verify push access"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={workspacePageStyles.actionButton}
            disabled={smokeBusy}
            onClick={() => void runSmoke()}
          >
            {smokeBusy ? "smoke running (up to 4 min)…" : "run sandbox smoke"}
          </Button>
          {preflightBusy || smokeBusy ? <Spinner className="size-3" /> : null}
        </div>

        {preflightError ? (
          <p className={workspacePageStyles.errorText}>{preflightError}</p>
        ) : null}
        {preflight ? (
          <section className="space-y-2" aria-label="push access verdicts">
            <div className="flex items-center gap-2">
              <Badge
                variant={preflight.ok ? "default" : "destructive"}
                className={maintainerStatusBadgeClass}
              >
                {preflight.ok ? "push access verified" : "push access missing"}
              </Badge>
            </div>
            <ul className={workspacePageStyles.list}>
              {preflight.repos.map((entry) => (
                <li key={entry.repo} className={workspacePageStyles.listRow}>
                  <span className="text-[0.65rem] text-foreground">
                    {entry.repo}
                  </span>
                  <Badge
                    variant={
                      entry.verdict === PREFLIGHT_PASS_VERDICT
                        ? "default"
                        : "destructive"
                    }
                    className={maintainerStatusBadgeClass}
                  >
                    {entry.verdict}
                  </Badge>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {smokeError ? (
          <p className={workspacePageStyles.errorText}>{smokeError}</p>
        ) : null}
        {smoke ? (
          <section className="space-y-2" aria-label="sandbox smoke result">
            <Badge
              variant={smoke.ok ? "default" : "destructive"}
              className={maintainerStatusBadgeClass}
            >
              {smoke.ok ? "smoke passed" : "smoke failed"}
            </Badge>
            {smoke.output ? (
              <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap border border-border p-3 font-mono text-[0.6rem] leading-relaxed text-muted-foreground">
                {smoke.output}
              </pre>
            ) : null}
          </section>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function ModelAuthCard({
  status,
  onVaultLoginStarted,
}: {
  status: MaintainerStatus;
  onVaultLoginStarted: () => void;
}) {
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginStarted, setLoginStarted] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const vaultConfigured = status.modelAuth.vault;
  const waitingForVault = loginStarted && !vaultConfigured;

  const signIn = async () => {
    setLoginBusy(true);
    setLoginError(null);
    try {
      const result = await runMaintainerVaultLogin();
      if (result.ok) {
        setLoginStarted(true);
        onVaultLoginStarted();
      } else {
        setLoginError(
          result.error ?? "the sandbox sign-in could not be started.",
        );
      }
    } catch (error) {
      setLoginError(errorMessage(error));
    } finally {
      setLoginBusy(false);
    }
  };

  const copyCommand = () => {
    if (!status.vaultSetupCommand) return;
    void navigator.clipboard.writeText(status.vaultSetupCommand);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2_000);
  };

  return (
    <Card className={workspacePageStyles.card}>
      <CardHeading label="// model auth" title="sandbox sign-in" />
      <CardContent className="space-y-4 px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <ConfiguredBadge configured={vaultConfigured} label="vault" />
          {waitingForVault ? (
            <span className="inline-flex items-center gap-2 text-[0.6rem] text-muted-foreground">
              <Spinner className="size-3" />
              waiting for sign-in to finish…
            </span>
          ) : null}
        </div>
        <p className={HELP_TEXT_CLASS}>
          The maintainer uses your subscription through a dedicated sandbox
          vault, separate from this machine&apos;s agent credentials. Signing in
          opens a one-time flow in your terminal.
        </p>
        <Button
          type="button"
          size="sm"
          className="rounded-none text-[0.6rem] uppercase tracking-[0.3em]"
          disabled={loginBusy}
          onClick={() => void signIn()}
        >
          {loginBusy ? "opening sign-in…" : "sign in sandbox vault"}
        </Button>
        {loginError ? (
          <p className={workspacePageStyles.errorText}>{loginError}</p>
        ) : null}

        {status.vaultSetupCommand ? (
          <details className="group border-t border-border pt-3">
            <summary
              className={`${FIELD_LABEL_CLASS} cursor-pointer list-none transition hover:text-foreground`}
            >
              <span className="group-open:hidden">+ terminal fallback</span>
              <span className="hidden group-open:inline">
                - terminal fallback
              </span>
            </summary>
            <div className="mt-2 flex items-start gap-2">
              <pre className="min-w-0 flex-1 overflow-x-auto whitespace-pre border border-border p-3 font-mono text-[0.6rem] text-foreground">
                {status.vaultSetupCommand}
              </pre>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={workspacePageStyles.actionButton}
                onClick={copyCommand}
              >
                {copied ? "copied" : "copy"}
              </Button>
            </div>
          </details>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function GithubTokenCard({
  status,
  onStatusChanged,
}: {
  status: MaintainerStatus;
  onStatusChanged: () => void;
}) {
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    const result = await submitCredentials(
      { githubToken: token },
      saveMaintainerCredentials,
    );
    setBusy(false);
    setToken(result.input.githubToken);
    setError(result.error);
    if (result.saved) {
      setNotice("token stored. values are never shown again.");
      onStatusChanged();
    }
  };

  return (
    <Card className={workspacePageStyles.card}>
      <CardHeading label="// github" title="bot access" />
      <CardContent className="space-y-3 px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <ConfiguredBadge configured={status.githubToken} label="token" />
          <ConfiguredBadge
            configured={status.botBrowserSession}
            label="browser session"
          />
        </div>
        <p className={HELP_TEXT_CLASS}>
          The token is stored write-only in the sandbox env on this machine and
          is used to open pull requests as the bot account.
        </p>
        <label
          htmlFor="maintainer-github-token"
          className={workspacePageStyles.formLabel}
        >
          <span className={FIELD_LABEL_CLASS}>github token (write-only)</span>
          <Input
            id="maintainer-github-token"
            type="password"
            autoComplete="off"
            placeholder="stored on this machine, never displayed"
            className={SECRET_INPUT_CLASS}
            value={token}
            onChange={(event) => setToken(event.target.value)}
          />
        </label>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={workspacePageStyles.actionButton}
            disabled={busy}
            onClick={() => void save()}
          >
            {busy ? "saving…" : "save token"}
          </Button>
          {notice ? (
            <span className="text-[0.6rem] text-muted-foreground">
              {notice}
            </span>
          ) : null}
        </div>
        {error ? (
          <p className={workspacePageStyles.errorText}>{error}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
