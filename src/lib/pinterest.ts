import "server-only";

import { gatewayFetchJson } from "@/lib/anorvis-gateway";

export type PinterestStatus = {
  connected: boolean;
  hasClientConfig: boolean;
  scopes: string[];
};

export type PinterestBoardImage = {
  id: string;
  imageUrl: string;
  title: string | null;
  link: string | null;
};

export async function startPinterestAuth(input?: {
  scopes?: string[];
  returnTo?: string;
}) {
  return gatewayFetchJson<{ authUrl: string; state: string; scopes: string[] }>(
    "/v1/integrations/pinterest/auth/start",
    {
      method: "POST",
      body: JSON.stringify(input ?? {}),
    },
  );
}

export async function fetchPinterestBoardImages(input: {
  boardUrl?: string;
  boardId?: string;
  maxResults?: number;
}): Promise<PinterestBoardImage[]> {
  const params = new URLSearchParams({
    maxResults: String(input.maxResults ?? 50),
  });
  if (input.boardUrl) params.set("boardUrl", input.boardUrl);
  if (input.boardId) params.set("boardId", input.boardId);
  const payload = await gatewayFetchJson<{ images: PinterestBoardImage[] }>(
    `/v1/integrations/pinterest/board-images?${params.toString()}`,
  );
  return payload.images;
}
