"use client";

import { Button } from "@anorvis/ui/button";
import { DialogFooter } from "@anorvis/ui/dialog";
import { workspacePageStyles } from "@anorvis/ui/styles";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import {
  Section,
  type SourceStep,
  SourceStepDetail,
  SourceStepToggle,
} from "@/components/life-intelligence/record-ui";
import type {
  FinanceAccountRecord,
  FinanceImportRecord,
  FinanceSourceFreshness,
} from "@/features/finance/api/finance";
import { undoFinanceImport } from "@/features/finance/api/finance";
import {
  disconnectSnapTrade,
  fetchSnapTradeSettings,
  openSnapTradePortal,
  saveSnapTradeSettings,
  syncSnapTrade,
} from "@/features/finance/api/snaptrade";
import {
  FinanceCsvReceipt,
  FinanceCsvSource,
} from "@/features/finance/components/finance-csv-source";
import {
  EmptyState,
  FinanceDialog,
} from "@/features/finance/components/finance-panels";
import { queryKeys } from "@/lib/query/keys";

const SNAPTRADE_SETTINGS_KEY = ["finance", "snaptrade", "settings"] as const;

type FinanceSourceId = "csv" | "snaptrade";

const CSV_SETUP_STEPS: SourceStep[] = [
  {
    title: "Choose a statement",
    body: "Upload a supported bank or card CSV. The file is parsed locally in your browser.",
  },
  {
    title: "Review the mapping",
    body: "Confirm the detected columns, account type, currency, and transaction fields before import.",
  },
  {
    title: "Import canonical records",
    body: "Send normalized records to Convex. Duplicate fingerprints are skipped safely.",
  },
];

const SNAPTRADE_SETUP_STEPS: SourceStep[] = [
  {
    title: "Create Personal credentials",
    body: "Create or copy your SnapTrade Personal client ID and consumer key from your developer dashboard.",
    href: "https://dashboard.snaptrade.com/signup",
    hrefLabel: "open SnapTrade dashboard",
  },
  {
    title: "Save encrypted keys",
    body: "Paste both keys here. Convex encrypts them at rest and never returns them.",
  },
  {
    title: "Connect and sync",
    body: "Connect a brokerage account, then sync accounts, balances, positions, and activities.",
  },
];

