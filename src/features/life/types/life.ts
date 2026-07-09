export type TimeBlockType = "event" | "todo" | "session";

export type TimeBlock = {
  id: string;
  type: TimeBlockType;
  title: string;
  notes?: string;
  tagIds: string[];
  startAt?: string;
  endAt?: string;
  dueAt?: string;
  allDay?: boolean;
  timezone?: string;
  createdAt: string;
  updatedAt: string;
};

export type Event = TimeBlock & {
  type: "event";
  location?: string;
  recurrence?: string;
};

export type Todo = TimeBlock & {
  type: "todo";
  priority?: "low" | "medium" | "high";
  completedAt?: string;
};

export type Session = TimeBlock & {
  type: "session";
  todoIds: string[];
  mode: "focus" | "break";
};

export type Tag = {
  id: string;
  name: string;
  color?: string;
};

export type LifeData = {
  tags: Tag[];
  timeBlocks: Array<Event | Todo | Session>;
  activeSession?: Session;
};

export type ProposedLifeDiff = {
  id: string;
  title: string;
  reason: string;
  operation: "create" | "update" | "delete";
  targetType: TimeBlockType | "tag";
  status: "needs_review" | "approved" | "rejected";
  evidenceIds: string[];
};
