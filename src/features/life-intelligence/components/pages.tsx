import { Badge } from "@anorvis/ui/badge";
import { workspacePageStyles } from "@anorvis/ui/styles";
import { cn } from "@anorvis/ui/utils";
import { WorkspaceCard } from "@/components/layout/workspace";

const signalCards = [
  {
    label: "sleep",
    value: "6h 42m",
    state: "risk",
    note: "below target; late shift pattern active",
  },
  {
    label: "money",
    value: "+$18",
    state: "watch",
    note: "delivery spend rises after short sleep",
  },
  {
    label: "time",
    value: "82%",
    state: "loaded",
    note: "calendar density high after 4pm",
  },
  {
    label: "body",
    value: "low protein",
    state: "nudge",
    note: "breakfast missing stable anchor",
  },
];

const lifeBlocks = [
  { time: "07:45", title: "wake", meta: "sleep target missed by 1h 18m" },
  { time: "10:30", title: "deep work block", meta: "protect before messages" },
  { time: "14:00", title: "meal prep", meta: "prevents late-shift delivery" },
  { time: "16:00", title: "shift", meta: "ends 22:00 · sleep window risk" },
  { time: "23:30", title: "sleep window", meta: "recommended experiment" },
];

const healthSections = [
  {
    label: "food",
    title: "recipe system",
    body: "photo-first recipe cards, version history, macro estimates, and chef-style tweaks over time.",
  },
  {
    label: "sleep",
    title: "highest leverage signal",
    body: "sleep duration and consistency feed home insights, time planning, spending risk, and training readiness.",
  },
  {
    label: "training",
    title: "consistency over intensity",
    body: "workouts become records connected to calendar load, meals, recovery, and active experiments.",
  },
  {
    label: "medical",
    title: "document review",
    body: "upload labs or reports, extract markers, review values, and track biomarker timelines safely.",
  },
];

const allocation = [
  { label: "fixed", value: "$1,420" },
  { label: "food", value: "$420" },
  { label: "invest", value: "$500" },
  { label: "cash", value: "$280" },
];

const labRows = [
  { label: "active model", value: "sleep protection" },
  {
    label: "hypothesis",
    value: "8h sleep reduces delivery spend and raises execution",
  },
  { label: "evidence", value: "calendar + food + finance + workout records" },
  { label: "next run", value: "compare 7 protected nights vs baseline" },
];

export function HomeDashboard() {
  return (
    <div className="space-y-4">
      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <WorkspaceCard
          label="today"
          title="operating picture"
          bodyClassName="space-y-5"
        >
          <div className="space-y-2">
            <p className="text-[1.55rem] leading-tight tracking-[0.04em] text-foreground">
              protect sleep before anything else.
            </p>
            <p className={workspacePageStyles.cardBodyText}>
              anorvis sees a recurring chain: short sleep makes the next day
              more expensive, less active, and harder to execute.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {signalCards.map((signal) => (
              <SignalCard key={signal.label} {...signal} />
            ))}
          </div>
        </WorkspaceCard>

        <WorkspaceCard label="discovery" title="cross-pillar insight">
          <InsightBlock
            impact="high impact"
            confidence="medium confidence"
            title="sleep drives next-day discipline"
            body="when sleep falls under 8h, delivery spending rises, workouts become less likely, and calendar commitments feel heavier. start with a seven-day sleep protection experiment."
          />
        </WorkspaceCard>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <WorkspaceCard label="experiment" title="sleep protection week">
          <ProgressRows
            rows={[
              ["status", "planned"],
              ["measure", "sleep · spend · workouts · completion"],
              ["duration", "7 days"],
            ]}
          />
        </WorkspaceCard>
        <WorkspaceCard label="what changed" title="recent synthesis">
          <ProgressRows
            rows={[
              ["new", "late shift risk pattern"],
              ["updated", "food spend model"],
              ["watch", "protein at breakfast"],
            ]}
          />
        </WorkspaceCard>
        <WorkspaceCard label="next action" title="agent review">
          <p className={workspacePageStyles.cardBodyText}>
            ask anorvis to plan tomorrow around sleep, shift recovery, meal
            prep, and the highest-value work block.
          </p>
        </WorkspaceCard>
      </section>
    </div>
  );
}

