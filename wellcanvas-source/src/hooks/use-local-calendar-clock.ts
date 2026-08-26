"use client";

import { useEffect, useRef, useState } from "react";
import { nextLocalMidnightDelayMs } from "@/lib/calendar";
import { localDateKey } from "@/lib/food-log";

export const LOCAL_DAY_CHANGED_EVENT = "health-tracker:local-day-changed";

export function useLocalCalendarClock() {
  const [dateKey, setDateKey] = useState(localDateKey());
  const lastDateKeyRef = useRef(dateKey);

  useEffect(() => {
    let timeoutId: number | null = null;

    function checkDate() {
      const nextDateKey = localDateKey();
      if (nextDateKey !== lastDateKeyRef.current) {
        lastDateKeyRef.current = nextDateKey;
        setDateKey(nextDateKey);
        window.dispatchEvent(
          new CustomEvent(LOCAL_DAY_CHANGED_EVENT, {
            detail: { dateKey: nextDateKey },
          }),
        );
      }
      schedule();
    }

    function schedule() {
      if (timeoutId) window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(checkDate, nextLocalMidnightDelayMs());
    }

    function onVisibilityChange() {
      if (document.visibilityState === "visible") checkDate();
    }

    window.addEventListener("focus", checkDate);
    window.addEventListener("pageshow", checkDate);
    document.addEventListener("visibilitychange", onVisibilityChange);
    schedule();

    return () => {
      if (timeoutId) window.clearTimeout(timeoutId);
      window.removeEventListener("focus", checkDate);
      window.removeEventListener("pageshow", checkDate);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  return dateKey;
}
