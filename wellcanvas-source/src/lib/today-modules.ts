export type TodayModulesVisibility = {
  nutrition: boolean;
  activity: boolean;
  personalTrackers: boolean;
};

export const TODAY_MODULES_STORAGE_KEY = "health-tracker-pwa.today-modules.v1";

export const DEFAULT_TODAY_MODULES: TodayModulesVisibility = {
  nutrition: true,
  activity: true,
  personalTrackers: true,
};

function canUseStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

export function normalizeTodayModules(
  value: Partial<TodayModulesVisibility> | null | undefined,
): TodayModulesVisibility {
  return {
    nutrition: isBoolean(value?.nutrition)
      ? value.nutrition
      : DEFAULT_TODAY_MODULES.nutrition,
    activity: isBoolean(value?.activity)
      ? value.activity
      : DEFAULT_TODAY_MODULES.activity,
    personalTrackers: isBoolean(value?.personalTrackers)
      ? value.personalTrackers
      : DEFAULT_TODAY_MODULES.personalTrackers,
  };
}

export function readTodayModulesVisibility(): TodayModulesVisibility {
  if (!canUseStorage()) return DEFAULT_TODAY_MODULES;
  try {
    return normalizeTodayModules(
      JSON.parse(window.localStorage.getItem(TODAY_MODULES_STORAGE_KEY) ?? "null"),
    );
  } catch {
    return DEFAULT_TODAY_MODULES;
  }
}

export function saveTodayModulesVisibility(value: TodayModulesVisibility) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(
    TODAY_MODULES_STORAGE_KEY,
    JSON.stringify(normalizeTodayModules(value)),
  );
}
