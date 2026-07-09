"use client";

import { PublicLanding } from "@/components/landing/public-landing";
import { AppDataPreloader } from "@/components/providers/app-data-preloader";
import { AppQueryEvents } from "@/components/providers/app-query-events";

export function LocalBackendGate({
  children,
  isProd,
}: {
  children: React.ReactNode;
  isProd: boolean;
}) {
  if (isProd) return <PublicLanding />;

  return (
    <>
      <AppDataPreloader />
      <AppQueryEvents />
      {children}
    </>
  );
}
