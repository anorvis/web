// biome-ignore lint/style/noRestrictedImports: foundational animation subscription hook
import { useEffect, useState } from "react";

export function useAnimatedTextFrame(
  renderFrame: (phase: number) => string,
  frameRef: { current: HTMLElement | null },
  intervalMs = 16,
): string {
  const [initialFrame] = useState(() => renderFrame(0));

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let animationFrame = 0;
    let previous = 0;
    let phase = 0;

    const draw = (time: number) => {
      if (time - previous >= intervalMs) {
        const nextFrame = renderFrame(phase);
        if (frameRef.current) frameRef.current.textContent = nextFrame;
        previous = time;
        phase += 0.018;
      }
      animationFrame = requestAnimationFrame(draw);
    };

    const start = () => {
      cancelAnimationFrame(animationFrame);
      const nextFrame = renderFrame(0);
      if (frameRef.current) frameRef.current.textContent = nextFrame;
      if (media.matches) return;
      previous = 0;
      phase = 0;
      animationFrame = requestAnimationFrame(draw);
    };

    start();
    media.addEventListener("change", start);
    return () => {
      media.removeEventListener("change", start);
      cancelAnimationFrame(animationFrame);
    };
  }, [frameRef, intervalMs, renderFrame]);

  return initialFrame;
}
