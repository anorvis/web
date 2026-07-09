"use client";

import FuzzyText from "@anorvis/ui/fuzzy-text";
import { workspaceContainerStyles } from "@anorvis/ui/styles";
import { ModeToggle } from "@/components/utils/dark-mode-toggle";

const prodSteps = [
  {
    title: "public landing",
    body: "production mode serves this landing page only; the private workspace is not mounted here.",
    command: "VERCEL_ENV=production",
  },
  {
    title: "run locally for the app",
    body: "use local development mode on a machine that can reach anorvis-os to open the full workspace.",
    command: "VERCEL_ENV=development",
  },
  {
    title: "everything else is 404",
    body: "production mode exposes no private app pages or API routes beyond this root landing page.",
    command: "/* -> 404 except /",
  },
];

export function PublicLanding() {
  return (
    <main className="min-h-screen text-sm" id="main-content">
      <ModeToggle className="fixed right-6 top-6 z-50 border-border bg-background/80 text-muted-foreground backdrop-blur hover:border-foreground hover:text-foreground" />

      <section className={`${workspaceContainerStyles} min-h-screen py-8`}>
        <section className="grid min-h-[calc(100vh-4rem)] gap-8 py-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div className="space-y-8">
            <div className="space-y-4">
              <p className="font-mono text-[0.6rem] uppercase tracking-[0.35em] text-muted-foreground">
                anorvis production landing
              </p>
              <div className="max-w-xl opacity-80">
                <FuzzyText
                  baseIntensity={0.18}
                  hoverIntensity={0.08}
                  enableHover={true}
                >
                  anorvis.
                </FuzzyText>
              </div>
              <h1 className="max-w-2xl font-header text-3xl uppercase leading-tight tracking-[0.18em] text-foreground sm:text-4xl">
                your private workspace stays local.
              </h1>
              <p className="max-w-xl font-mono text-xs leading-6 text-muted-foreground sm:text-sm">
                This production surface is a public landing page. The private
                Anorvis web app only runs outside production against your local
                anorvis-os gateway.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <code className="border border-border bg-card px-3 py-2 font-mono text-[0.65rem] text-muted-foreground">
                production landing
              </code>
            </div>
          </div>

          <div className="space-y-4">
            <div className="border border-border bg-card/70 p-5 shadow-sm backdrop-blur">
              <div className="flex items-center justify-between gap-4 border-b border-border pb-4">
                <div>
                  <p className="font-mono text-[0.6rem] uppercase tracking-[0.3em] text-muted-foreground">
                    runtime
                  </p>
                  <p className="mt-2 font-header text-lg uppercase tracking-[0.16em]">
                    landing only
                  </p>
                </div>
                <span className="border border-border px-2 py-1 font-mono text-[0.6rem] uppercase tracking-[0.2em] text-muted-foreground">
                  production
                </span>
              </div>

              <div className="divide-y divide-border">
                {prodSteps.map((step, index) => (
                  <section
                    key={step.title}
                    className="grid gap-3 py-4 sm:grid-cols-[2rem_1fr]"
                  >
                    <p className="font-mono text-xs text-muted-foreground">
                      {String(index + 1).padStart(2, "0")}
                    </p>
                    <div className="space-y-2">
                      <h2 className="font-mono text-xs uppercase tracking-[0.18em] text-foreground">
                        {step.title}
                      </h2>
                      <p className="font-mono text-xs leading-6 text-muted-foreground">
                        {step.body}
                      </p>
                      <pre className="overflow-x-auto border border-border bg-background p-3 font-mono text-[0.68rem] text-muted-foreground">
                        <code>{step.command}</code>
                      </pre>
                    </div>
                  </section>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ["local-first", "records stay on your machine"],
                ["runtime-gated", "prod never mounts the private app"],
                ["not found", "all non-root prod paths return 404"],
              ].map(([title, body]) => (
                <div
                  key={title}
                  className="border border-border bg-card/50 p-4"
                >
                  <p className="font-mono text-[0.6rem] uppercase tracking-[0.22em] text-foreground">
                    {title}
                  </p>
                  <p className="mt-2 font-mono text-[0.68rem] leading-5 text-muted-foreground">
                    {body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
