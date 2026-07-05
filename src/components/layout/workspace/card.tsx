import { Card, CardContent, CardHeader } from "@anorvis/ui/card";
import { workspacePageStyles } from "@anorvis/ui/styles";
import { cn } from "@anorvis/ui/utils";
import type { ReactNode } from "react";

type WorkspaceCardProps = {
  label?: string;
  title?: string;
  headerExtra?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
};

export function WorkspaceCard({
  label,
  title,
  headerExtra,
  children,
  className,
  bodyClassName,
}: WorkspaceCardProps) {
  const hasHeader = label || title || headerExtra;

  return (
    <Card className={cn(workspacePageStyles.card, className)}>
      {hasHeader && (
        <CardHeader className={workspacePageStyles.cardHeader}>
          {headerExtra ? (
            <div className="flex items-center justify-between">
              <WorkspaceCardHeading label={label} title={title} />
              {headerExtra}
            </div>
          ) : (
            <WorkspaceCardHeading label={label} title={title} />
          )}
        </CardHeader>
      )}
      <CardContent className={cn(workspacePageStyles.cardBody, bodyClassName)}>
        {children}
      </CardContent>
    </Card>
  );
}

function WorkspaceCardHeading({
  label,
  title,
}: Pick<WorkspaceCardProps, "label" | "title">) {
  return (
    <div className="space-y-2">
      {label && (
        <p className={workspacePageStyles.cardLabel}>{`// ${label}`}</p>
      )}
      {title && <p className={workspacePageStyles.cardTitle}>{title}</p>}
    </div>
  );
}
