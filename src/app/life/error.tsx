"use client";

import { Button } from "@anorvis/ui/button";
import { workspacePageStyles } from "@anorvis/ui/styles";
import { RefreshCw } from "lucide-react";
import { Workspace } from "@/components/layout/workspace";

export default function LifeError({ reset }: { reset: () => void }) {
  return (
    <Workspace>
      <div className={workspacePageStyles.page}>
        <div className={workspacePageStyles.header}>
          <p className={workspacePageStyles.eyebrow}>{"// life"}</p>
          <h1 className={workspacePageStyles.title}>something went wrong</h1>
          <p className={workspacePageStyles.subtitle}>
            failed to load life data — this is usually a transient issue
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={reset}
          className={workspacePageStyles.errorButton}
        >
          <RefreshCw className="size-3" />
          retry
        </Button>
      </div>
    </Workspace>
  );
}
