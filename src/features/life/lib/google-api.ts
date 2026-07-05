import "server-only";

export const GOOGLE_CALENDAR_SCOPE_CANDIDATES: string[] = [];

export const GOOGLE_TASKS_SCOPE_CANDIDATES: string[] = [];

export type GoogleCalendarEvent = {
  id?: string;
  status?: string;
  summary?: string;
  start?: {
    dateTime?: string;
    date?: string;
  };
  end?: {
    dateTime?: string;
    date?: string;
  };
};

export type GoogleCalendarEventsResponse = {
  timeZone?: string;
  items?: GoogleCalendarEvent[];
};

export type GoogleCalendarListEntry = {
  id: string;
  summary?: string;
  primary?: boolean;
  selected?: boolean;
  deleted?: boolean;
  accessRole?: string;
};

export type GoogleCalendarListResponse = {
  items?: GoogleCalendarListEntry[];
};

export type GoogleTask = {
  id?: string;
  title?: string;
  status?: string;
  due?: string;
  completed?: string;
  updated?: string;
};

export type GoogleTaskListResponse = {
  items?: GoogleTask[];
  nextPageToken?: string;
};

export type ProviderSyncStatus = "connected" | "disconnected" | "error";

export type ProviderSyncResult<T> = {
  status: ProviderSyncStatus;
  detail: string;
  data: T | null;
};

export const resolveTimeZone = () =>
  Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

export const toTimestamp = (value: Date | string) => {
  const date = value instanceof Date ? value : new Date(value);
  const timestamp = date.getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
};
