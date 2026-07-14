import { Button } from "@anorvis/ui/button";
import { workspacePageStyles } from "@anorvis/ui/styles";
import {
  type IntegrationSettingsState,
  useIntegrationSettings,
} from "@/features/integrations/components/actions";

type SettingsProps = IntegrationSettingsState;

const compactSettingsPanel = "space-y-2.5 border border-border p-3";
const compactSettingsCopy =
  "text-[0.62rem] leading-relaxed text-muted-foreground";
const compactFormInput =
  "h-7 w-full rounded-none border border-border bg-transparent px-2 text-[0.6rem] text-foreground placeholder:text-muted-foreground/50 focus:border-foreground focus:outline-none";
const compactFormLabel = "space-y-1";

export function Settings() {
  const props = useIntegrationSettings();

  switch (props.integration.id) {
    case "obsidian":
      return <ObsidianSettings {...props} />;
    case "google":
      return (
        <OAuthSettings
          label="Google"
          description="Enter your Google OAuth client ID and client secret. Anorvis stores them through the OS secrets manager, then uses OAuth to connect Calendar, Gmail, and Drive."
          clientId={props.googleClientId}
          clientSecret={props.googleClientSecret}
          hasClientId={props.googleSettings?.hasClientId}
          hasClientSecret={props.googleSettings?.hasClientSecret}
          canAutoRenew={props.googleSettings?.canAutoRenew}
          canStartOAuth={props.googleCanStartOAuth}
          onClientIdChange={props.setGoogleClientId}
          onClientSecretChange={props.setGoogleClientSecret}
        />
      );
    case "pinterest":
      return (
        <OAuthSettings
          label="Pinterest"
          description="Enter your Pinterest OAuth client ID and client secret. Anorvis stores them encrypted in Convex, then uses OAuth to read boards and Pin images for Life moodboards."
          clientId={props.pinterestClientId}
          clientSecret={props.pinterestClientSecret}
          hasClientId={props.pinterestSettings?.hasClientId}
          hasClientSecret={props.pinterestSettings?.hasClientSecret}
          canAutoRenew={props.pinterestSettings?.canAutoRenew}
          canStartOAuth={props.pinterestCanStartOAuth}
          onClientIdChange={props.setPinterestClientId}
          onClientSecretChange={props.setPinterestClientSecret}
        />
      );
    case "hevy":
      return <HevySettings {...props} />;
    case "snaptrade":
      return <SnapTradeSettings {...props} />;
    default:
      return null;
  }
}

