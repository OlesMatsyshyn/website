import {
  addDays,
  weekStart,
} from "@/lib/activity";
import { addLocalDays } from "@/lib/calendar";
import { type WeekStartsOn } from "@/lib/calendar";
import {
  currentLocalTime,
  localDateKey,
  makeId,
} from "@/lib/food-log";

export type TrackerKind = "goal" | "upper-limit" | "log-only";
export type TrackerPeriod = "day" | "week" | "month";
export type TrackerAggregation = "sum" | "average" | "latest" | "count";

export type CustomTracker = {
  id: string;
  name: string;
  shortName: string;
  unit: string;
  kind: TrackerKind;
  period: TrackerPeriod;
  aggregation: TrackerAggregation;
  targetValue: number | null;
  rangeMinimum: number | null;
  rangeMaximum: number | null;
  quickIncrement: number;
  decimalPlaces: number;
  iconKey:
    | "walking"
    | "sleep"
    | "activity"
    | "caffeine"
    | "smoking"
    | "alcohol"
    | "timer"
    | "heart"
    | "custom";
  colourKey:
    | "accent"
    | "blue"
    | "green"
    | "amber"
    | "violet"
    | "neutral";
  notes: string;
  isPinnedToToday: boolean;
  isEnabled: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
};

export type CustomTrackerEntry = {
  id: string;
  trackerId: string;
  date: string;
  time: string;
  value: number;
  note: string;
  occurredAt: string;
  createdAt: string;
  updatedAt: string;
};

export type TrackerPeriodSummary = {
  trackerId: string;
  periodType: TrackerPeriod;
  periodStart: string;
  periodEnd: string;
  value: number | null;
  entryCount: number;
  entries: CustomTrackerEntry[];
};

export type TrackerTemplate = {
  label: string;
  description: string;
  tracker: Omit<CustomTracker, "id" | "createdAt" | "updatedAt" | "order">;
};

export const CUSTOM_TRACKERS_STORAGE_KEY =
  "health-tracker-pwa.custom-trackers.v1";
export const CUSTOM_TRACKER_ENTRIES_STORAGE_KEY =
  "health-tracker-pwa.custom-tracker-entries.v1";
export const CUSTOM_TRACKERS_CHANGED_EVENT =
  "health-tracker:custom-trackers-changed";

export const trackerKindLabels: Record<TrackerKind, string> = {
  goal: "Goal",
  "upper-limit": "Upper limit",
  "log-only": "Log only",
};

export const trackerPeriodLabels: Record<TrackerPeriod, string> = {
  day: "Daily",
  week: "Weekly",
  month: "Monthly",
};

export const trackerAggregationLabels: Record<TrackerAggregation, string> = {
  sum: "Sum",
  average: "Average",
  latest: "Latest",
  count: "Count",
};

function canUseStorage() {
  return typeof window !== "undefined";
}

