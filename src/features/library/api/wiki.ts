import { convexClient } from "@/lib/convex-client";
import { convexApi } from "@/lib/convex-functions";

export type WikiPageStatus = "active" | "archived" | "deleted";
export type WikiAuthorKind = "user" | "import";
export type WikiSourceKind = "interaction" | "document" | "web" | "import";
export type WikiAttachmentSensitivity = "private" | "shareable";

export type WikiPage = {
  _id: string;
  _creationTime: number;
  workspaceId: string;
  path: string;
  title: string;
  aliases?: string[];
  tags?: string[];
  currentRevisionId?: string;
  revisionNumber: number;
  status: WikiPageStatus;
  createdAt: number;
  updatedAt: number;
};

export type WikiRevision = {
  _id: string;
  _creationTime: number;
  workspaceId: string;
  pageId: string;
  revisionNumber: number;
  parentRevisionId?: string;
  markdown: string;
  contentHash: string;
  authorKind: WikiAuthorKind;
  authorUserId?: string;
  agentRunId?: string;
  summary?: string;
  createdAt: number;
};

export type WikiPageWithRevision = WikiPage & {
  aliases: string[];
  tags: string[];
  revision: WikiRevision | null;
};

export type WikiSearchDocument = {
  _id: string;
  _creationTime: number;
  workspaceId: string;
  pageId: string;
  currentRevisionId: string;
  path: string;
  title: string;
  aliases: string[];
  tags: string[];
  markdown: string;
  searchText: string;
  status: WikiPageStatus;
  updatedAt: number;
};

export type WikiBacklink = {
  _id: string;
  _creationTime: number;
  workspaceId: string;
  pageId: string;
  revisionId: string;
  targetPageId?: string;
  targetPath: string;
  label?: string;
  kind: "wiki" | "markdown" | "embed";
  sourcePath: string;
  sourceTitle: string;
};

export type WikiSource = {
  _id: string;
  _creationTime: number;
  workspaceId: string;
  kind: WikiSourceKind;
  title: string;
  uri?: string;
  storageId?: string;
  mimeType?: string;
  contentHash?: string;
  metadata?: Record<string, unknown>;
  createdAt: number;
};

export type WikiAttachment = {
  _id: string;
  _creationTime: number;
  workspaceId: string;
  pageId?: string;
  sourceId?: string;
  storageId: string;
  name: string;
  mimeType: string;
  size: number;
  contentHash: string;
  sensitivity: WikiAttachmentSensitivity;
  createdAt: number;
};

export type WikiSaveInput = {
  workspaceId?: string;
  pageId?: string;
  path: string;
  title?: string;
  markdown: string;
  aliases?: string[];
  tags?: string[];
  baseRevisionId?: string;
  summary?: string;
  authorKind?: WikiAuthorKind;
};

export type WikiSaveResult = {
  pageId: string;
  revisionId: string;
  revisionNumber: number;
};

export type WikiRegisterSourceInput = {
  workspaceId?: string;
  storageId?: string;
  kind: WikiSourceKind;
  title: string;
  uri?: string;
  mimeType?: string;
  metadata?: Record<string, unknown>;
};

export type WikiRegisterAttachmentInput = {
  workspaceId?: string;
  storageId: string;
  pageId?: string;
  sourceId?: string;
  name: string;
  mimeType: string;
  sensitivity: WikiAttachmentSensitivity;
};

export type WikiChunkSearchResult = {
  _id: string;
  _creationTime: number;
  workspaceId: string;
  pageId?: string;
  sourceId?: string;
  revisionId?: string;
  text: string;
  embedding?: number[];
  ordinal: number;
  createdAt: number;
  score: number;
};

export function listWikiPages(
  input: { workspaceId?: string; status?: WikiPageStatus; limit?: number } = {},
): Promise<WikiPage[]> {
  return convexClient.query(convexApi.wiki.list, input);
}

export function getWikiPage(input: {
  workspaceId?: string;
  id?: string;
  path?: string;
}): Promise<WikiPageWithRevision | null> {
  return convexClient.query(convexApi.wiki.get, input);
}

export function searchWikiPages(input: {
  workspaceId?: string;
  query: string;
  limit?: number;
}): Promise<WikiSearchDocument[]> {
  return convexClient.query(convexApi.wiki.search, input);
}

export function listWikiHistory(input: {
  workspaceId?: string;
  pageId: string;
  limit?: number;
}): Promise<WikiRevision[]> {
  return convexClient.query(convexApi.wiki.history, input);
}

export function listWikiBacklinks(input: {
  workspaceId?: string;
  pageId: string;
}): Promise<WikiBacklink[]> {
  return convexClient.query(convexApi.wiki.backlinks, input);
}

export function saveWikiPage(input: WikiSaveInput): Promise<WikiSaveResult> {
  return convexClient.mutation(convexApi.wiki.save, input);
}

export function renameWikiPage(input: {
  workspaceId?: string;
  pageId: string;
  path: string;
}): Promise<string> {
  return convexClient.mutation(convexApi.wiki.rename, input);
}

export function setWikiPageStatus(input: {
  workspaceId?: string;
  pageId: string;
  status: WikiPageStatus;
}): Promise<boolean> {
  return convexClient.mutation(convexApi.wiki.setStatus, input);
}

export function rollbackWikiPage(input: {
  workspaceId?: string;
  pageId: string;
  revisionId: string;
  baseRevisionId: string;
}): Promise<string> {
  return convexClient.mutation(convexApi.wiki.rollback, input);
}

export function generateWikiUploadUrl(
  input: { workspaceId?: string } = {},
): Promise<string> {
  return convexClient.mutation(convexApi.wiki.generateUploadUrl, input);
}

export function listWikiSources(
  input: { workspaceId?: string; limit?: number } = {},
): Promise<WikiSource[]> {
  return convexClient.query(convexApi.wiki.listSources, input);
}

export function listWikiAttachments(
  input: { workspaceId?: string; pageId?: string } = {},
): Promise<WikiAttachment[]> {
  return convexClient.query(convexApi.wiki.listAttachments, input);
}

export function registerWikiSource(
  input: WikiRegisterSourceInput,
): Promise<string> {
  return convexClient.action(convexApi.wikiFiles.registerSource, input);
}

export function registerWikiAttachment(
  input: WikiRegisterAttachmentInput,
): Promise<string> {
  return convexClient.action(convexApi.wikiFiles.registerAttachment, input);
}

export function searchWikiChunks(input: {
  workspaceId?: string;
  embedding: number[];
  limit?: number;
}): Promise<WikiChunkSearchResult[]> {
  return convexClient.action(convexApi.wikiFiles.searchChunks, input);
}
