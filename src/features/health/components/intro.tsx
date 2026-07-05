import { Button } from "@anorvis/ui/button";
import { workspacePageStyles } from "@anorvis/ui/styles";

export function QuizPrompt(props: {
  hasProfile: boolean;
  onStart: () => void;
}) {
  return (
    <div
      className={`${workspacePageStyles.card} flex items-center justify-between gap-4 px-5 py-4`}
    >
      <div className="min-w-0 space-y-1">
        <p className={workspacePageStyles.cardLabel}>{"// diagnosis quiz"}</p>
        <p className={workspacePageStyles.cardBodyText}>
          {props.hasProfile
            ? "retake anytime to recalculate calories and macro targets."
            : "answer a few questions to calculate your starting calories and macro targets."}
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          type="button"
          onClick={props.onStart}
          className={`${workspacePageStyles.actionButton} border-foreground/50`}
        >
          {props.hasProfile ? "retake quiz" : "start quiz"}
        </Button>
      </div>
    </div>
  );
}
