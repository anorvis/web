import { Button } from "@anorvis/ui/button";
import { integrationStyles, workspacePageStyles } from "@anorvis/ui/styles";
import { ExternalLink } from "lucide-react";
import Link from "next/link";

type DialogIntegration = {
  id: string;
  status: string;
  connectProvider?: string | null;
};

export function IntegrationDialogActions({
  integration,
  canConnect,
  saving,
  googleClientId,
  googleClientSecret,
  googleCanStartOAuth,
  pinterestClientId,
  pinterestClientSecret,
  pinterestCanStartOAuth,
  hevyApiKey,
  nutritionixAppId,
  nutritionixApiKey,
  fatSecretClientId,
  fatSecretClientSecret,
  onDisconnect,
  onSaveWorkspaceSource,
  onSaveGoogle,
  onSavePinterest,
  onSaveHevy,
  onSaveNutritionix,
  onSaveFatSecret,
}: {
  integration: DialogIntegration;
  canConnect: boolean;
  saving: boolean;
  googleClientId: string;
  googleClientSecret: string;
  googleCanStartOAuth: boolean;
  pinterestClientId: string;
  pinterestClientSecret: string;
  pinterestCanStartOAuth: boolean;
  hevyApiKey: string;
  nutritionixAppId: string;
  nutritionixApiKey: string;
  fatSecretClientId: string;
  fatSecretClientSecret: string;
  onDisconnect: () => void;
  onSaveWorkspaceSource: () => void;
  onSaveGoogle: () => void;
  onSavePinterest: () => void;
  onSaveHevy: () => void;
  onSaveNutritionix: () => void;
  onSaveFatSecret: () => void;
}) {
  return (
    <div className={integrationStyles.dialogActions}>
      {integration.status === "connected" && (
        <ActionButton disabled={saving} onClick={onDisconnect}>
          disconnect
        </ActionButton>
      )}
      {integration.id === "obsidian" ? (
        <ActionButton disabled={saving} onClick={onSaveWorkspaceSource}>
          {integration.status === "connected" ? "save" : "connect"}
        </ActionButton>
      ) : integration.id === "google" ? (
        <OAuthActions
          provider="google"
          saving={saving}
          clientId={googleClientId}
          clientSecret={googleClientSecret}
          canStartOAuth={googleCanStartOAuth}
          connected={integration.status === "connected"}
          onSave={onSaveGoogle}
        />
      ) : integration.id === "pinterest" ? (
        <OAuthActions
          provider="pinterest"
          saving={saving}
          clientId={pinterestClientId}
          clientSecret={pinterestClientSecret}
          canStartOAuth={pinterestCanStartOAuth}
          connected={integration.status === "connected"}
          onSave={onSavePinterest}
        />
      ) : integration.id === "hevy" ? (
        <ActionButton
          disabled={saving || !hevyApiKey.trim()}
          onClick={onSaveHevy}
        >
          {integration.status === "connected" ? "save" : "connect"}
        </ActionButton>
      ) : integration.id === "nutritionix" ? (
        <ActionButton
          disabled={
            saving || !nutritionixAppId.trim() || !nutritionixApiKey.trim()
          }
          onClick={onSaveNutritionix}
        >
          {integration.status === "connected" ? "save" : "connect"}
        </ActionButton>
      ) : integration.id === "fatsecret" ? (
        <ActionButton
          disabled={
            saving || !fatSecretClientId.trim() || !fatSecretClientSecret.trim()
          }
          onClick={onSaveFatSecret}
        >
          {integration.status === "connected" ? "save" : "connect"}
        </ActionButton>
      ) : integration.status !== "connected" && canConnect ? (
        <ConnectLink
          provider={integration.connectProvider ?? ""}
          label="connect"
        />
      ) : null}
    </div>
  );
}

function OAuthActions({
  provider,
  saving,
  clientId,
  clientSecret,
  canStartOAuth,
  connected,
  onSave,
}: {
  provider: "google" | "pinterest";
  saving: boolean;
  clientId: string;
  clientSecret: string;
  canStartOAuth: boolean;
  connected: boolean;
  onSave: () => void;
}) {
  return (
    <>
      <ActionButton
        disabled={saving || !clientId.trim() || !clientSecret.trim()}
        onClick={onSave}
      >
        save oauth client
      </ActionButton>
      {!connected && canStartOAuth ? (
        <ConnectLink provider={provider} label={`connect ${provider}`} />
      ) : null}
    </>
  );
}

function ActionButton({
  disabled,
  onClick,
  children,
}: {
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={disabled}
      onClick={onClick}
      className={workspacePageStyles.actionButton}
    >
      {children}
    </Button>
  );
}

function ConnectLink({ provider, label }: { provider: string; label: string }) {
  return (
    <Button
      variant="outline"
      size="sm"
      asChild
      className={workspacePageStyles.actionButton}
    >
      <Link href={`/api/integrations/connect?provider=${provider}&next=/`}>
        {label}
        <ExternalLink className="size-3" />
      </Link>
    </Button>
  );
}
