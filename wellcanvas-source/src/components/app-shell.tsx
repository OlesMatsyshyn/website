"use client";

import { useEffect, useState } from "react";
import { BottomNav } from "@/components/bottom-nav";
import { ToastProvider } from "@/components/toast";
import { useLocalCalendarClock } from "@/hooks/use-local-calendar-clock";
import { millisecondsUntilNextBackgroundBoundary } from "@/lib/backgrounds";
import {
  applyAppearance,
  readAppearance,
  type AppearancePreferences,
} from "@/lib/personalization";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [appearance, setAppearance] = useState<AppearancePreferences | null>(null);
  useLocalCalendarClock();

  useEffect(() => {
    function refresh() {
      const nextAppearance = readAppearance();
      applyAppearance(nextAppearance);
      setAppearance(nextAppearance);
    }

    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    window.addEventListener("pageshow", refresh);
    window.addEventListener("health-tracker-profile-change", refresh);
    window.addEventListener("health-tracker-appearance-change", refresh);
    document.addEventListener("visibilitychange", refresh);

    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("pageshow", refresh);
      window.removeEventListener("health-tracker-profile-change", refresh);
      window.removeEventListener("health-tracker-appearance-change", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  useEffect(() => {
    if (!appearance || appearance.backgroundMode !== "automatic") return;
    const delay = millisecondsUntilNextBackgroundBoundary({
      intervalHours: appearance.rotationIntervalHours,
      rotationStartTimestamp: appearance.rotationStartTimestamp,
    });
    if (delay === null || appearance.enabledBackgroundIds.length <= 1) return;

    const timeout = window.setTimeout(() => {
      const nextAppearance = readAppearance();
      applyAppearance(nextAppearance);
      setAppearance(nextAppearance);
    }, delay);
    return () => window.clearTimeout(timeout);
  }, [appearance]);

  return (
    <>
      <div className="app-background" aria-hidden="true" />
      <div className="app-background-dim" aria-hidden="true" />
      <ToastProvider>
        <div className="relative mx-auto flex min-h-dvh w-full max-w-5xl flex-col">
          <main className="flex-1 px-[var(--wc-page-gutter)] pb-[var(--wc-bottom-clearance)] pt-5">
            {children}
          </main>
          <BottomNav />
        </div>
      </ToastProvider>
    </>
  );
}
