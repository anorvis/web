import { Button } from "@anorvis/ui/button";
import { workspacePageStyles } from "@anorvis/ui/styles";
import { useIntegrationSettings } from "@/features/integrations/components/actions";

type SettingsProps = ReturnType<typeof useIntegrationSettings>;

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
          description="Enter your Pinterest OAuth client ID and client secret. Anorvis stores them through the OS secrets manager, then uses OAuth to read boards and Pin images for Life moodboards."
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
    case "nutritionix":
      return <NutritionixSettings {...props} />;
    case "fatsecret":
      return <FatSecretSettings {...props} />;
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
    <div className={workspacePageStyles.settingsPanel}>
      <p className={workspacePageStyles.cardLabel}>{"// oauth client"}</p>
      <p className={workspacePageStyles.cardBodyText}>{description}</p>
      <label className={workspacePageStyles.formLabel}>
        <span className={workspacePageStyles.metricLabel}>client id</span>
        <input
          value={clientId}
          onChange={(event) => onClientIdChange(event.target.value)}
          placeholder={hasClientId ? "saved client id" : "client id"}
          className={workspacePageStyles.formInput}
          aria-label={`${id} client id`}
        />
      </label>
      <label className={workspacePageStyles.formLabel}>
        <span className={workspacePageStyles.metricLabel}>client secret</span>
        <input
          type="password"
          value={clientSecret}
          onChange={(event) => onClientSecretChange(event.target.value)}
          placeholder={
            hasClientSecret ? "saved client secret" : "client secret"
          }
          className={workspacePageStyles.formInput}
          aria-label={`${id} client secret`}
        />
      </label>
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
    <div className={workspacePageStyles.settingsPanel}>
      <div>
        <p className={workspacePageStyles.cardLabel}>{"// hevy api key"}</p>
        <p className={workspacePageStyles.cardBodyText}>
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
            sync workouts
          </Button>
        </>
      ) : null}
      {props.syncResult ? (
        <p className={workspacePageStyles.metricLabel}>{props.syncResult}</p>
      ) : null}
    </div>
  );
}

function NutritionixSettings(props: SettingsProps) {
  return (
    <CredentialSettings
      title="// nutritionix credentials"
      description="Enter your Nutritionix app ID and API key. Anorvis stores them through the OS secrets manager for food search."
      fields={[
        {
          label: "app id",
          value: props.nutritionixAppId,
          onChange: props.setNutritionixAppId,
          placeholder: props.nutritionixSettings?.hasAppId
            ? "saved app id"
            : "app id",
          ariaLabel: "nutritionix app id",
        },
        {
          label: "api key",
          type: "password",
          value: props.nutritionixApiKey,
          onChange: props.setNutritionixApiKey,
          placeholder: props.nutritionixSettings?.hasApiKey
            ? "saved api key"
            : "api key",
          ariaLabel: "nutritionix api key",
        },
      ]}
      connected={props.nutritionixSettings?.connected}
      lastCheckedAt={props.nutritionixSettings?.lastCheckedAt}
    />
  );
}

function FatSecretSettings(props: SettingsProps) {
  return (
    <CredentialSettings
      title="// fatsecret credentials"
      description="Enter your FatSecret client ID and client secret. Anorvis stores them through the OS secrets manager for food search."
      fields={[
        {
          label: "client id",
          value: props.fatSecretClientId,
          onChange: props.setFatSecretClientId,
          placeholder: props.fatSecretSettings?.hasClientId
            ? "saved client id"
            : "client id",
          ariaLabel: "fatsecret client id",
        },
        {
          label: "client secret",
          type: "password",
          value: props.fatSecretClientSecret,
          onChange: props.setFatSecretClientSecret,
          placeholder: props.fatSecretSettings?.hasClientSecret
            ? "saved client secret"
            : "client secret",
          ariaLabel: "fatsecret client secret",
        },
      ]}
      connected={props.fatSecretSettings?.connected}
      lastCheckedAt={props.fatSecretSettings?.lastCheckedAt}
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
    <div className={workspacePageStyles.settingsPanel}>
      <div>
        <p className={workspacePageStyles.cardLabel}>{title}</p>
        <p className={workspacePageStyles.cardBodyText}>{description}</p>
      </div>
      {fields.map((field) => (
        <SecretInput key={field.ariaLabel} {...field} />
      ))}
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
    <label className={workspacePageStyles.formLabel}>
      <span className={workspacePageStyles.metricLabel}>{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={workspacePageStyles.formInput}
        aria-label={ariaLabel}
      />
    </label>
  );
}
