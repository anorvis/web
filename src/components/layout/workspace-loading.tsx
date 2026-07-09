import { cn } from "@anorvis/ui/utils";
import { Workspace } from "@/components/layout/workspace";

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={cn("animate-pulse bg-muted", className)} />;
}

export function WorkspaceLoading({
  titleWidth = "w-24",
  subtitleWidth = "w-48",
  rows = "dashboard",
}: {
  titleWidth?: string;
  subtitleWidth?: string;
  rows?: "dashboard" | "calendar" | "simple";
}) {
  return (
    <Workspace>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="space-y-2 border-b border-border pb-5">
          <Skeleton className="h-3 w-16" />
          <Skeleton className={cn("h-6", titleWidth)} />
          <Skeleton className={cn("h-3", subtitleWidth)} />
        </div>
        {rows === "calendar" ? (
          <>
            <div className="grid gap-4 lg:grid-cols-2">
              <Skeleton className="h-40" />
              <Skeleton className="h-40" />
            </div>
            <Skeleton className="h-[640px]" />
          </>
        ) : rows === "simple" ? (
          <Skeleton className="h-32" />
        ) : (
          <>
            <div className="grid gap-4 lg:grid-cols-3">
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <Skeleton className="h-56" />
              <Skeleton className="h-56" />
            </div>
            <Skeleton className="h-48" />
          </>
        )}
      </div>
    </Workspace>
  );
}
