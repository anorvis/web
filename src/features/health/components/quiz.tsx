import { Button } from "@anorvis/ui/button";
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@anorvis/ui/dialog";
import { Label } from "@anorvis/ui/label";
import { workspacePageStyles } from "@anorvis/ui/styles";
import type { ReactNode } from "react";
import {
  WorkspaceDialog,
  workspaceModalFooterClass,
} from "@/components/layout/workspace-dialog";

type QuizState = {
  birthdate: string;
  heightCm: string;
  weightKg: string;
  bodyFatPercent: string;
  sex: string;
  goal: string;
  activityLevel: string;
  targetCalories: string;
  proteinGrams: string;
  carbsGrams: string;
  fatGrams: string;
  trainingDaysPerWeek: string;
};

function OptionButton({
  selected,
  children,
  onClick,
}: {
  selected: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${workspacePageStyles.outlineButton} ${
        selected ? "border-foreground text-foreground" : ""
      }`}
    >
      {children}
    </button>
  );
}

export function MacroQuiz(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  step: number;
  setStep: (updater: (step: number) => number) => void;
  quiz: QuizState;
  setValue: (
    field: keyof QuizState,
  ) => (event: React.ChangeEvent<HTMLInputElement>) => void;
  setField: (field: keyof QuizState, value: string) => void;
  inputClass: string;
  heightUnitLabel: string;
  weightUnitLabel: string;
  requiredComplete: boolean;
  isPending: boolean;
  onCalculate: () => void;
}) {
  return (
    <WorkspaceDialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogHeader>
        <DialogTitle className={workspacePageStyles.cardTitle}>
          diagnosis props.quiz
        </DialogTitle>
        <DialogDescription className={workspacePageStyles.cardBodyText}>
          step {props.step + 1} of 3
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        {Object.entries(props.quiz).map(([key, value]) => (
          <input key={key} type="hidden" name={key} value={value} />
        ))}
        {props.step === 0 && (
          <div className="grid gap-3">
            <div className="space-y-1">
              <Label className={workspacePageStyles.cardLabel}>
                body baseline
              </Label>
              <p className={workspacePageStyles.cardBodyText}>
                used to estimate your starting energy needs before the app
                adapts from real logs.
              </p>
            </div>
            <label className="space-y-1">
              <span className={workspacePageStyles.metricLabel}>birthdate</span>
              <input
                className={props.inputClass}
                type="date"
                value={props.quiz.birthdate}
                onChange={props.setValue("birthdate")}
                onKeyDown={(event) => {
                  if (event.key === "Enter") event.preventDefault();
                }}
              />
            </label>
            <label className="space-y-1">
              <span className={workspacePageStyles.metricLabel}>height</span>
              <input
                className={props.inputClass}
                placeholder={props.heightUnitLabel}
                inputMode="decimal"
                value={props.quiz.heightCm}
                onChange={props.setValue("heightCm")}
                onKeyDown={(event) => {
                  if (event.key === "Enter") event.preventDefault();
                }}
              />
            </label>
            <label className="space-y-1">
              <span className={workspacePageStyles.metricLabel}>weight</span>
              <input
                className={props.inputClass}
                placeholder={props.weightUnitLabel}
                inputMode="decimal"
                value={props.quiz.weightKg}
                onChange={props.setValue("weightKg")}
                onKeyDown={(event) => {
                  if (event.key === "Enter") event.preventDefault();
                }}
              />
            </label>
            <label className="space-y-1">
              <span className={workspacePageStyles.metricLabel}>
                body fat optional
              </span>
              <input
                className={props.inputClass}
                placeholder="%"
                inputMode="decimal"
                value={props.quiz.bodyFatPercent}
                onChange={props.setValue("bodyFatPercent")}
                onKeyDown={(event) => {
                  if (event.key === "Enter") event.preventDefault();
                }}
              />
            </label>
            <span className={workspacePageStyles.metricLabel}>sex</span>
            <div className="grid grid-cols-2 gap-2">
              {["male", "female"].map((sex) => (
                <OptionButton
                  key={sex}
                  selected={props.quiz.sex === sex}
                  onClick={() => props.setField("sex", sex)}
                >
                  {sex}
                </OptionButton>
              ))}
            </div>
          </div>
        )}
        {props.step === 1 && (
          <div className="grid gap-3">
            <div className="space-y-1">
              <Label className={workspacePageStyles.cardLabel}>
                goal and training rhythm
              </Label>
              <p className={workspacePageStyles.cardBodyText}>
                choose the outcome and how often you expect to lift or train.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {[
                ["lose", "lose fat"],
                ["maintain", "maintain/recomp"],
                ["gain", "gain muscle"],
              ].map(([value, label]) => (
                <OptionButton
                  key={value}
                  selected={props.quiz.goal === value}
                  onClick={() => props.setField("goal", value)}
                >
                  {label}
                </OptionButton>
              ))}
            </div>
            <div className="space-y-2">
              <span className={workspacePageStyles.metricLabel}>
                training days/week
              </span>
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: 7 }, (_, index) => String(index + 1)).map(
                  (day) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => props.setField("trainingDaysPerWeek", day)}
                      className={`size-9 rounded-full border border-border text-[0.65rem] text-muted-foreground hover:border-foreground hover:text-foreground ${
                        props.quiz.trainingDaysPerWeek === day
                          ? "border-foreground text-foreground"
                          : ""
                      }`}
                    >
                      {day}
                    </button>
                  ),
                )}
              </div>
            </div>
          </div>
        )}
        {props.step === 2 && (
          <div className="grid gap-3">
            <div className="space-y-1">
              <Label className={workspacePageStyles.cardLabel}>
                daily activity
              </Label>
              <p className={workspacePageStyles.cardBodyText}>
                this is outside formal workouts: desk job, walking, errands,
                active work, etc.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {[
                ["light", "mostly seated"],
                ["moderate", "some walking"],
                ["high", "active job / lots of steps"],
              ].map(([value, label]) => (
                <OptionButton
                  key={value}
                  selected={props.quiz.activityLevel === value}
                  onClick={() => props.setField("activityLevel", value)}
                >
                  {label}
                </OptionButton>
              ))}
            </div>
            <p className={workspacePageStyles.cardBodyText}>
              choose based on non-workout movement. mostly seated means desk
              days; some walking means regular errands/commuting; active means
              you are on your feet for much of the day.
            </p>
            <div className="space-y-2 border border-border p-3">
              <div>
                <p className={workspacePageStyles.cardLabel}>
                  {"// manual goal override"}
                </p>
                <p className={workspacePageStyles.metricLabel}>
                  Optional. Leave blank to use calculated defaults.
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-4">
                {[
                  ["targetCalories", "calories"],
                  ["proteinGrams", "protein g"],
                  ["carbsGrams", "carbs g"],
                  ["fatGrams", "fat g"],
                ].map(([field, label]) => (
                  <label key={field} className="space-y-1">
                    <span className={workspacePageStyles.metricLabel}>
                      {label}
                    </span>
                    <input
                      className={props.inputClass}
                      inputMode="decimal"
                      value={props.quiz[field as keyof typeof props.quiz]}
                      onChange={props.setValue(
                        field as keyof typeof props.quiz,
                      )}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") event.preventDefault();
                      }}
                    />
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}
        <DialogFooter className={workspaceModalFooterClass}>
          <Button
            type="button"
            disabled={props.step === 0}
            onClick={() => props.setStep((step) => Math.max(0, step - 1))}
            className={workspacePageStyles.actionButton}
          >
            back
          </Button>
          {props.step < 2 ? (
            <Button
              type="button"
              onClick={() => props.setStep((step) => Math.min(2, step + 1))}
              className={workspacePageStyles.actionButton}
            >
              next
            </Button>
          ) : (
            <Button
              disabled={props.isPending || !props.requiredComplete}
              type="button"
              onClick={props.onCalculate}
              className={workspacePageStyles.actionButton}
            >
              calculate
            </Button>
          )}
        </DialogFooter>
      </div>
    </WorkspaceDialog>
  );
}