function ObsidianSettings(props: SettingsProps) {
  const { settings, saving } = props;
  return (
    <div className={workspacePageStyles.formGroup}>
      <div className={workspacePageStyles.settingsPanelLarge}>
        <div>
          <p className={workspacePageStyles.cardLabel}>
            {"// detected local folders"}
          </p>
          <p className={workspacePageStyles.metricLabel}>
            Local folders detected by Anorvis. Adding one registers it as an
            explicit workspace source.
          </p>
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          {(settings?.availableVaults ?? []).length === 0 ? (
            <p className={workspacePageStyles.cardBodyText}>
              No local folders detected automatically.
            </p>
          ) : (
            settings?.availableVaults.map((vault) => {
              const isAdded = settings.linkedFolders.some(
                (folder) => folder.sourcePath === vault.path,
              );

              return (
                <div
                  key={vault.path}
                  className={workspacePageStyles.resourceRow}
                >
                  <div className="min-w-0">
                    <p className={workspacePageStyles.cardBodyText}>
                      {vault.name}
                    </p>
                    <p className={workspacePageStyles.resourceText}>
                      {vault.path}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={saving || isAdded}
                    onClick={() => props.addWorkspaceSourcePath(vault.path)}
                    className={workspacePageStyles.actionButton}
                  >
                    {isAdded ? "approved" : "approve"}
                  </Button>
                </div>
              );
            })
          )}
        </div>
      </div>
      <div className={workspacePageStyles.settingsPanelLarge}>
        <div className={workspacePageStyles.sectionHeaderRow}>
          <div>
            <p className={workspacePageStyles.cardLabel}>
              {"// directories with access"}
            </p>
            <p className={workspacePageStyles.metricLabel}>
              Registered in the Anorvis workspace for agents to search.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={saving}
            onClick={props.addWorkspaceSource}
            className={workspacePageStyles.actionButton}
          >
            add folder
          </Button>
        </div>
        <div className="grid gap-2">
          {!settings ? (
            <p className={workspacePageStyles.cardBodyText}>
              Loading workspace sources…
            </p>
          ) : settings.linkedFolders.length === 0 ? (
            <p className={workspacePageStyles.cardBodyText}>
              No folders connected yet.
            </p>
          ) : (
            settings.linkedFolders.map((folder) => (
              <div
                key={folder.sourcePath}
                className={workspacePageStyles.resourceRow}
              >
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <p className={workspacePageStyles.cardBodyText}>
                      {folder.name}
                    </p>
                    <span className={workspacePageStyles.statusPill}>
                      searchable
                    </span>
                  </div>
                  <p className={workspacePageStyles.resourceText}>
                    {folder.sourcePath}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={saving}
                  onClick={() => props.removeWorkspaceSource(folder.sourcePath)}
                  className={workspacePageStyles.actionButton}
                >
                  remove
                </Button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function OAuthSettings({
  label,
  description,
  clientId,
  clientSecret,
  hasClientId,
  hasClientSecret,
  canAutoRenew,
  canStartOAuth,
  onClientIdChange,
  onClientSecretChange,
}: {
  label: string;
  description: string;
  clientId: string;
  clientSecret: string;
  hasClientId?: boolean;
  hasClientSecret?: boolean;
  canAutoRenew?: boolean;
  canStartOAuth: boolean;
  onClientIdChange: (value: string) => void;
  onClientSecretChange: (value: string) => void;
}) {
  const id = label.toLowerCase();
  return (
    <div className={compactSettingsPanel}>
      <p className={workspacePageStyles.cardLabel}>{"// oauth client"}</p>
      <p className={compactSettingsCopy}>{description}</p>
      <div className="grid gap-2 md:grid-cols-2">
        <label className={compactFormLabel}>
          <span className={workspacePageStyles.metricLabel}>client id</span>
          <input
            value={clientId}
            onChange={(event) => onClientIdChange(event.target.value)}
            placeholder={hasClientId ? "saved client id" : "client id"}
            className={compactFormInput}
            aria-label={`${id} client id`}
          />
        </label>
        <label className={compactFormLabel}>
          <span className={workspacePageStyles.metricLabel}>client secret</span>
          <input
            type="password"
            value={clientSecret}
            onChange={(event) => onClientSecretChange(event.target.value)}
            placeholder={
              hasClientSecret ? "saved client secret" : "client secret"
            }
            className={compactFormInput}
            aria-label={`${id} client secret`}
          />
        </label>
      </div>
      {canStartOAuth ? (
        <p className={`${workspacePageStyles.metricLabel} mt-3`}>
          {canAutoRenew
            ? `${label} is connected with token auto-renew enabled.`
            : `OAuth client saved. Connect ${label} next to finish the integration.`}
        </p>
      ) : null}
    </div>
  );
}

function HevySettings(props: SettingsProps) {
  return (
    <div className={compactSettingsPanel}>
      <div>
        <p className={workspacePageStyles.cardLabel}>{"// hevy api key"}</p>
        <p className={compactSettingsCopy}>
          Enter your Hevy API key. Anorvis stores it through the OS secrets
          manager and only keeps a pointer in integration settings.
        </p>
      </div>
      <SecretInput
        label="api key"
        value={props.hevyApiKey}
        onChange={props.setHevyApiKey}
        placeholder={
          props.hevySettings?.hasApiKey ? "saved api key" : "hevy api key"
        }
        ariaLabel="hevy api key"
      />
      {props.hevySettings?.connected ? (
        <>
          <p className={workspacePageStyles.metricLabel}>
            Connected via{" "}
            {props.hevySettings.secretProvider ?? "secret manager"}
            {props.hevySettings.lastCheckedAt
              ? ` · saved ${props.hevySettings.lastCheckedAt}`
              : ""}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={props.saving}
            onClick={props.syncHevy}
            className={workspacePageStyles.actionButton}
          >
            sync workouts + measurements
          </Button>
        </>
      ) : null}
      {props.syncResult ? (
        <p className={workspacePageStyles.metricLabel}>{props.syncResult}</p>
      ) : null}
    </div>
  );
}

function SnapTradeSettings(props: SettingsProps) {
  return (
    <CredentialSettings
      title="// snaptrade credentials"
      description="Enter your SnapTrade client ID and consumer key. Anorvis stores them in Convex, then opens the SnapTrade connection portal."
      fields={[
        {
          label: "client id",
          value: props.snapTradeClientId,
          onChange: props.setSnapTradeClientId,
          placeholder: props.snapTradeSettings?.hasClientId
            ? "saved client id"
            : "client id",
          ariaLabel: "snaptrade client id",
        },
        {
          label: "consumer key",
          type: "password",
          value: props.snapTradeConsumerKey,
          onChange: props.setSnapTradeConsumerKey,
          placeholder: props.snapTradeSettings?.hasConsumerKey
            ? "saved consumer key"
            : "consumer key",
          ariaLabel: "snaptrade consumer key",
        },
      ]}
      connected={props.snapTradeSettings?.connected}
      lastCheckedAt={props.snapTradeSettings?.lastCheckedAt}
    />
  );
}

function CredentialSettings({
  title,
  description,
  fields,
  connected,
  lastCheckedAt,
}: {
  title: string;
  description: string;
  fields: Array<{
    label: string;
    type?: string;
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    ariaLabel: string;
  }>;
  connected?: boolean;
  lastCheckedAt?: string | null;
}) {
  return (
    <div className={compactSettingsPanel}>
      <div>
        <p className={workspacePageStyles.cardLabel}>{title}</p>
        <p className={compactSettingsCopy}>{description}</p>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        {fields.map((field) => (
          <SecretInput key={field.ariaLabel} {...field} />
        ))}
      </div>
      {connected ? (
        <p className={workspacePageStyles.metricLabel}>
          Credentials saved{lastCheckedAt ? ` · saved ${lastCheckedAt}` : ""}
        </p>
      ) : null}
    </div>
  );
}

function SecretInput({
  label,
  type,
  value,
  onChange,
  placeholder,
  ariaLabel,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  ariaLabel: string;
}) {
  return (
    <label className={compactFormLabel}>
      <span className={workspacePageStyles.metricLabel}>{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={compactFormInput}
        aria-label={ariaLabel}
      />
    </label>
  );
}
