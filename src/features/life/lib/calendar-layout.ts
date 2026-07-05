import type { CalendarEvent, LayoutEvent } from "@/types/workspace";

// ── Visible range (adapted from lramos33/big-calendar) ──

const DEFAULT_RANGE_FROM = 0;
const DEFAULT_RANGE_TO = 24;
// Visual buffer above/below the hour range for a cleaner look
const RANGE_PAD = 15;

export type VisibleRange = {
  fromHour: number;
  toHour: number;
  fromMinute: number;
  toMinute: number;
  hours: number[];
};

/**
 * Compute visible hour range, expanding to include any events outside defaults.
 * Scans all events (across all days in the view) to ensure nothing is hidden.
 */
export function getVisibleRange(
  events: CalendarEvent[],
  defaultFrom = DEFAULT_RANGE_FROM,
  defaultTo = DEFAULT_RANGE_TO,
): VisibleRange {
  let fromHour = defaultFrom;
  let toHour = defaultTo;

  for (const event of events) {
    const startHour = Math.floor(event.startMinute / 60);
    const endHour =
      event.endMinute % 60 > 0
        ? Math.floor(event.endMinute / 60) + 1
        : Math.floor(event.endMinute / 60);
    if (startHour < fromHour) fromHour = startHour;
    if (endHour > toHour) toHour = Math.min(endHour, 24);
  }

  const hours = Array.from(
    { length: toHour - fromHour },
    (_, i) => i + fromHour,
  );

  return {
    fromHour,
    toHour,
    fromMinute: Math.max(0, fromHour * 60 - RANGE_PAD),
    toMinute: Math.min(1440, toHour * 60 + RANGE_PAD),
    hours,
  };
}

// ── Event layout (collision grouping) ───────────

/**
 * Assign column positions to overlapping events.
 * Returns LayoutEvent[] with `column` and `totalColumns` set.
 */
export function layoutEvents(events: CalendarEvent[]): LayoutEvent[] {
  if (events.length === 0) return [];

  const sorted = [...events].sort((a, b) => {
    const startDiff = a.startMinute - b.startMinute;
    if (startDiff !== 0) return startDiff;
    // Longer events first — they anchor the group visually
    return b.endMinute - a.endMinute;
  });

  const result: LayoutEvent[] = [];
  let groupStart = 0;

  while (groupStart < sorted.length) {
    // Build collision group: extend while next event starts before group's max end
    let groupEnd = groupStart;
    let maxEnd = sorted[groupStart].endMinute;

    while (
      groupEnd + 1 < sorted.length &&
      sorted[groupEnd + 1].startMinute < maxEnd
    ) {
      groupEnd++;
      maxEnd = Math.max(maxEnd, sorted[groupEnd].endMinute);
    }

    // Assign columns greedily within the group
    const columns: { endMinute: number }[][] = [];

    for (let i = groupStart; i <= groupEnd; i++) {
      const ev = sorted[i];
      let placed = false;

      for (let col = 0; col < columns.length; col++) {
        const colEvents = columns[col];
        const lastInCol = colEvents[colEvents.length - 1];
        if (lastInCol.endMinute <= ev.startMinute) {
          colEvents.push({ endMinute: ev.endMinute });
          result.push({ ...ev, column: col, totalColumns: 0 });
          placed = true;
          break;
        }
      }

      if (!placed) {
        columns.push([{ endMinute: ev.endMinute }]);
        result.push({ ...ev, column: columns.length - 1, totalColumns: 0 });
      }
    }

    // Set totalColumns for all events in the group
    const totalCols = columns.length;
    for (
      let i = result.length - (groupEnd - groupStart + 1);
      i < result.length;
      i++
    ) {
      result[i].totalColumns = totalCols;
    }

    groupStart = groupEnd + 1;
  }

  return result;
}