function countLabel(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function waitForPortalClose(portalWindow: Window): Promise<boolean> {
  return new Promise((resolve) => {
    let checks = 0;
    const timer = window.setInterval(() => {
      checks += 1;
      if (portalWindow.closed || checks >= 3_600) {
        window.clearInterval(timer);
        resolve(portalWindow.closed);
      }
    }, 500);
  });
}

export function FinanceSources({
  imports,
  sources,
  accounts,
}: {
  imports: FinanceImportRecord[];
  sources: FinanceSourceFreshness[];
  accounts: FinanceAccountRecord[];
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selectedSource, setSelectedSource] = useState<FinanceSourceId | null>(
    null,
  );
  const [selectedStepIndex, setSelectedStepIndex] = useState(0);
  const [clientId, setClientId] = useState("");
  const [consumerKey, setConsumerKey] = useState("");
  const [snapBusy, setSnapBusy] = useState(false);
  const [snapMessage, setSnapMessage] = useState<string | null>(null);
  const [undoingImportId, setUndoingImportId] = useState<string | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [csvFileLoaded, setCsvFileLoaded] = useState(false);

  const settingsQuery = useQuery({
    queryKey: SNAPTRADE_SETTINGS_KEY,
    queryFn: fetchSnapTradeSettings,
    retry: false,
  });
  const settings = settingsQuery.data ?? null;

  const refreshDashboard = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.finance.snapshot(),
    });
    void queryClient.invalidateQueries({
      queryKey: queryKeys.overview(),
    });
  }, [queryClient]);

  const undoImport = useCallback(
    async (record: FinanceImportRecord) => {
      const receiptLabel = record.sourceVariant
        ? `${record.source} · ${record.sourceVariant}`
        : record.source;
      const receiptName = `${receiptLabel} receipt ${record.id}`;
      const transactionCount = countLabel(record.importedCount, "transaction");
      const confirmed = window.confirm(
        `Remove ${transactionCount} from ${receiptName}? Undo removes only transactions from this import. A legacy CSV placeholder account is deleted only when Convex proves it is now an orphan.`,
      );
      if (!confirmed) return;

      setUndoingImportId(record.id);
      setImportMessage(null);
      try {
        const result = await undoFinanceImport(record.id);
        const accountCopy = result.deletedAccountId
          ? `; removed legacy CSV placeholder account ${result.deletedAccountId}`
          : "; account remains";
        setImportMessage(
          `undone · removed ${countLabel(result.deletedTransactions, "transaction")} from ${receiptName}${accountCopy}`,
        );
        refreshDashboard();
      } catch (error) {
        setImportMessage(
          `undo failed — ${error instanceof Error ? error.message : "unknown error"}`,
        );
      } finally {
        setUndoingImportId(null);
      }
    },
    [refreshDashboard],
  );

  const saveCredentials = async () => {
    if (!clientId.trim() || !consumerKey.trim()) return;
    setSnapBusy(true);
    setSnapMessage(null);
    try {
      await saveSnapTradeSettings({
        clientId: clientId.trim(),
        consumerKey: consumerKey.trim(),
      });
      setClientId("");
      setConsumerKey("");
      setSnapMessage(
        "keys encrypted in Convex · open the connection portal to link a brokerage read-only",
      );
      await settingsQuery.refetch();
    } catch (error) {
      setSnapMessage(
        `couldn't save keys — ${error instanceof Error ? error.message : "unknown error"}`,
      );
    } finally {
      setSnapBusy(false);
    }
  };

  const runSync = async () => {
    setSnapBusy(true);
    setSnapMessage(null);
    try {
      const summary = await syncSnapTrade();
      const promotedSpends = summary.transactionsInserted ?? 0;
      setSnapMessage(
        `synced · ${countLabel(summary.accounts, "account")}, ${countLabel(summary.positions, "position")}, ${summary.activities} activities (${summary.activitiesInserted} new, ${summary.activitiesSkipped} skipped) · ${countLabel(promotedSpends, "spend")} · ${summary.historyPoints} history points · ${summary.returnRates} return rates${summary.warnings.length > 0 ? ` · ${summary.warnings.join(" · ")}` : ""}`,
      );
      refreshDashboard();
      await settingsQuery.refetch();
    } catch (error) {
      setSnapMessage(
        `sync failed — ${error instanceof Error ? error.message : "unknown error"}`,
      );
    } finally {
      setSnapBusy(false);
    }
  };

  const openPortal = async () => {
    const portalWindow = window.open("about:blank", "snaptrade-portal");
    if (portalWindow) portalWindow.opener = null;
    setSnapBusy(true);
    setSnapMessage(null);
    try {
      const portal = await openSnapTradePortal();
      if (portalWindow) {
        portalWindow.location.replace(portal.redirectUri);
        setSnapMessage(
          "finish linking in SnapTrade · sync starts when the portal closes",
        );
        void waitForPortalClose(portalWindow).then((closed) => {
          if (closed) void runSync();
        });
      } else {
        window.location.assign(portal.redirectUri);
      }
    } catch (error) {
      portalWindow?.close();
      setSnapMessage(
        `couldn't open the connection portal — ${error instanceof Error ? error.message : "unknown error"}`,
      );
    } finally {
      setSnapBusy(false);
    }
  };

  const disconnect = async () => {
    setSnapBusy(true);
    setSnapMessage(null);
    try {
      await disconnectSnapTrade();
      setSnapMessage(
        "Anorvis credentials cleared. Your SnapTrade account and brokerage connections are untouched.",
      );
      await settingsQuery.refetch();
    } catch (error) {
      setSnapMessage(
        `couldn't disconnect — ${error instanceof Error ? error.message : "unknown error"}`,
      );
    } finally {
      setSnapBusy(false);
    }
  };

  const snaptradeHasKeys = Boolean(
    settings?.hasClientId && settings?.hasConsumerKey,
  );
  const snaptradeHasRecords = sources.some(
    (source) => source.source === "snaptrade" && source.accountCount > 0,
  );
  const recordSources = sources.filter(
    (source) => source.source !== "snaptrade",
  );
  // Distinct labels only: several receipts/rows from the same source (e.g. two
  // "manual" CSV imports) are one connected source, and chip keys must be unique.
  const connectedSources = [
    ...new Set([
      ...(snaptradeHasRecords ? ["snaptrade personal"] : []),
      ...recordSources.map((source) => source.sourceVariant ?? source.source),
    ]),
  ];
  const hasAnySource = connectedSources.length > 0;
  const setupSteps =
    selectedSource === "snaptrade" ? SNAPTRADE_SETUP_STEPS : CSV_SETUP_STEPS;
  const selectedSetupStep = setupSteps[selectedStepIndex] ?? null;
  const sourceGridClass =
    selectedSource === "csv"
      ? csvFileLoaded
        ? "grid gap-8"
        : "grid gap-8 lg:grid-cols-2"
      : "grid gap-8 lg:grid-cols-[minmax(16rem,0.82fr)_minmax(0,1fr)]";

  return (
    <Section
      label="sources"
      title="finance records"
      headerExtra={
        <Button
          size="sm"
          variant="outline"
          className="h-7 rounded-none px-2 text-[0.6rem]"
          onClick={() => {
            setSelectedSource(null);
            setSelectedStepIndex(0);
            setCsvFileLoaded(false);
            setImportMessage(null);
            setOpen(true);
          }}
        >
          add source
        </Button>
      }
    >
      <p className={workspacePageStyles.cardBodyText}>
        Finance records persist in Convex. Import bank or card CSV files, or
        connect SnapTrade (Personal) for read-only brokerage data. Records
        survive reloads and remain grouped by their original currency.
      </p>

      {hasAnySource ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-[0.58rem] uppercase tracking-[0.18em] text-muted-foreground">
            sources
          </span>
          {connectedSources.map((source) => (
            <span
              key={source}
              className="inline-flex items-center gap-1 border border-border px-2 py-1 text-[0.58rem] uppercase tracking-[0.16em] text-foreground"
            >
              <span className="text-emerald-500">●</span>
              {source} connected
            </span>
          ))}
        </div>
      ) : (
        <div className="mt-3">
          <EmptyState
            title="No sources yet."
            body="Use add source to upload a CSV or configure SnapTrade Personal."
          />
        </div>
      )}

      <FinanceDialog
        className="h-auto max-h-[84vh] w-[min(64rem,calc(100vw-2rem))]"
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) {
            setSelectedSource(null);
            setSelectedStepIndex(0);
            setCsvFileLoaded(false);
            setImportMessage(null);
          }
        }}
        title={
          selectedSource === "csv"
            ? "upload csv"
            : selectedSource === "snaptrade"
              ? "configure snaptrade"
              : "add source"
        }
        description={
          selectedSource === "csv"
            ? "Choose a statement file only after selecting CSV as the source. Parsed records persist through Convex."
            : selectedSource === "snaptrade"
              ? "Configure SnapTrade Personal for brokerage sync. Anorvis cannot trade or move money."
              : "Choose one Finance source to configure. Inputs stay hidden until you select a source."
        }
      >
        {!selectedSource ? (
          <div className="space-y-0">
            <button
              type="button"
              className="group grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-border/60 px-3 py-4 text-left transition-colors hover:border-foreground/40"
              onClick={() => {
                setSelectedStepIndex(0);
                setCsvFileLoaded(false);
                setSelectedSource("csv");
              }}
            >
              <span className="min-w-0">
                <span className="text-xs text-foreground">csv upload</span>
                <span className="mt-1 block text-[0.65rem] leading-relaxed text-muted-foreground">
                  Import a bank or card statement into the canonical Finance
                  store. Re-imported rows are skipped by fingerprint.
                </span>
              </span>
              <span className="text-[0.58rem] uppercase tracking-[0.18em] text-muted-foreground transition-colors group-hover:text-foreground">
                upload
              </span>
            </button>
            <button
              type="button"
              className="group grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-border/60 px-3 py-4 text-left transition-colors last:border-b-0 hover:border-foreground/40"
              onClick={() => {
                setSnapMessage(null);
                setSelectedStepIndex(0);
                setCsvFileLoaded(false);
                setSelectedSource("snaptrade");
              }}
            >
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-foreground">
                    snaptrade personal
                  </span>
                  {snaptradeHasKeys ? (
                    <span className="border border-foreground/30 px-1.5 py-0.5 text-[0.52rem] uppercase tracking-[0.16em] text-foreground">
                      keys saved
                    </span>
                  ) : null}
                </span>
                <span className="mt-1 block text-[0.65rem] leading-relaxed text-muted-foreground">
                  Connect brokerage accounts using your own SnapTrade developer
                  keys. Anorvis only reads and stores account data.
                </span>
              </span>
              <span className="text-[0.58rem] uppercase tracking-[0.18em] text-muted-foreground transition-colors group-hover:text-foreground">
                {snaptradeHasKeys ? "review" : "configure"}
              </span>
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            <div className={sourceGridClass}>
              <section className="min-w-0 space-y-6">
                {selectedSource === "csv" ? (
                  <>
                    <div>
                      <p className={workspacePageStyles.cardLabel}>
                        {"// csv upload"}
                      </p>
                      <p className={workspacePageStyles.cardBodyText}>
                        Files are parsed in your browser, then normalized
                        records persist through Convex under the account you
                        explicitly select or create. Legacy CSV placeholder
                        accounts are hidden from this list.
                      </p>
                    </div>
                    <FinanceCsvSource
                      accounts={accounts}
                      onFileLoadedChange={setCsvFileLoaded}
                      onRefreshDashboard={refreshDashboard}
                      onImportMessageChange={setImportMessage}
                    />
                  </>
                ) : (
                  <>
                    <div>
                      <p className={workspacePageStyles.cardLabel}>
                        {"// credentials"}
                      </p>
                      <p className={workspacePageStyles.cardBodyText}>
                        SnapTrade Personal uses your own developer keys. Anorvis
                        requests <strong>read-only</strong> access and can never
                        place trades or move money.
                      </p>
                    </div>

                    {snaptradeHasKeys ? (
                      <div className="border border-foreground/25 bg-foreground/[0.04] p-3">
                        <p className="text-[0.6rem] uppercase tracking-[0.16em] text-foreground">
                          keys saved
                        </p>
                        <p className="mt-1 text-[0.62rem] leading-relaxed text-muted-foreground">
                          Client ID and consumer key are stored locally. Leave
                          these fields blank unless you want to replace them.
                        </p>
                      </div>
                    ) : null}

                    <div className="space-y-2">
                      <input
                        className={`w-full ${workspacePageStyles.inlineInput}`}
                        value={clientId}
                        onChange={(event) => setClientId(event.target.value)}
                        placeholder={
                          snaptradeHasKeys ? "replace client id" : "client id"
                        }
                        autoComplete="off"
                      />
                      <input
                        className={`w-full ${workspacePageStyles.inlineInput}`}
                        type="password"
                        value={consumerKey}
                        onChange={(event) => setConsumerKey(event.target.value)}
                        placeholder={
                          snaptradeHasKeys
                            ? "replace consumer key"
                            : "consumer key"
                        }
                        autoComplete="off"
                      />
                    </div>

                    {snapMessage ? (
                      <p className={workspacePageStyles.cardBodyText}>
                        {snapMessage}
                      </p>
                    ) : null}

                    <p className="text-[0.58rem] leading-relaxed text-muted-foreground">
                      Disconnect clears only keys stored in Anorvis. Your
                      SnapTrade account and brokerage connections stay intact.
                    </p>
                  </>
                )}
              </section>

              {selectedSource !== "csv" || !csvFileLoaded ? (
                <section className="flex min-w-0 flex-col gap-6">
                  <div className="shrink-0 space-y-3 border border-border p-4">
                    <p className={workspacePageStyles.cardLabel}>
                      {"// setup guide"}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {setupSteps.map((step, index) => (
                        <SourceStepToggle
                          key={step.title}
                          index={index}
                          active={selectedStepIndex === index}
                          onSelect={() => setSelectedStepIndex(index)}
                        />
                      ))}
                    </div>
                    <SourceStepDetail step={selectedSetupStep} />
                  </div>
                  {selectedSource === "csv" ? (
                    <FinanceCsvReceipt
                      fill
                      imports={imports}
                      importMessage={importMessage}
                      undoingImportId={undoingImportId}
                      onUndoImport={(record) => void undoImport(record)}
                    />
                  ) : null}
                </section>
              ) : null}
            </div>

            {selectedSource === "csv" && csvFileLoaded ? (
              <FinanceCsvReceipt
                imports={imports}
                importMessage={importMessage}
                undoingImportId={undoingImportId}
                onUndoImport={(record) => void undoImport(record)}
              />
            ) : null}

            <DialogFooter className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-3">
              <button
                type="button"
                className={workspacePageStyles.modalButton}
                onClick={() => {
                  setSelectedSource(null);
                  setSelectedStepIndex(0);
                  setCsvFileLoaded(false);
                }}
              >
                back
              </button>
              {selectedSource === "snaptrade" ? (
                <>
                  <button
                    type="button"
                    className={workspacePageStyles.modalButton}
                    disabled={
                      snapBusy || !clientId.trim() || !consumerKey.trim()
                    }
                    onClick={() => void saveCredentials()}
                  >
                    {snapBusy ? "..." : "save keys"}
                  </button>
                  {snaptradeHasKeys ? (
                    <>
                      <button
                        type="button"
                        className={workspacePageStyles.modalButton}
                        disabled={snapBusy}
                        onClick={() => void openPortal()}
                      >
                        connect brokerage
                      </button>
                      <button
                        type="button"
                        className={workspacePageStyles.modalButton}
                        disabled={snapBusy}
                        onClick={() => void runSync()}
                      >
                        sync
                      </button>
                      <button
                        type="button"
                        className={workspacePageStyles.modalDangerButton}
                        disabled={snapBusy}
                        onClick={() => void disconnect()}
                      >
                        disconnect
                      </button>
                    </>
                  ) : null}
                </>
              ) : null}
            </DialogFooter>
          </div>
        )}
      </FinanceDialog>
    </Section>
  );
}
