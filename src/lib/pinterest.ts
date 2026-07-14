import "server-only";

import { ConvexHttpClient } from "convex/browser";
import { convexApi } from "@/lib/convex-functions";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL ?? "http://127.0.0.1:3210";
const convexSiteUrl =
  process.env.NEXT_PUBLIC_CONVEX_SITE_URL ?? "http://127.0.0.1:3211";

export type PinterestStatus = {
  connected: boolean;
  hasClientConfig: boolean;
  hasClientId?: boolean;
  hasClientSecret?: boolean;
  scopes: string[];
  canAutoRenew?: boolean;
  accessTokenExpiresAt?: number | null;
};

export type PinterestBoardImage = {
  id: string;
  imageUrl: string;
  title: string | null;
  link: string | null;
};

export async function getPinterestSettings(): Promise<PinterestStatus> {
  const client = new ConvexHttpClient(convexUrl);
  return client.action(convexApi.pinterest.settings, {});
}

export async function savePinterestSettings(input: {
  clientId: string;
  clientSecret: string;
}): Promise<PinterestStatus> {
  const client = new ConvexHttpClient(convexUrl);
  return client.action(convexApi.pinterest.saveSettings, input);
}

export async function startPinterestAuth(input: {
  clientId: string;
  clientSecret: string;
  scopes?: string[];
  returnTo?: string;
}) {
  const client = new ConvexHttpClient(convexUrl);
  const returnTo = input.returnTo ?? "http://127.0.0.1:3000/";
  return client.action(convexApi.pinterest.start, {
    clientId: input.clientId,
    clientSecret: input.clientSecret,
    redirectUri: `${convexSiteUrl}/oauth/pinterest/callback`,
    returnTo,
    scopes: input.scopes,
  });
}

export async function fetchPinterestBoardImages(input: {
  boardUrl?: string;
  boardId?: string;
  maxResults?: number;
}): Promise<PinterestBoardImage[]> {
  const client = new ConvexHttpClient(convexUrl);
  const payload = (await client.action(
    convexApi.pinterest.boardImages,
    input,
  )) as {
    images: PinterestBoardImage[];
  };
  return payload.images;
}
