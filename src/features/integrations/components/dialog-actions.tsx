import { Button } from "@anorvis/ui/button";
import { integrationStyles, workspacePageStyles } from "@anorvis/ui/styles";

type DialogIntegration = {
  id: string;
  status: string;
  connectProvider?: string | null;
};

export function IntegrationDialogActions({
  integration,
  saving,
  googleClientId,
  googleClientSecret,
  googleCanStartOAuth,
  pinterestClientId,
  pinterestClientSecret,
  hevyApiKey,
  snapTradeClientId,
  snapTradeConsumerKey,
  onDisconnect,
  onSaveGoogle,
  onSavePinterest,
  onSaveHevy,
  onSaveSnapTrade,
}: {
  integration: DialogIntegration;
  saving: boolean;
  googleClientId: string;
  googleClientSecret: string;
  googleCanStartOAuth: boolean;
  pinterestClientId: string;
  pinterestClientSecret: string;
  hevyApiKey: string;
  snapTradeClientId: string;
  snapTradeConsumerKey: string;
  onDisconnect: () => void;
  onSaveGoogle: () => void;
  onSavePinterest: () => void;
  onSaveHevy: () => void;
  onSaveSnapTrade: () => void;
}) {
  return (
    <div className={integrationStyles.dialogActions}>
      {integration.status === "connected" && (
        <ActionButton disabled={saving} onClick={onDisconnect}>
          disconnect
        </ActionButton>
      )}
      {integration.id === "google" ? (
        <OAuthActions
          saving={saving}
          clientId={googleClientId}
          clientSecret={googleClientSecret}
          canStartOAuth={googleCanStartOAuth}
          connected={integration.status === "connected"}
          reconnect={
            integration.status === "error" && integration.id === "google"
          }
          providerName="google"
          onSave={onSaveGoogle}
        />
      ) : integration.id === "pinterest" ? (
        <OAuthActions
          saving={saving}
          clientId={pinterestClientId}
          clientSecret={pinterestClientSecret}
          canStartOAuth={false}
          reconnect={false}
          connected={integration.status === "connected"}
          providerName="pinterest"
          onSave={onSavePinterest}
        />
      ) : integration.id === "hevy" ? (
        <ActionButton
          disabled={saving || !hevyApiKey.trim()}
          onClick={onSaveHevy}
        >
          {integration.status === "connected" ? "save" : "connect"}
        </ActionButton>
      ) : integration.id === "snaptrade" ? (
        <ActionButton
          disabled={
            saving || !snapTradeClientId.trim() || !snapTradeConsumerKey.trim()
          }
          onClick={onSaveSnapTrade}
        >
          {integration.status === "connected" ? "save" : "connect"}
        </ActionButton>
      ) : null}
    </div>
  );
}

function OAuthActions({
  saving,
  clientId,
  clientSecret,
  canStartOAuth,
  connected,
  reconnect,
  onSave,
  providerName,
}: {
  saving: boolean;
  clientId: string;
  clientSecret: string;
  reconnect: boolean;
  canStartOAuth: boolean;
  connected: boolean;
  providerName: string;
  onSave: () => void;
}) {
  const clientIdTyped = Boolean(clientId.trim());
  const clientSecretTyped = Boolean(clientSecret.trim());
  const keysTyped = clientIdTyped && clientSecretTyped;
  const hasAnyKey = clientIdTyped || clientSecretTyped;
  // Half-typed keys must never silently fall back to stored credentials.
  return (
    <ActionButton
      disabled={saving || (hasAnyKey ? !keysTyped : !canStartOAuth)}
      onClick={onSave}
    >
      {reconnect
        ? `Reconnect ${providerName}`
        : keysTyped
          ? connected
            ? "save oauth client"
            : `connect ${providerName}`
          : `sign in with ${providerName}`}
    </ActionButton>
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
