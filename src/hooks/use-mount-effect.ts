// biome-ignore lint/style/noRestrictedImports: foundational effect hook — only approved useEffect wrapper
import { type EffectCallback, useEffect } from "react";

/**
 * Runs an effect once on mount with optional cleanup.
 * Direct useEffect is banned in this codebase. Use this hook for
 * mount-time external synchronization (DOM, subscriptions, browser APIs).
 *
 * For all other patterns:
 * - Derived state → compute inline or useMemo
 * - Data fetching → event handlers (or React Query when adopted)
 * - User actions → event handlers
 * - Prop-change reset → key pattern on parent
 */
export function useMountEffect(effect: EffectCallback) {
  useEffect(effect, []);
}