function readJson<T>(key: string, fallback: T): T {
  if (!canUseStorage()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function saveJson<T>(key: string, value: T) {
  if (canUseStorage()) {
    window.localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent(CUSTOM_TRACKERS_CHANGED_EVENT));
  }
}

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isDateKey(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function normalizeTime(value: unknown) {
  return typeof value === "string" && /^\d{2}:\d{2}/.test(value)
    ? value.slice(0, 5)
    : "00:00";
}

function dateTimeToIso(date: string, time: string) {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  return new Date(year, month - 1, day, hour || 0, minute || 0, 0, 0).toISOString();
}

function dateKeyFromIso(value: unknown) {
  if (typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : localDateKey(date);
}

function timeFromIso(value: unknown) {
  if (typeof value !== "string") return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes(),
  ).padStart(2, "0")}`;
}

function normalizeTracker(value: Partial<CustomTracker>): CustomTracker | null {
  if (!value.id || !value.name) return null;
  const now = new Date().toISOString();
  return {
    id: value.id,
    name: value.name,
    shortName: value.shortName || value.name,
    unit: value.unit ?? "",
    kind:
      value.kind === "upper-limit" || value.kind === "log-only"
        ? value.kind
        : "goal",
    period:
      value.period === "week" || value.period === "month"
        ? value.period
        : "day",
    aggregation:
      value.aggregation === "average" ||
      value.aggregation === "latest" ||
      value.aggregation === "count"
        ? value.aggregation
        : "sum",
    targetValue:
      finiteNumber(value.targetValue) && value.targetValue >= 0
        ? value.targetValue
        : null,
    rangeMinimum:
      finiteNumber(value.rangeMinimum) && value.rangeMinimum >= 0
        ? value.rangeMinimum
        : null,
    rangeMaximum:
      finiteNumber(value.rangeMaximum) && value.rangeMaximum >= 0
        ? value.rangeMaximum
        : null,
    quickIncrement:
      finiteNumber(value.quickIncrement) && value.quickIncrement >= 0
        ? value.quickIncrement
        : 1,
    decimalPlaces:
      finiteNumber(value.decimalPlaces)
        ? Math.min(Math.max(Math.round(value.decimalPlaces), 0), 3)
        : 0,
    iconKey:
      value.iconKey === "sleep" ||
      value.iconKey === "activity" ||
      value.iconKey === "caffeine" ||
      value.iconKey === "smoking" ||
      value.iconKey === "alcohol" ||
      value.iconKey === "timer" ||
      value.iconKey === "heart" ||
      value.iconKey === "custom"
        ? value.iconKey
        : "walking",
    colourKey:
      value.colourKey === "blue" ||
      value.colourKey === "green" ||
      value.colourKey === "amber" ||
      value.colourKey === "violet" ||
      value.colourKey === "neutral"
        ? value.colourKey
        : "accent",
    notes: value.notes ?? "",
    isPinnedToToday: value.isPinnedToToday !== false,
    isEnabled: value.isEnabled !== false,
    order: finiteNumber(value.order) ? value.order : 0,
    createdAt: value.createdAt || now,
    updatedAt: value.updatedAt || now,
  };
}

function normalizeEntry(value: Partial<CustomTrackerEntry>) {
  if (!value.id || !value.trackerId) return null;
  const now = new Date().toISOString();
  const date =
    isDateKey(value.date) || value.date === ""
      ? value.date || dateKeyFromIso(value.occurredAt) || dateKeyFromIso(value.createdAt) || localDateKey()
      : dateKeyFromIso(value.occurredAt) || dateKeyFromIso(value.createdAt) || localDateKey();
  const time =
    normalizeTime(value.time) !== "00:00"
      ? normalizeTime(value.time)
      : timeFromIso(value.occurredAt) || normalizeTime(value.time);
  const occurredAt = value.occurredAt || dateTimeToIso(date, time);
  return {
    id: value.id,
    trackerId: value.trackerId,
    date,
    time,
    value: finiteNumber(value.value) && value.value >= 0 ? value.value : 0,
    note: value.note || "",
    occurredAt,
    createdAt: value.createdAt || now,
    updatedAt: value.updatedAt || now,
  } satisfies CustomTrackerEntry;
}

export function readCustomTrackers() {
  return readJson<Partial<CustomTracker>[]>(CUSTOM_TRACKERS_STORAGE_KEY, [])
    .map(normalizeTracker)
    .filter((tracker): tracker is CustomTracker => Boolean(tracker))
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
}

export function saveCustomTrackers(trackers: CustomTracker[]) {
  saveJson(CUSTOM_TRACKERS_STORAGE_KEY, trackers);
}

export function readCustomTrackerEntries() {
  return readJson<Partial<CustomTrackerEntry>[]>(
    CUSTOM_TRACKER_ENTRIES_STORAGE_KEY,
    [],
  )
    .map(normalizeEntry)
    .filter((entry): entry is CustomTrackerEntry => Boolean(entry));
}

export function saveCustomTrackerEntries(entries: CustomTrackerEntry[]) {
  saveJson(CUSTOM_TRACKER_ENTRIES_STORAGE_KEY, entries);
}

export function entryDateKey(entry: CustomTrackerEntry) {
  return dateKeyFromIso(entry.occurredAt) || entry.date;
}

export function entryTimeKey(entry: CustomTrackerEntry) {
  return timeFromIso(entry.occurredAt) || entry.time;
}

export function makeTrackerOccurredAt(date: string, time: string) {
  return dateTimeToIso(date, normalizeTime(time));
}

export function trackerPeriodBounds(
  period: TrackerPeriod,
  dateKey = localDateKey(),
  weekStartsOn: WeekStartsOn = "monday",
) {
  if (period === "day") {
    return { start: dateKey, end: dateKey };
  }
  if (period === "month") {
    const [year, month] = dateKey.split("-").map(Number);
    const start = `${year}-${String(month).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    return { start, end: addLocalDays(start, lastDay - 1) };
  }
  const start = weekStart(dateKey, weekStartsOn);
  return { start, end: addDays(start, 6) };
}

export function periodDateForEntry(entry: CustomTrackerEntry) {
  return entryDateKey(entry);
}

export function trackerPeriodSummaryForDate(
  tracker: CustomTracker,
  entries: CustomTrackerEntry[],
  dateKey = localDateKey(),
  weekStartsOn: WeekStartsOn = "monday",
): TrackerPeriodSummary {
  const bounds = trackerPeriodBounds(tracker.period, dateKey, weekStartsOn);
  const periodEntries = entries.filter((entry) => {
    if (entry.trackerId !== tracker.id) return false;
    const entryDate = periodDateForEntry(entry);
    return entryDate >= bounds.start && entryDate <= bounds.end;
  });
  return {
    trackerId: tracker.id,
    periodType: tracker.period,
    periodStart: bounds.start,
    periodEnd: bounds.end,
    value: aggregateTrackerValue(tracker, periodEntries),
    entryCount: periodEntries.length,
    entries: periodEntries,
  };
}

export function trackerPeriodSummaries(
  tracker: CustomTracker,
  entries: CustomTrackerEntry[],
  dateKey = localDateKey(),
  weekStartsOn: WeekStartsOn = "monday",
) {
  const summaries = new Map<string, TrackerPeriodSummary>();
  const current = trackerPeriodSummaryForDate(tracker, entries, dateKey, weekStartsOn);
  summaries.set(current.periodStart, current);

  entries
    .filter((entry) => entry.trackerId === tracker.id)
    .forEach((entry) => {
      const summary = trackerPeriodSummaryForDate(
        tracker,
        entries,
        periodDateForEntry(entry),
        weekStartsOn,
      );
      summaries.set(summary.periodStart, summary);
    });

  return [...summaries.values()].sort((a, b) =>
    b.periodStart.localeCompare(a.periodStart),
  );
}

export function entriesForTrackerPeriod(
  tracker: CustomTracker,
  entries: CustomTrackerEntry[],
  dateKey = localDateKey(),
  weekStartsOn: WeekStartsOn = "monday",
) {
  return trackerPeriodSummaryForDate(tracker, entries, dateKey, weekStartsOn).entries;
}

export function aggregateTrackerValue(
  tracker: CustomTracker,
  entries: CustomTrackerEntry[],
) {
  if (entries.length === 0) return null;
  if (tracker.aggregation === "count") return entries.length;
  if (tracker.aggregation === "latest") {
    return [...entries].sort((a, b) =>
      `${entryDateKey(b)} ${entryTimeKey(b)}`.localeCompare(
        `${entryDateKey(a)} ${entryTimeKey(a)}`,
      ),
    )[0].value;
  }
  const total = entries.reduce((sum, entry) => sum + entry.value, 0);
  if (tracker.aggregation === "average") return total / entries.length;
  return total;
}

export function formatTrackerValue(
  value: number | null,
  tracker: Pick<CustomTracker, "decimalPlaces">,
) {
  if (value === null) return "—";
  return value.toLocaleString(undefined, {
    maximumFractionDigits: tracker.decimalPlaces,
    minimumFractionDigits: tracker.decimalPlaces,
  });
}

export function addCustomTrackerEntry({
  date = localDateKey(),
  note = "",
  time = currentLocalTime(),
  trackerId,
  value,
}: {
  date?: string;
  note?: string;
  time?: string;
  trackerId: string;
  value: number;
}) {
  const now = new Date().toISOString();
  const entry: CustomTrackerEntry = {
    id: makeId("tracker-entry"),
    trackerId,
    date,
    time,
    value,
    note,
    occurredAt: makeTrackerOccurredAt(date, time),
    createdAt: now,
    updatedAt: now,
  };
  saveCustomTrackerEntries([...readCustomTrackerEntries(), entry]);
  return entry;
}

export function updateCustomTrackerEntry(updatedEntry: CustomTrackerEntry) {
  const now = new Date().toISOString();
  saveCustomTrackerEntries(
    readCustomTrackerEntries().map((entry) =>
      entry.id === updatedEntry.id
        ? {
            ...updatedEntry,
            occurredAt: makeTrackerOccurredAt(updatedEntry.date, updatedEntry.time),
            updatedAt: now,
          }
        : entry,
    ),
  );
}

export function deleteCustomTrackerEntry(id: string) {
  saveCustomTrackerEntries(
    readCustomTrackerEntries().filter((entry) => entry.id !== id),
  );
}

export function makeTrackerFromTemplate(template: TrackerTemplate, order: number) {
  const now = new Date().toISOString();
  return {
    ...template.tracker,
    id: makeId("tracker"),
    order,
    createdAt: now,
    updatedAt: now,
  } satisfies CustomTracker;
}

export const trackerTemplates: TrackerTemplate[] = [
  {
    label: "Walking / steps",
    description: "Daily step goal example.",
    tracker: {
      name: "Walking",
      shortName: "Steps",
      unit: "steps",
      kind: "goal",
      period: "day",
      aggregation: "sum",
      targetValue: 10000,
      rangeMinimum: null,
      rangeMaximum: null,
      quickIncrement: 2000,
      decimalPlaces: 0,
      iconKey: "walking",
      colourKey: "accent",
      notes: "",
      isPinnedToToday: true,
      isEnabled: true,
    },
  },
  {
    label: "Sleep",
    description: "Daily latest sleep duration.",
    tracker: {
      name: "Sleep",
      shortName: "Sleep",
      unit: "hours",
      kind: "goal",
      period: "day",
      aggregation: "latest",
      targetValue: 8,
      rangeMinimum: null,
      rangeMaximum: null,
      quickIncrement: 0.5,
      decimalPlaces: 1,
      iconKey: "sleep",
      colourKey: "blue",
      notes: "",
      isPinnedToToday: true,
      isEnabled: true,
    },
  },
  {
    label: "Weekly workouts",
    description: "Manual weekly session count.",
    tracker: {
      name: "Weekly workouts",
      shortName: "Workouts",
      unit: "sessions",
      kind: "goal",
      period: "week",
      aggregation: "count",
      targetValue: 3,
      rangeMinimum: null,
      rangeMaximum: null,
      quickIncrement: 1,
      decimalPlaces: 0,
      iconKey: "activity",
      colourKey: "green",
      notes: "",
      isPinnedToToday: true,
      isEnabled: true,
    },
  },
  {
    label: "Caffeine limit",
    description: "Daily upper-limit tracker.",
    tracker: {
      name: "Caffeine",
      shortName: "Caffeine",
      unit: "mg",
      kind: "upper-limit",
      period: "day",
      aggregation: "sum",
      targetValue: null,
      rangeMinimum: null,
      rangeMaximum: null,
      quickIncrement: 50,
      decimalPlaces: 0,
      iconKey: "caffeine",
      colourKey: "amber",
      notes: "",
      isPinnedToToday: true,
      isEnabled: true,
    },
  },
  {
    label: "Cigarette reduction",
    description: "Weekly reduction or abstinence tracking.",
    tracker: {
      name: "Cigarettes",
      shortName: "Cigarettes",
      unit: "cigarettes",
      kind: "upper-limit",
      period: "week",
      aggregation: "sum",
      targetValue: 0,
      rangeMinimum: null,
      rangeMaximum: null,
      quickIncrement: 1,
      decimalPlaces: 0,
      iconKey: "smoking",
      colourKey: "neutral",
      notes: "",
      isPinnedToToday: false,
      isEnabled: true,
    },
  },
  {
    label: "Alcohol reduction",
    description: "Weekly reduction or abstinence tracking.",
    tracker: {
      name: "Alcohol",
      shortName: "Alcohol",
      unit: "drinks",
      kind: "upper-limit",
      period: "week",
      aggregation: "sum",
      targetValue: 0,
      rangeMinimum: null,
      rangeMaximum: null,
      quickIncrement: 1,
      decimalPlaces: 1,
      iconKey: "alcohol",
      colourKey: "neutral",
      notes: "",
      isPinnedToToday: false,
      isEnabled: true,
    },
  },
];
