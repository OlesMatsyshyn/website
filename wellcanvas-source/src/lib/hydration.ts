import {
  currentLocalTime,
  emptyLoggedNutrition,
  localDateKey,
  makeId,
  nutrientKeys,
  type LoggedNutrition,
} from "@/lib/food-log";
import type { NutritionStatus } from "@/lib/food-library";

export type BeverageType =
  | "tap-water"
  | "still-water"
  | "sparkling-water"
  | "sweet-soda"
  | "zero-soda"
  | "other";

export type HydrationEntry = {
  id: string;
  date: string;
  time: string;
  beverageType: BeverageType;
  displayName: string;
  volumeMl: number;
  caloriesKcal: number | null;
  carbohydratesG: number | null;
  sodiumMg: number | null;
  nutritionStatus: NutritionStatus;
  uncertaintyPercent: number | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type HydrationPreferences = {
  targetMode: "general" | "custom";
  targetMl: number;
  showGeneralRange: boolean;
  updatedAt: string;
};

export const HYDRATION_ENTRIES_STORAGE_KEY =
  "health-tracker-pwa.hydration-entries.v1";
export const HYDRATION_PREFERENCES_STORAGE_KEY =
  "health-tracker-pwa.hydration-preferences.v1";
export const HYDRATION_CHANGED_EVENT = "health-tracker:hydration-changed";

export const DEFAULT_HYDRATION_PREFERENCES: HydrationPreferences = {
  targetMode: "general",
  targetMl: 2000,
  showGeneralRange: true,
  updatedAt: "",
};

export const beverageLabels: Record<BeverageType, string> = {
  "tap-water": "Tap water",
  "still-water": "Still water",
  "sparkling-water": "Sparkling water",
  "sweet-soda": "Sweet soda",
  "zero-soda": "Zero soda",
  other: "Other drink",
};

export const plainWaterTypes: BeverageType[] = [
  "tap-water",
  "still-water",
  "sparkling-water",
];

function canUseStorage() {
  return typeof window !== "undefined";
}

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
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
    window.dispatchEvent(new CustomEvent(HYDRATION_CHANGED_EVENT));
  }
}

function isBeverageType(value: unknown): value is BeverageType {
  return (
    value === "tap-water" ||
    value === "still-water" ||
    value === "sparkling-water" ||
    value === "sweet-soda" ||
    value === "zero-soda" ||
    value === "other"
  );
}

function normalizeEntry(entry: Partial<HydrationEntry>): HydrationEntry | null {
  if (!entry.id || !entry.date || !entry.time || !finiteNumber(entry.volumeMl)) {
    return null;
  }

  const beverageType = isBeverageType(entry.beverageType)
    ? entry.beverageType
    : "other";
  const nutritionStatus =
    entry.nutritionStatus === "official" ||
    entry.nutritionStatus === "estimated" ||
    entry.nutritionStatus === "user-confirmed"
      ? entry.nutritionStatus
      : "missing";

  return {
    id: entry.id,
    date: entry.date,
    time: entry.time,
    beverageType,
    displayName: entry.displayName || beverageLabels[beverageType],
    volumeMl: entry.volumeMl,
    caloriesKcal: finiteNumber(entry.caloriesKcal) ? entry.caloriesKcal : null,
    carbohydratesG: finiteNumber(entry.carbohydratesG)
      ? entry.carbohydratesG
      : null,
    sodiumMg: finiteNumber(entry.sodiumMg) ? entry.sodiumMg : null,
    nutritionStatus,
    uncertaintyPercent: finiteNumber(entry.uncertaintyPercent)
      ? entry.uncertaintyPercent
      : null,
    notes: entry.notes || "",
    createdAt: entry.createdAt || new Date().toISOString(),
    updatedAt: entry.updatedAt || new Date().toISOString(),
  };
}

