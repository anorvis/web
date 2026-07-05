import { Skeleton } from "@anorvis/ui/skeleton";
import { cn } from "@anorvis/ui/utils";

const SESSION_SKELETON_KEYS = [
  "session-a",
  "session-b",
  "session-c",
  "session-d",
  "session-e",
  "session-f",
] as const;
const CONVERSATION_SKELETON_KEYS = [
  "message-a",
  "message-b",
  "message-c",
  "message-d",
  "message-e",
] as const;

export function SessionListSkeleton() {
  return (
    <div className="space-y-2">
      {SESSION_SKELETON_KEYS.map((key) => (
        <div key={key} className="border border-border p-3">
          <div className="flex items-start justify-between gap-3">
            <Skeleton className="h-3 w-32 rounded-none" />
            <Skeleton className="h-4 w-10 rounded-none" />
          </div>
          <Skeleton className="mt-3 h-3 w-full rounded-none" />
          <Skeleton className="mt-2 h-3 w-3/4 rounded-none" />
          <div className="mt-4 flex items-center justify-between">
            <Skeleton className="h-3 w-20 rounded-none" />
            <Skeleton className="h-3 w-24 rounded-none" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ConversationSkeleton() {
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      {CONVERSATION_SKELETON_KEYS.map((key, index) => {
        const isUser = index % 2 === 0;
        return (
          <div
            key={key}
            className={cn("flex", isUser ? "justify-end" : "justify-start")}
          >
            <div className="w-[min(84%,42rem)] border border-border px-4 py-3">
              <div className="mb-3 flex items-center gap-2">
                <Skeleton className="h-3 w-16 rounded-none" />
                <Skeleton className="h-3 w-24 rounded-none" />
              </div>
              <Skeleton className="h-3 w-full rounded-none" />
              <Skeleton className="mt-2 h-3 w-11/12 rounded-none" />
              <Skeleton className="mt-2 h-3 w-2/3 rounded-none" />
            </div>
          </div>
        );
      })}
    </div>
  );
}

type AgentBarSkeletonProps = {
  count?: number;
};

export function AgentBarSkeleton({ count = 3 }: AgentBarSkeletonProps) {
  const skeletonKeys = Array.from(
    { length: count },
    (_, index) => `agent-${index}`,
  );

  return (
    <div className="flex gap-2 overflow-x-auto">
      {skeletonKeys.map((key) => (
        <div
          key={key}
          className="flex min-w-36 items-center gap-2 border border-border px-2.5 py-1.5"
        >
          <Skeleton className="size-7 shrink-0 rounded-none" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3 w-20 rounded-none" />
            <Skeleton className="h-3 w-14 rounded-none" />
          </div>
        </div>
      ))}
    </div>
  );
}
