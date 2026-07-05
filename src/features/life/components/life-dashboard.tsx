"use client";

import { Skeleton } from "@anorvis/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { WorkspaceCard } from "@/components/layout/workspace";
import { fetchLifeSnapshot } from "@/features/life/api/life";
import { CalendarView } from "@/features/life/components/calendar-view";
import {
  InspirationPanel,
  LifePanel,
  TodayWorkloadPanel,
} from "@/features/life/components/life-command-widgets";
import {
  AddTaskButton,
  PriorityQueue,
} from "@/features/life/components/priority-queue";
import { useLifeStore } from "@/features/life/stores/life-store";
import { useMountEffect } from "@/hooks/use-mount-effect";
import { queryKeys } from "@/lib/query/keys";

export function LifeDashboard() {
  const [isMounted, setIsMounted] = useState(false);
  const [calendarToday, setCalendarToday] = useState<Date | null>(null);
  const selectedDate = useLifeStore((state) => state.selectedDate);
  const setSelectedDate = useLifeStore((state) => state.setSelectedDate);
  const { data: snapshot } = useQuery({
    queryKey: queryKeys.life.snapshot(),
    queryFn: fetchLifeSnapshot,
  });

  useMountEffect(() => {
    const today = new Date();
    setCalendarToday(today);
    if (selectedDate.getTime() === 0) {
      setSelectedDate(today);
    }
    setIsMounted(true);
  });

  if (
    !isMounted ||
    !snapshot ||
    !calendarToday ||
    selectedDate.getTime() === 0
  ) {
    return <LifeDashboardLoading />;
  }

  return (
    <>
      <div className="grid items-stretch gap-4 xl:grid-cols-3">
        <TodayWorkloadPanel snapshot={snapshot} />
        <LifePanel
          label="// priority queue"
          title="open work"
          meta={`${snapshot.queue.length} tasks`}
          action={<AddTaskButton />}
        >
          <PriorityQueue
            queue={snapshot.queue}
            emptyDescription="No open tasks."
            allowCreate
          />
        </LifePanel>
        <InspirationPanel />
      </div>

      <WorkspaceCard>
        <CalendarView
          hasCalendar
          today={calendarToday}
          tasks={snapshot.queue}
        />
      </WorkspaceCard>
    </>
  );
}

function LifeDashboardLoading() {
  return (
    <>
      <div className="grid items-stretch gap-4 xl:grid-cols-3">
        <Skeleton className="h-[436px] rounded-none" />
        <Skeleton className="h-[436px] rounded-none" />
        <Skeleton className="h-[436px] rounded-none" />
      </div>
      <Skeleton className="h-[520px] rounded-none" />
    </>
  );
}
