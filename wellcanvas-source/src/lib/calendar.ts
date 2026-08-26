import { localDateKey } from "@/lib/food-log";

export type WeekStartsOn = "monday" | "sunday";

export type CalendarPreferences = {
  weekStartsOn: WeekStartsOn;
  updatedAt: string;
};

export const CALENDAR_PREFERENCES_STORAGE_KEY =
  "health-tracker-pwa.calendar-preferences.v1";

export const DEFAULT_CALENDAR_PREFERENCES: CalendarPreferences = {
  weekStartsOn: "monday",
  updatedAt: "",
};

function canUseStorage() {
  return typeof window !== "undefined";
}

export function readCalendarPreferences(): CalendarPreferences {
  if (!canUseStorage()) return DEFAULT_CALENDAR_PREFERENCES;

  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(CALENDAR_PREFERENCES_STORAGE_KEY) ?? "null",
    ) as Partial<CalendarPreferences> | null;
    return {
      weekStartsOn: parsed?.weekStartsOn === "sunday" ? "sunday" : "monday",
      updatedAt: parsed?.updatedAt || "",
    };
  } catch {
    return DEFAULT_CALENDAR_PREFERENCES;
  }
}

export function saveCalendarPreferences(preferences: CalendarPreferences) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(
    CALENDAR_PREFERENCES_STORAGE_KEY,
    JSON.stringify(preferences),
  );
  window.dispatchEvent(new CustomEvent("health-tracker:calendar-preferences-changed"));
}

export function weekStart(dateKey = localDateKey(), weekStartsOn: WeekStartsOn = "monday") {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day, 12);
  const weekday = date.getDay();
  const offset =
    weekStartsOn === "sunday" ? weekday : (weekday + 6) % 7;
  date.setDate(date.getDate() - offset);
  return localDateKey(date);
}

export function addLocalDays(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day, 12);
  date.setDate(date.getDate() + days);
  return localDateKey(date);
}

export function nextLocalMidnightDelayMs(date = new Date()) {
  const nextMidnight = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + 1,
    0,
    0,
    1,
    0,
  );
  return Math.max(nextMidnight.getTime() - date.getTime(), 1000);
}
