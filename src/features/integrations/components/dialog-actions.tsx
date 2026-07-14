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
          connected={integration.status === "connected"}
          providerName="google"
          onSave={onSaveGoogle}
        />
      ) : integration.id === "pinterest" ? (
        <OAuthActions
          saving={saving}
          clientId={pinterestClientId}
          clientSecret={pinterestClientSecret}
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
  connected,
  onSave,
  providerName,
}: {
  saving: boolean;
  clientId: string;
  clientSecret: string;
  connected: boolean;
  providerName: string;
  onSave: () => void;
}) {
  return (
    <ActionButton
      disabled={saving || !clientId.trim() || !clientSecret.trim()}
      onClick={onSave}
    >
      {connected ? "save oauth client" : `connect ${providerName}`}
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