export function LifeSurface() {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(22rem,0.9fr)]">
      <WorkspaceCard
        label="calendar"
        title="today timeline"
        bodyClassName="space-y-0"
      >
        {lifeBlocks.map((block) => (
          <div
            key={`${block.time}-${block.title}`}
            className="grid grid-cols-[4rem_minmax(0,1fr)] gap-4 border-b border-border/50 py-3 last:border-b-0"
          >
            <p className="text-[0.6rem] text-muted-foreground">{block.time}</p>
            <div className="space-y-1">
              <p className="text-[0.72rem] uppercase tracking-[0.18em] text-foreground">
                {block.title}
              </p>
              <p className={workspacePageStyles.cardBodyText}>{block.meta}</p>
            </div>
          </div>
        ))}
      </WorkspaceCard>

      <div className="space-y-4">
        <WorkspaceCard label="commitment" title="rich detail panel">
          <ProgressRows
            rows={[
              ["type", "shift"],
              ["source", "agent parsed from conversation"],
              ["risk", "sleep window conflict"],
              ["action", "prep meal before leaving"],
            ]}
          />
        </WorkspaceCard>
        <WorkspaceCard label="agent diff" title="review before apply">
          <p className={workspacePageStyles.cardBodyText}>
            natural language edits should land here first: add shift, move
            event, convert task to block, split routine, or protect sleep
            window.
          </p>
        </WorkspaceCard>
      </div>
    </div>
  );
}

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
        <WorkspaceCard label="recipe" title="chicken rice bowl · v4">
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

export function FinanceSurface() {
  return (
    <div className="space-y-4">
      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <WorkspaceCard label="allocation" title="next paycheck plan">
          <div className="grid gap-2 sm:grid-cols-4">
            {allocation.map((item) => (
              <div key={item.label} className="border border-border p-3">
                <p className={workspacePageStyles.metricLabel}>{item.label}</p>
                <p className={workspacePageStyles.metricValue}>{item.value}</p>
              </div>
            ))}
          </div>
        </WorkspaceCard>
        <WorkspaceCard label="projection" title="future model">
          <InsightBlock
            impact="scenario"
            confidence="editable assumptions"
            title="current lifestyle vs invest $500/month"
            body="show the tradeoff between current spending, lower delivery frequency, and recurring investment over 3, 6, and 12 month horizons."
          />
        </WorkspaceCard>
      </section>
      <WorkspaceCard label="money movement" title="flow map">
        <div className="grid gap-2 md:grid-cols-5">
          {["income", "fixed", "food", "discretionary", "invest"].map(
            (step, index) => (
              <div key={step} className="border border-border p-4 text-center">
                <p className={workspacePageStyles.metricLabel}>
                  {String(index + 1).padStart(2, "0")}
                </p>
                <p className="text-[0.68rem] uppercase tracking-[0.2em] text-foreground">
                  {step}
                </p>
              </div>
            ),
          )}
        </div>
      </WorkspaceCard>
    </div>
  );
}

export function LosAlamosDashboard() {
  return (
    <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
      <WorkspaceCard label="lab" title="experiment control">
        <ProgressRows rows={labRows.map((row) => [row.label, row.value])} />
      </WorkspaceCard>
      <WorkspaceCard label="simulation" title="cross-pillar model">
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            ["input", "sleep, shifts, meals, spend"],
            ["model", "habit impact estimate"],
            ["output", "recommended experiment"],
          ].map(([label, value]) => (
            <div key={label} className="min-h-32 border border-border p-3">
              <p className={workspacePageStyles.cardLabel}>{`// ${label}`}</p>
              <p className="mt-8 text-[0.7rem] uppercase tracking-[0.18em] text-foreground">
                {value}
              </p>
            </div>
          ))}
        </div>
      </WorkspaceCard>
    </div>
  );
}

function SignalCard({
  label,
  value,
  state,
  note,
}: {
  label: string;
  value: string;
  state: string;
  note: string;
}) {
  return (
    <div className="space-y-2 border border-border p-3">
      <div className="flex items-start justify-between gap-3">
        <p className={workspacePageStyles.metricLabel}>{label}</p>
        <Badge
          variant="outline"
          className={cn(workspacePageStyles.badgeSmall, "rounded-none")}
        >
          {state}
        </Badge>
      </div>
      <p className={workspacePageStyles.metricValue}>{value}</p>
      <p className={workspacePageStyles.cardBodyText}>{note}</p>
    </div>
  );
}

function InsightBlock({
  impact,
  confidence,
  title,
  body,
}: {
  impact: string;
  confidence: string;
  title: string;
  body: string;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline" className={workspacePageStyles.badgeSmall}>
          {impact}
        </Badge>
        <Badge variant="outline" className={workspacePageStyles.badgeSmall}>
          {confidence}
        </Badge>
      </div>
      <div className="space-y-2">
        <p className="text-[1.15rem] leading-tight tracking-[0.04em] text-foreground">
          {title}
        </p>
        <p className={workspacePageStyles.cardBodyText}>{body}</p>
      </div>
    </div>
  );
}

function ProgressRows({ rows }: { rows: Array<[string, string]> }) {
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
