import type {
  AlpacaPortfolio,
  PortfolioHistoryPoint,
} from "@/features/finance/types/finance";
import { requestJson } from "@/lib/effect/http";
import { runEffect } from "@/lib/effect/runtime";
import {
  requestBrowserLocalJson,
  shouldUseBrowserLocalBackend,
} from "@/lib/local-backend-client";

type FinancePortfolioResponse = {
  portfolio: AlpacaPortfolio | null;
  history: PortfolioHistoryPoint[];
};

export async function fetchFinancePortfolio(): Promise<FinancePortfolioResponse> {
  if (shouldUseBrowserLocalBackend()) {
    return requestBrowserLocalJson<FinancePortfolioResponse>(
      "/v1/finance/portfolio",
    );
  }

  return runEffect(
    requestJson<FinancePortfolioResponse>("/api/finance/portfolio"),
  );
}
