import { workspacePageStyles } from "@anorvis/ui/styles";
import { cn } from "@anorvis/ui/utils";
import type { ReactNode } from "react";

interface WorkspaceHeaderProps {
  header: string;
  title: string;
  subtitle: string;
  description?: string;
  headerExtra?: ReactNode;
  children?: ReactNode;
  className?: string;
}

export function WorkspaceHeader({
  header,
  title,
  subtitle,
  description,
  headerExtra,
  children,
  className,
}: WorkspaceHeaderProps) {
  return (
    <section className={cn(workspacePageStyles.page, className)}>
      <header className={workspacePageStyles.header}>
        <p className={workspacePageStyles.eyebrow}>{`// ${header}`}</p>
        <h1 className={workspacePageStyles.title}>{title}</h1>
        <p className={workspacePageStyles.subtitle}>{subtitle}</p>
        {description && (
          <p className={workspacePageStyles.subtitle}>{description}</p>
        )}
        {headerExtra}
      </header>
      {children}
    </section>
  );
}
