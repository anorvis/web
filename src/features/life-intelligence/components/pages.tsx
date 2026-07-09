import { workspacePageStyles } from "@anorvis/ui/styles";
import { cn } from "@anorvis/ui/utils";
import { WorkspaceCard } from "@/components/layout/workspace";

const healthSections = [
  {
    label: "sleep",
    title: "highest-leverage recovery signal",
    body: "sleep duration and consistency feed home insights, time planning, spending risk, and training readiness.",
  },
  {
    label: "food",
    title: "recipe and meal records",
    body: "photo-first meal records, recipe versions, macro estimates, and practical tweaks over time.",
  },
  {
    label: "training",
    title: "consistency over intensity",
    body: "workouts become records connected to calendar load, meals, recovery, and recommendation quality.",
  },
  {
    label: "medical",
    title: "document review",
    body: "upload labs or reports, extract markers, review values, and track biomarker timelines safely.",
  },
];

export function HealthSurface() {
  return (
    <div className="space-y-4">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {healthSections.map((section) => (
          <WorkspaceCard
            key={section.label}
            label={section.label}
            title={section.title}
          >
            <p className={workspacePageStyles.cardBodyText}>{section.body}</p>
          </WorkspaceCard>
        ))}
      </section>
      <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <WorkspaceCard label="food" title="chicken rice bowl · v4">
          <div className="aspect-[4/3] border border-border bg-foreground/[0.03]" />
          <ProgressRows
            rows={[
              ["protein", "52g"],
              ["calories", "620"],
              ["change", "greek yogurt instead of mayo"],
            ]}
          />
        </WorkspaceCard>
        <WorkspaceCard label="medical" title="marker timeline">
          <ProgressRows
            rows={[
              ["vitamin d", "low · improving"],
              ["ldl", "watch"],
              ["a1c", "normal"],
              ["next", "upload latest report"],
            ]}
          />
        </WorkspaceCard>
      </section>
    </div>
  );
}

function ProgressRows({
  rows,
}: {
  rows: ReadonlyArray<readonly [string, string]>;
}) {
  return (
    <div className="space-y-0">
      {rows.map(([label, value]) => (
        <div key={`${label}-${value}`} className={workspacePageStyles.listRow}>
          <p className={workspacePageStyles.listLabel}>{label}</p>
          <p
            className={cn(
              workspacePageStyles.listValue,
              "max-w-[60%] text-right",
            )}
          >
            {value}
          </p>
        </div>
      ))}
    </div>
  );
}