export function readHydrationEntries() {
  return readJson<Partial<HydrationEntry>[]>(HYDRATION_ENTRIES_STORAGE_KEY, [])
    .map(normalizeEntry)
    .filter((entry): entry is HydrationEntry => Boolean(entry))
    .sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`));
}

export function saveHydrationEntries(entries: HydrationEntry[]) {
  saveJson(HYDRATION_ENTRIES_STORAGE_KEY, entries);
}

export function addHydrationEntry(entry: HydrationEntry) {
  const entries = [entry, ...readHydrationEntries()];
  saveHydrationEntries(entries);
  return entries;
}

export function updateHydrationEntry(entry: HydrationEntry) {
  const now = new Date().toISOString();
  const entries = readHydrationEntries().map((current) =>
    current.id === entry.id ? { ...entry, updatedAt: now } : current,
  );
  saveHydrationEntries(entries);
  return entries;
}

export function deleteHydrationEntry(id: string) {
  const entries = readHydrationEntries().filter((entry) => entry.id !== id);
  saveHydrationEntries(entries);
  return entries;
}

export function hydrationEntriesForDate(date: string) {
  return readHydrationEntries().filter((entry) => entry.date === date);
}

export function readHydrationPreferences() {
  return {
    ...DEFAULT_HYDRATION_PREFERENCES,
    ...readJson<Partial<HydrationPreferences>>(HYDRATION_PREFERENCES_STORAGE_KEY, {}),
  };
}

export function saveHydrationPreferences(preferences: HydrationPreferences) {
  saveJson(HYDRATION_PREFERENCES_STORAGE_KEY, preferences);
}

export function beverageNutritionForVolume(
  beverageType: BeverageType,
  volumeMl: number,
  overrides?: {
    caloriesKcal?: number | null;
    carbohydratesG?: number | null;
    sodiumMg?: number | null;
    displayName?: string;
    nutritionStatus?: NutritionStatus;
    notes?: string;
  },
) {
  const factor = volumeMl / 100;

  if (plainWaterTypes.includes(beverageType)) {
    return {
      displayName: beverageLabels[beverageType],
      caloriesKcal: 0,
      carbohydratesG: 0,
      sodiumMg: 0,
      nutritionStatus: "user-confirmed" as const,
      uncertaintyPercent: null,
      notes: "",
    };
  }

  if (beverageType === "sweet-soda") {
    return {
      displayName: "Sweet soda",
      caloriesKcal: Math.round(42 * factor * 10) / 10,
      carbohydratesG: Math.round(10.5 * factor * 10) / 10,
      sodiumMg: Math.round(5 * factor),
      nutritionStatus: "estimated" as const,
      uncertaintyPercent: 20,
      notes: "Generic sweet soda estimate: 42 kcal, 10.5 g carbohydrate and 5 mg sodium per 100 ml.",
    };
  }

  if (beverageType === "zero-soda") {
    return {
      displayName: "Zero soda",
      caloriesKcal: 0,
      carbohydratesG: 0,
      sodiumMg: null,
      nutritionStatus: "estimated" as const,
      uncertaintyPercent: 20,
      notes: "Generic zero-soda estimate. Sodium is left unknown unless corrected.",
    };
  }

  return {
    displayName: overrides?.displayName?.trim() || "Other drink",
    caloriesKcal: overrides?.caloriesKcal ?? null,
    carbohydratesG: overrides?.carbohydratesG ?? null,
    sodiumMg: overrides?.sodiumMg ?? null,
    nutritionStatus: overrides?.nutritionStatus ?? "missing",
    uncertaintyPercent: overrides?.nutritionStatus === "estimated" ? 30 : null,
    notes: overrides?.notes?.trim() || "",
  };
}

export function createHydrationEntry({
  beverageType,
  date = localDateKey(),
  manualNutrition,
  time = currentLocalTime(),
  volumeMl,
}: {
  beverageType: BeverageType;
  date?: string;
  manualNutrition?: Parameters<typeof beverageNutritionForVolume>[2];
  time?: string;
  volumeMl: number;
}) {
  const now = new Date().toISOString();
  const nutrition = beverageNutritionForVolume(
    beverageType,
    volumeMl,
    manualNutrition,
  );

  return {
    id: makeId("hydration"),
    date,
    time,
    beverageType,
    displayName: nutrition.displayName,
    volumeMl,
    caloriesKcal: nutrition.caloriesKcal,
    carbohydratesG: nutrition.carbohydratesG,
    sodiumMg: nutrition.sodiumMg,
    nutritionStatus: nutrition.nutritionStatus,
    uncertaintyPercent: nutrition.uncertaintyPercent,
    notes: nutrition.notes,
    createdAt: now,
    updatedAt: now,
  } satisfies HydrationEntry;
}

export function plainWaterMl(entries: HydrationEntry[]) {
  return entries
    .filter((entry) => plainWaterTypes.includes(entry.beverageType))
    .reduce((total, entry) => total + entry.volumeMl, 0);
}

export function totalFluidMl(entries: HydrationEntry[]) {
  return entries.reduce((total, entry) => total + entry.volumeMl, 0);
}

export function hydrationNutrition(entries: HydrationEntry[]) {
  const totals: LoggedNutrition = {
    ...emptyLoggedNutrition,
    proteinG: 0,
    totalFatG: 0,
    saturatedFatG: 0,
    fibreG: 0,
  };
  const incomplete = Object.fromEntries(nutrientKeys.map((key) => [key, false])) as Record<
    keyof LoggedNutrition,
    boolean
  >;
  let hasEstimated = false;

  for (const entry of entries) {
    if (entry.nutritionStatus === "estimated") {
      hasEstimated = true;
    }

    const values = {
      caloriesKcal: entry.caloriesKcal,
      proteinG: 0,
      carbohydratesG: entry.carbohydratesG,
      totalFatG: 0,
      saturatedFatG: 0,
      fibreG: 0,
      sodiumMg: entry.sodiumMg,
    } satisfies LoggedNutrition;

    for (const key of nutrientKeys) {
      const value = values[key];
      if (value === null) {
        incomplete[key] = true;
      } else {
        totals[key] = (totals[key] ?? 0) + value;
      }
    }
  }

  return {
    totals,
    incomplete,
    hasIncomplete: Object.values(incomplete).some(Boolean),
    hasEstimated,
  };
}

export function combineNutritionSums(
  first: ReturnType<typeof hydrationNutrition>,
  second: ReturnType<typeof hydrationNutrition>,
) {
  const totals = { ...emptyLoggedNutrition };
  const incomplete = Object.fromEntries(nutrientKeys.map((key) => [key, false])) as Record<
    keyof LoggedNutrition,
    boolean
  >;

  for (const key of nutrientKeys) {
    const firstValue = first.totals[key];
    const secondValue = second.totals[key];
    totals[key] =
      firstValue === null && secondValue === null
        ? null
        : (firstValue ?? 0) + (secondValue ?? 0);
    incomplete[key] = first.incomplete[key] || second.incomplete[key];
  }

  return {
    totals,
    incomplete,
    hasIncomplete: Object.values(incomplete).some(Boolean),
    hasEstimated: first.hasEstimated || second.hasEstimated,
  };
}
