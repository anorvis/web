"use client";

import FuzzyText from "@anorvis/ui/fuzzy-text";
import { workspaceContainerStyles } from "@anorvis/ui/styles";
import { useState } from "react";
import { ModeToggle } from "@/components/utils/dark-mode-toggle";

export function PublicLanding() {
  const [entered, setEntered] = useState(false);

  return (
    <main className="min-h-screen text-sm" id="main-content">
      <ModeToggle className="fixed right-6 top-6 z-50 border-border bg-background/80 text-muted-foreground backdrop-blur hover:border-foreground hover:text-foreground" />

      <section className={`${workspaceContainerStyles} min-h-screen py-8`}>
        {!entered ? (
          <section className="relative min-h-[calc(100vh-4rem)]">
            <div className="fixed left-0 right-0 top-1/2 flex -translate-y-1/2 justify-center opacity-70 hover:opacity-100">
              <button
                type="button"
                onClick={() => setEntered(true)}
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transform-gpu animate-pulse border-0 bg-transparent p-0 text-foreground duration-500 hover:scale-101 hover:animate-none focus:outline-none"
                aria-label="Open Anorvis thesis placeholder"
              >
                <FuzzyText
                  baseIntensity={0.4}
                  hoverIntensity={0.1}
                  enableHover={true}
                >
                  anorvis.
                </FuzzyText>
              </button>
            </div>
          </section>
        ) : (
          <section className="flex min-h-[calc(100vh-4rem)] items-center justify-center py-12">
            <div className="w-full max-w-3xl space-y-6 text-left">
              <div className="space-y-2 border-b border-border pb-5">
                <p className="text-[0.6rem] uppercase tracking-[0.3em] text-muted-foreground">
                  thesis
                </p>
                <h1 className="font-header text-lg uppercase tracking-[0.2em]">
                  placeholder
                </h1>
              </div>

              <div className="space-y-4 font-mono text-xs leading-7 text-muted-foreground sm:text-sm">
                <p>
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit.
                  Integer posuere erat a ante venenatis dapibus posuere velit
                  aliquet. Maecenas faucibus mollis interdum.
                </p>
                <p>
                  Donec ullamcorper nulla non metus auctor fringilla. Cras
                  mattis consectetur purus sit amet fermentum. Duis mollis, est
                  non commodo luctus, nisi erat porttitor ligula.
                </p>
              </div>
            </div>
          </section>
        )}
      </section>
    </main>
  );
}
