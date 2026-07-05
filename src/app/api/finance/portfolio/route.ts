import { NextResponse } from "next/server";
import { readWorkspaceDocument } from "@/lib/os-workspace-data";
import {
  isAlpacaPortfolio,
  isPortfolioHistory,
} from "@/lib/workspace-type-guards";

export const runtime = "nodejs";

export async function GET() {
  const [portfolio, history] = await Promise.all([
    readWorkspaceDocument({
      kind: "summary",
      id: "web-finance-portfolio",
      isValue: isAlpacaPortfolio,
    }),
    readWorkspaceDocument({
      kind: "summary",
      id: "web-finance-portfolio-history",
      isValue: isPortfolioHistory,
    }),
  ]);

  return NextResponse.json({ portfolio, history: history ?? [] });
}
