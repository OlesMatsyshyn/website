"use client";

import { useEffect, useMemo, useRef, useState, type Ref } from "react";
import {
  BuildPlateForm,
  QuickEstimateForm,
  QuickSnackForm,
} from "@/components/meal-composers";
import { PageHeader } from "@/components/page-header";
import { ToastBridge } from "@/components/toast";
import { WellCanvasIcon } from "@/components/wellcanvas-icon";
import type { DailyFortune } from "@/data/daily-fortunes";
import { LOCAL_DAY_CHANGED_EVENT } from "@/hooks/use-local-calendar-clock";
import {
  addLocalDays,
  CALENDAR_PREFERENCES_STORAGE_KEY,
  DEFAULT_CALENDAR_PREFERENCES,
  readCalendarPreferences,
  weekStart,
  type CalendarPreferences,
} from "@/lib/calendar";
import {
  getRevealedDailyFortune,
  revealDailyFortune,
  syncDailyFortuneDate,
} from "@/lib/daily-fortune";
import {
  addFoodLogEntry,
  createLogEntryFromFood,
  createLogEntryFromMeal,
  currentLocalTime,
  deleteFoodLogEntry,
  entriesForDate,
  FOOD_LOG_CHANGED_EVENT,
  FOOD_LOG_STORAGE_KEY,
  inferMealType,
  localDateKey,
  mealTypeLabel,
  makeId,
  readFoodLogEntries,
  recentLogSources,
  rescaleLogEntry,
  sumKnownNutrition,
  updateFoodLogEntry,
  type FoodLogEntry,
  type LoggedNutrition,
} from "@/lib/food-log";
import {
  DEFAULT_NUTRITION_TARGETS,
  isNutritionTargets,
  NUTRITION_TARGETS_CHANGED_EVENT,
  NUTRITION_TARGETS_STORAGE_KEY,
  type NutritionTargets,
} from "@/lib/nutrition-targets";
import {
  readFoodItems,
  readMealTemplates,
  saveFoodItems,
  saveMealTemplates,
  syncInstalledSeedPack,
  calculateMealNutrition,
  collectionForFood,
  collectionForMeal,
  sortCollectionNames,
  type FoodItem,
  type MealTemplate,
  type NutritionStatus,
  type NutritionValues,
} from "@/lib/food-library";
import {
  normalizeFoodSearchText,
  scoreFoodSearchCandidate,
} from "@/lib/food-search";
import {
  DEFAULT_PROFILE,
  readProfile,
  type UserProfile,
} from "@/lib/personalization";
import {
  ACTIVITY_CHANGED_EVENT,
  ACTIVITY_ENTRIES_STORAGE_KEY,
  ACTIVITY_PREFERENCES_STORAGE_KEY,
  DEFAULT_ACTIVITY_PREFERENCES,
  addActivityEntry,
  activityEntriesForDate,
  activityEntriesForWeek,
  activityTypeLabels,
  estimateActiveCalories,
  generateActivityInsights,
  intensityLabels,
  readActivityPreferences,
  sumActiveMinutes,
  sumEstimatedActiveCalories,
  weightForActivity,
  weeklyActivitySummary,
  type ActivityEntry,
  type ActivityIntensity,
  type ActivityType,
} from "@/lib/activity";
import {
  aggregateTrackerValue,
  CUSTOM_TRACKER_ENTRIES_STORAGE_KEY,
  CUSTOM_TRACKERS_CHANGED_EVENT,
  CUSTOM_TRACKERS_STORAGE_KEY,
  deleteCustomTrackerEntry,
  entryDateKey,
  entryTimeKey,
  entriesForTrackerPeriod,
  formatTrackerValue,
  makeTrackerOccurredAt,
  readCustomTrackerEntries,
  readCustomTrackers,
  saveCustomTrackerEntries,
  saveCustomTrackers,
  trackerPeriodSummaries,
  trackerPeriodSummaryForDate,
  updateCustomTrackerEntry,
  trackerAggregationLabels,
  trackerKindLabels,
  trackerPeriodLabels,
  type CustomTracker,
  type CustomTrackerEntry,
  type TrackerPeriodSummary,
  type TrackerAggregation,
  type TrackerKind,
  type TrackerPeriod,
} from "@/lib/custom-trackers";
import {
  HYDRATION_CHANGED_EVENT,
  HYDRATION_ENTRIES_STORAGE_KEY,
  HYDRATION_PREFERENCES_STORAGE_KEY,
  addHydrationEntry,
  beverageLabels,
  createHydrationEntry,
  DEFAULT_HYDRATION_PREFERENCES,
  deleteHydrationEntry,
  hydrationEntriesForDate,
  hydrationNutrition,
  plainWaterMl,
  readHydrationPreferences,
  totalFluidMl,
  updateHydrationEntry,
  type BeverageType,
  type HydrationEntry,
  type HydrationPreferences,
} from "@/lib/hydration";
import {
  DEFAULT_TODAY_MODULES,
  readTodayModulesVisibility,
  saveTodayModulesVisibility,
  TODAY_MODULES_STORAGE_KEY,
  type TodayModulesVisibility,
} from "@/lib/today-modules";

const mealTypes: FoodLogEntry["mealType"][] = [
  "breakfast",
  "lunch",
  "dinner",
  "snack",
];

type AddFoodTab = "library" | "plate" | "estimate" | "new-food";
type SaveState = "idle" | "saving" | "saved";
const ACTIVITY_INSIGHT_DISMISSED_PREFIX =
  "health-tracker-pwa.activity-insight-dismissed";

type AddFoodModalState = {
  mealType: FoodLogEntry["mealType"];
  mealTypeWasPreset: boolean;
  tab: AddFoodTab;
};

const emptyNutritionDraft: Record<keyof NutritionValues, string> = {
  caloriesKcal: "",
  proteinG: "",
  carbohydratesG: "",
  totalFatG: "",
  saturatedFatG: "",
  sugarsG: "",
  fibreG: "",
  sodiumMg: "",
};

const DISPLAY_LOCALE = "en-SG";
const INITIAL_TODAY_KEY = "1970-01-01";

function currentLocalDateLabel() {
  return new Intl.DateTimeFormat(DISPLAY_LOCALE, {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date());
}

function currentGreetingDayPart() {
  const hour = new Date().getHours();
  return hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
}

function formatNumber(value: number | null | undefined, maximumFractionDigits = 1) {
  return typeof value === "number" && Number.isFinite(value)
    ? value.toLocaleString(undefined, { maximumFractionDigits })
    : "—";
}

function formatCalories(
  value: number | null | undefined,
  hasEstimated: boolean,
) {
  const formatted = formatNumber(value, 0);
  return formatted === "—" ? formatted : `${hasEstimated ? "≈ " : ""}${formatted}`;
}

function statusClasses(status: NutritionStatus) {
  if (status === "official") return "bg-emerald-50 text-emerald-800";
  if (status === "user-confirmed") return "bg-sky-50 text-sky-800";
  if (status === "estimated") return "bg-amber-50 text-amber-800";
  return "bg-stone-100 text-stone-700";
}

function statusLabel(status: NutritionStatus) {
  if (status === "official") return "Official";
  if (status === "user-confirmed") return "Confirmed";
  if (status === "estimated") return "Estimated";
  return "Needs nutrition";
}

export default function TodayPage() {
  const [isHydrated, setIsHydrated] = useState(false);
  const [currentDate, setCurrentDate] = useState("Today");
  const [todayKey, setTodayKey] = useState(INITIAL_TODAY_KEY);
  const [greetingDayPart, setGreetingDayPart] = useState("morning");
  const [targets, setTargets] = useState<NutritionTargets>(DEFAULT_NUTRITION_TARGETS);
  const [displayName, setDisplayName] = useState("");
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [entries, setEntries] = useState<FoodLogEntry[]>([]);
  const [hydrationEntries, setHydrationEntries] = useState<HydrationEntry[]>([]);
  const [hydrationPreferences, setHydrationPreferences] =
    useState<HydrationPreferences>(DEFAULT_HYDRATION_PREFERENCES);
  const [activityEntries, setActivityEntries] = useState<ActivityEntry[]>([]);
  const [activityWeekEntries, setActivityWeekEntries] = useState<ActivityEntry[]>([]);
  const [activityPreferences, setActivityPreferences] = useState(
    DEFAULT_ACTIVITY_PREFERENCES,
  );
  const [calendarPreferences, setCalendarPreferences] =
    useState<CalendarPreferences>(DEFAULT_CALENDAR_PREFERENCES);
  const [trackers, setTrackers] = useState<CustomTracker[]>([]);
  const [trackerEntries, setTrackerEntries] = useState<CustomTrackerEntry[]>([]);
  const [trackerModal, setTrackerModal] = useState<
    | null
    | { type: "add" }
    | { type: "entry"; tracker: CustomTracker }
    | { type: "edit"; tracker: CustomTracker }
    | { type: "details"; tracker: CustomTracker }
    | { type: "list" }
  >(null);
  const [trackerUndoEntry, setTrackerUndoEntry] =
    useState<CustomTrackerEntry | null>(null);
  const [trackerAddStates, setTrackerAddStates] = useState<Record<string, SaveState>>(
    {},
  );
  const [allEntries, setAllEntries] = useState<FoodLogEntry[]>([]);
  const [foods, setFoods] = useState<FoodItem[]>([]);
  const [meals, setMeals] = useState<MealTemplate[]>([]);
  const [addFoodModal, setAddFoodModal] = useState<AddFoodModalState | null>(null);
  const [drinkModalEntry, setDrinkModalEntry] = useState<HydrationEntry | null | undefined>();
  const [lastDrinkVolumeMl, setLastDrinkVolumeMl] = useState(250);
  const [editingEntry, setEditingEntry] = useState<FoodLogEntry | null>(null);
  const [detailModal, setDetailModal] = useState<
    | null
    | { type: "ration"; entries: FoodLogEntry[]; title: string }
    | { type: "hydration"; entries: HydrationEntry[]; title: string }
    | { type: "activity"; entries: ActivityEntry[]; title: string }
  >(null);
  const [activityAddOpen, setActivityAddOpen] = useState(false);
  const [activityInsightDismissed, setActivityInsightDismissed] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [undoEntry, setUndoEntry] = useState<FoodLogEntry | null>(null);
  const [undoHydrationEntry, setUndoHydrationEntry] = useState<HydrationEntry | null>(null);
  const [undoMode, setUndoMode] = useState<"add" | "remove" | null>(null);
  const [dailyFortune, setDailyFortune] = useState<DailyFortune | null>(null);
  const [fortuneModalOpen, setFortuneModalOpen] = useState(false);
  const [fortuneCopyState, setFortuneCopyState] = useState<
    "idle" | "copied" | "failed"
  >("idle");
  const [todayModules, setTodayModules] =
    useState<TodayModulesVisibility>(DEFAULT_TODAY_MODULES);
  const [todayCustomizeOpen, setTodayCustomizeOpen] = useState(false);
  const modalTriggerRef = useRef<HTMLElement | null>(null);
  const fortuneButtonRef = useRef<HTMLButtonElement | null>(null);
  const customizeButtonRef = useRef<HTMLButtonElement | null>(null);

  function refresh() {
    const date = localDateKey();
    const nextCalendarPreferences = readCalendarPreferences();
    syncDailyFortuneDate(date);
    setTodayKey(date);
    setCurrentDate(currentLocalDateLabel());
    setGreetingDayPart(currentGreetingDayPart());
    setDailyFortune(getRevealedDailyFortune(date));
    setFortuneCopyState("idle");
    setEntries(entriesForDate(date));
    setHydrationEntries(hydrationEntriesForDate(date));
    setHydrationPreferences(readHydrationPreferences());
    setActivityEntries(activityEntriesForDate(date));
    setActivityWeekEntries(
      activityEntriesForWeek(date, nextCalendarPreferences.weekStartsOn),
    );
    setActivityPreferences(readActivityPreferences());
    setActivityInsightDismissed(
      window.localStorage.getItem(`${ACTIVITY_INSIGHT_DISMISSED_PREFIX}.${date}`) ===
        "true",
    );
    setCalendarPreferences(nextCalendarPreferences);
    setTrackers(readCustomTrackers());
    setTrackerEntries(readCustomTrackerEntries());
    setAllEntries(readFoodLogEntries());
    setFoods(readFoodItems());
    setMeals(readMealTemplates());
    setTodayModules(readTodayModulesVisibility());
    try {
      const savedTargets = JSON.parse(
        window.localStorage.getItem(NUTRITION_TARGETS_STORAGE_KEY) ?? "null",
      );
      setTargets(isNutritionTargets(savedTargets) ? savedTargets : DEFAULT_NUTRITION_TARGETS);
    } catch {
      setTargets(DEFAULT_NUTRITION_TARGETS);
    }
  }

  useEffect(() => {
    queueMicrotask(() => {
      setIsHydrated(true);
      syncInstalledSeedPack();
      setCurrentDate(currentLocalDateLabel());
      const nextProfile = readProfile();
      setProfile(nextProfile);
      setDisplayName(nextProfile.displayName.trim());
      refresh();

      try {
        const savedTargets = JSON.parse(
          window.localStorage.getItem(NUTRITION_TARGETS_STORAGE_KEY) ?? "null",
        );
        if (isNutritionTargets(savedTargets)) {
          setTargets(savedTargets);
        }
      } catch {
        setTargets(DEFAULT_NUTRITION_TARGETS);
      }
    });
  }, []);

  useEffect(() => {
    function handleTrackedDataChange() {
      refresh();
    }

    function handleStorage(event: StorageEvent) {
      if (
        event.key === FOOD_LOG_STORAGE_KEY ||
        event.key === HYDRATION_ENTRIES_STORAGE_KEY ||
        event.key === HYDRATION_PREFERENCES_STORAGE_KEY ||
        event.key === ACTIVITY_ENTRIES_STORAGE_KEY ||
        event.key === ACTIVITY_PREFERENCES_STORAGE_KEY ||
        event.key === CUSTOM_TRACKERS_STORAGE_KEY ||
        event.key === CUSTOM_TRACKER_ENTRIES_STORAGE_KEY ||
        event.key === CALENDAR_PREFERENCES_STORAGE_KEY ||
        event.key === NUTRITION_TARGETS_STORAGE_KEY ||
        event.key === TODAY_MODULES_STORAGE_KEY
      ) {
        refresh();
      }
    }

    window.addEventListener(FOOD_LOG_CHANGED_EVENT, handleTrackedDataChange);
    window.addEventListener(HYDRATION_CHANGED_EVENT, handleTrackedDataChange);
    window.addEventListener(ACTIVITY_CHANGED_EVENT, handleTrackedDataChange);
    window.addEventListener(CUSTOM_TRACKERS_CHANGED_EVENT, handleTrackedDataChange);
    window.addEventListener(NUTRITION_TARGETS_CHANGED_EVENT, handleTrackedDataChange);
    window.addEventListener(LOCAL_DAY_CHANGED_EVENT, handleTrackedDataChange);
    window.addEventListener(
      "health-tracker:calendar-preferences-changed",
      handleTrackedDataChange,
    );
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener(FOOD_LOG_CHANGED_EVENT, handleTrackedDataChange);
      window.removeEventListener(HYDRATION_CHANGED_EVENT, handleTrackedDataChange);
      window.removeEventListener(ACTIVITY_CHANGED_EVENT, handleTrackedDataChange);
      window.removeEventListener(
        CUSTOM_TRACKERS_CHANGED_EVENT,
        handleTrackedDataChange,
      );
      window.removeEventListener(
        NUTRITION_TARGETS_CHANGED_EVENT,
        handleTrackedDataChange,
      );
      window.removeEventListener(LOCAL_DAY_CHANGED_EVENT, handleTrackedDataChange);
      window.removeEventListener(
        "health-tracker:calendar-preferences-changed",
        handleTrackedDataChange,
      );
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const foodSummed = useMemo(() => sumKnownNutrition(entries), [entries]);
  const hydrationSummed = useMemo(
    () => hydrationNutrition(hydrationEntries),
    [hydrationEntries],
  );
  const summed = useMemo(
    () => {
      const totals = { ...foodSummed.totals };
      const incomplete = { ...foodSummed.incomplete };
      for (const key of Object.keys(totals) as Array<keyof LoggedNutrition>) {
        const hydrationValue = hydrationSummed.totals[key];
        totals[key] =
          totals[key] === null && hydrationValue === null
            ? null
            : (totals[key] ?? 0) + (hydrationValue ?? 0);
        incomplete[key] = incomplete[key] || hydrationSummed.incomplete[key];
      }
      return {
        totals,
        incomplete,
        hasIncomplete: Object.values(incomplete).some(Boolean),
        hasEstimated: foodSummed.hasEstimated || hydrationSummed.hasEstimated,
      };
    },
    [foodSummed, hydrationSummed],
  );
  const recentEntries = useMemo(() => recentLogSources(allEntries), [allEntries]);
  const collectionSuggestions = useMemo(
    () =>
      sortCollectionNames([
        ...new Set([
          ...foods.map(collectionForFood),
          ...meals.map(collectionForMeal),
        ]),
      ]),
    [foods, meals],
  );
  const greetingLead = `Good ${greetingDayPart}${displayName ? "," : ""}`;
  const greeting = displayName ? `${greetingLead} ${displayName}` : `Good ${greetingDayPart}`;
  const greetingTitle = (
    <>
      <span className="page-header-greeting-desktop">{greeting}</span>
      <span className="page-header-greeting-mobile">
        <span>{greetingLead}</span>
        {displayName ? <span>{displayName}</span> : null}
      </span>
    </>
  );
  const activityMinutes = Math.round(sumActiveMinutes(activityEntries));
  const activityEnergy = sumEstimatedActiveCalories(activityEntries);
  const weeklyActivity = useMemo(
    () => weeklyActivitySummary(activityWeekEntries),
    [activityWeekEntries],
  );
  const weeklySessionTarget =
    activityPreferences.weeklyStrengthDaysTarget ??
    (activityPreferences.weeklyMinutesTarget === null ? null : 3);
  const totalHydration = totalFluidMl(hydrationEntries);
  const plainHydration = plainWaterMl(hydrationEntries);
  const rationSummaries = useMemo(
    () => summarizeRationEntries(entries),
    [entries],
  );
  const hydrationSummaries = useMemo(
    () => summarizeHydrationEntries(hydrationEntries),
    [hydrationEntries],
  );
  const pinnedTrackers = useMemo(
    () =>
      trackers
        .filter((tracker) => tracker.isEnabled && tracker.isPinnedToToday)
        .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name)),
    [trackers],
  );
  const activityInsight = useMemo(() => {
    if (!isHydrated) return null;
    if (activityInsightDismissed) return null;
    return (
      generateActivityInsights({
        entriesToday: activityEntries,
        weekEntries: activityWeekEntries,
        preferences: activityPreferences,
        proteinCurrent: summed.totals.proteinG,
        proteinTarget: targets.proteinG,
      })[0] ?? null
    );
  }, [
    activityEntries,
    activityInsightDismissed,
    activityPreferences,
    activityWeekEntries,
    isHydrated,
    summed.totals.proteinG,
    targets.proteinG,
  ]);
  const enabledTrackers = useMemo(
    () =>
      trackers
        .filter((tracker) => tracker.isEnabled)
        .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name)),
    [trackers],
  );
  const hasOverviewModules =
    todayModules.nutrition ||
    todayModules.activity ||
    todayModules.personalTrackers;
  const hasRightRailModules = todayModules.activity || todayModules.personalTrackers;
  const useSingleOverviewColumn = !todayModules.nutrition || !hasRightRailModules;
  const todayLogModuleCount =
    (todayModules.nutrition ? 2 : 0) + (todayModules.activity ? 1 : 0);
  const todayLogPlaqueClass =
    todayLogModuleCount === 1
      ? "today-log-plaque-one"
      : todayLogModuleCount === 2
        ? "today-log-plaque-two"
        : "today-log-plaque-three";

  function openTodayCustomize() {
    customizeButtonRef.current =
      typeof document === "undefined"
        ? null
        : (document.activeElement as HTMLButtonElement | null);
    setTodayCustomizeOpen(true);
  }

  function closeTodayCustomize() {
    setTodayCustomizeOpen(false);
    window.setTimeout(() => customizeButtonRef.current?.focus(), 0);
  }

  function updateTodayModule(
    module: keyof Omit<TodayModulesVisibility, "todayNutritionLayout">,
    value: boolean,
  ) {
    setTodayModules((current) => {
      const next = { ...current, [module]: value };
      saveTodayModulesVisibility(next);
      return next;
    });
  }

  function updateTodayNutritionLayout(
    value: TodayModulesVisibility["todayNutritionLayout"],
  ) {
    setTodayModules((current) => {
      const next = { ...current, todayNutritionLayout: value };
      saveTodayModulesVisibility(next);
      return next;
    });
  }

  function openAddFoodModal(options?: {
    mealType?: FoodLogEntry["mealType"];
    tab?: AddFoodTab;
  }) {
    modalTriggerRef.current =
      typeof document === "undefined"
        ? null
        : (document.activeElement as HTMLElement | null);
    setAddFoodModal({
      mealType: options?.mealType ?? inferMealType(),
      mealTypeWasPreset: Boolean(options?.mealType),
      tab: options?.tab ?? "library",
    });
  }

  function closeAddFoodModal() {
    setAddFoodModal(null);
    window.setTimeout(() => modalTriggerRef.current?.focus(), 0);
  }

  function openDrinkModal(entry?: HydrationEntry) {
    modalTriggerRef.current =
      typeof document === "undefined"
        ? null
        : (document.activeElement as HTMLElement | null);
    setDrinkModalEntry(entry ?? null);
  }

  function closeDrinkModal() {
    setDrinkModalEntry(undefined);
    window.setTimeout(() => modalTriggerRef.current?.focus(), 0);
  }

  function dismissActivityInsight() {
    window.localStorage.setItem(
      `${ACTIVITY_INSIGHT_DISMISSED_PREFIX}.${todayKey}`,
      "true",
    );
    setActivityInsightDismissed(true);
  }

  function openDailyFortune() {
    const { fortune } = revealDailyFortune(todayKey);
    setDailyFortune(fortune);
    setFortuneModalOpen(true);
    setFortuneCopyState("idle");
  }

  function closeDailyFortune() {
    setFortuneModalOpen(false);
    setFortuneCopyState("idle");
    window.setTimeout(() => fortuneButtonRef.current?.focus(), 0);
  }

  async function copyDailyFortune() {
    if (!dailyFortune) return;
    try {
      await navigator.clipboard.writeText(dailyFortune.text);
      setFortuneCopyState("copied");
    } catch {
      setFortuneCopyState("failed");
    }
  }

  function showAdded(entry: FoodLogEntry) {
    setUndoEntry(entry);
    setUndoMode("add");
    setConfirmation(
      entry.nutritionStatus === "missing"
        ? "Added, but nutrition is incomplete"
        : `Added to ${mealTypeLabel(entry.mealType)}`,
    );
    window.setTimeout(() => setConfirmation(""), 5000);
  }

  function addEntry(entry: FoodLogEntry) {
    addFoodLogEntry(entry);
    refresh();
    setAddFoodModal(null);
    showAdded(entry);
  }

  function addMeal(
    meal: MealTemplate,
    mealType: FoodLogEntry["mealType"],
    quantity = 1,
  ) {
    addEntry(createLogEntryFromMeal({ foods, meal: { ...meal, mealType }, quantity }));
  }

  function addFood(
    food: FoodItem,
    mealType = inferMealType(),
    quantity = 1,
  ) {
    addEntry(createLogEntryFromFood({ food, mealType, quantity }));
  }

  function addRecent(
    entry: FoodLogEntry,
    mealType: FoodLogEntry["mealType"],
    quantity = entry.quantity,
  ) {
    const now = new Date().toISOString();
    const nextEntry = {
      ...entry,
      id: makeId("food-log"),
      date: todayKey,
      mealType,
      time: currentLocalTime(),
      createdAt: now,
      updatedAt: now,
    };
    addEntry(rescaleLogEntry(nextEntry, quantity));
  }

  function undo() {
    if (undoEntry && undoMode === "add") {
      deleteFoodLogEntry(undoEntry.id);
    } else if (undoEntry && undoMode === "remove") {
      addFoodLogEntry(undoEntry);
    } else if (undoHydrationEntry && undoMode === "add") {
      deleteHydrationEntry(undoHydrationEntry.id);
    } else if (undoHydrationEntry && undoMode === "remove") {
      addHydrationEntry(undoHydrationEntry);
    } else if (trackerUndoEntry) {
      undoTrackerEntry();
      return;
    } else {
      return;
    }
    refresh();
    const message = undoMode === "remove" ? "Entry restored." : "Entry removed.";
    setUndoEntry(null);
    setUndoHydrationEntry(null);
    setUndoMode(null);
    setConfirmation(message);
  }

  function removeEntry(entry: FoodLogEntry) {
    deleteFoodLogEntry(entry.id);
    refresh();
    setUndoEntry(entry);
    setUndoMode("remove");
    setConfirmation("Entry removed.");
  }

  function saveEntry(entry: FoodLogEntry) {
    updateFoodLogEntry(entry);
    setEditingEntry(null);
    setUndoEntry(null);
    setUndoMode(null);
    refresh();
    setConfirmation("Entry updated.");
  }

  function saveNewFood(
    food: FoodItem,
    saveToLibrary: boolean,
    mealType = inferMealType(),
  ) {
    if (saveToLibrary) {
      const nextFoods = [...foods, food];
      saveFoodItems(nextFoods);
      setFoods(nextFoods);
    }

    addEntry(
      createLogEntryFromFood({
        food,
        mealType,
        sourceType: saveToLibrary ? "food" : "custom-one-off",
      }),
    );
  }

  function saveNewFoodOnly(food: FoodItem) {
    const nextFoods = [...foods, food];
    saveFoodItems(nextFoods);
    setFoods(nextFoods);
    refresh();
    setConfirmation("Food saved to your library.");
  }

  function saveMealFromComposer(meal: MealTemplate) {
    const nextMeals = [...meals, meal];
    saveMealTemplates(nextMeals);
    setMeals(nextMeals);
    setConfirmation("Meal saved.");
  }

  function saveFoodFromComposer(food: FoodItem) {
    const nextFoods = [...foods, food];
    saveFoodItems(nextFoods);
    setFoods(nextFoods);
    setConfirmation("Food saved to your library.");
  }

  function addDrink(entry: HydrationEntry) {
    addHydrationEntry(entry);
    setLastDrinkVolumeMl(entry.volumeMl);
    refresh();
    setUndoEntry(null);
    setUndoHydrationEntry(entry);
    setUndoMode("add");
    setConfirmation(
      `${Math.round(entry.volumeMl)} ml ${
        entry.beverageType === "sweet-soda"
          ? "sweet soda"
          : entry.beverageType === "zero-soda"
            ? "zero soda"
            : entry.beverageType === "other"
              ? entry.displayName.toLowerCase()
              : "water"
      } added`,
    );
    closeDrinkModal();
  }

  function updateDrink(entry: HydrationEntry) {
    updateHydrationEntry(entry);
    setLastDrinkVolumeMl(entry.volumeMl);
    refresh();
    setConfirmation("Drink updated.");
    closeDrinkModal();
  }

  function removeDrink(entry: HydrationEntry) {
    deleteHydrationEntry(entry.id);
    refresh();
    setUndoEntry(null);
    setUndoHydrationEntry(entry);
    setUndoMode("remove");
    setConfirmation("Drink removed.");
  }

  function addActivity(entry: ActivityEntry) {
    addActivityEntry(entry);
    refresh();
    setActivityAddOpen(false);
    setConfirmation("Activity added to today.");
    window.setTimeout(() => setConfirmation(""), 5000);
  }

  function undoTrackerEntry() {
    if (!trackerUndoEntry) return;
    deleteCustomTrackerEntry(trackerUndoEntry.id);
    refresh();
    setTrackerUndoEntry(null);
    setConfirmation("Tracker entry removed.");
  }

  function saveTracker(tracker: CustomTracker) {
    const now = new Date().toISOString();
    const exists = trackers.some((item) => item.id === tracker.id);
    const nextTracker = { ...tracker, updatedAt: now };
    const nextTrackers = exists
      ? trackers.map((item) => (item.id === tracker.id ? nextTracker : item))
      : [...trackers, nextTracker];
    saveCustomTrackers(nextTrackers);
    setTrackers(nextTrackers);
    setTrackerModal(null);
    setConfirmation("Tracker saved.");
  }

  function addManualTrackerEntry({
    date,
    note,
    time,
    tracker,
    value,
  }: {
    date: string;
    note: string;
    time: string;
    tracker: CustomTracker;
    value: number;
  }) {
    const now = new Date().toISOString();
    const entry: CustomTrackerEntry = {
      createdAt: now,
      date,
      id: makeId("tracker-entry"),
      note,
      occurredAt: makeTrackerOccurredAt(date, time),
      time,
      trackerId: tracker.id,
      updatedAt: now,
      value,
    };
    saveCustomTrackerEntries([...readCustomTrackerEntries(), entry]);
    refresh();
    setTrackerModal(null);
    setUndoEntry(null);
    setUndoHydrationEntry(null);
    setUndoMode(null);
    setTrackerUndoEntry(entry);
    setTrackerAddStates((current) => ({ ...current, [tracker.id]: "saved" }));
    window.setTimeout(() => {
      setTrackerAddStates((current) => ({ ...current, [tracker.id]: "idle" }));
    }, 1000);
    setConfirmation(`${tracker.shortName || tracker.name}: ✓ Added`);
  }

  function saveTrackerEntry(entry: CustomTrackerEntry) {
    const currentEntries = readCustomTrackerEntries();
    const exists = currentEntries.some((current) => current.id === entry.id);
    if (exists) {
      updateCustomTrackerEntry(entry);
    } else {
      const now = new Date().toISOString();
      const nextEntry = {
        ...entry,
        createdAt: now,
        occurredAt: makeTrackerOccurredAt(entry.date, entry.time),
        updatedAt: now,
      };
      saveCustomTrackerEntries([...currentEntries, nextEntry]);
    }
    refresh();
    setConfirmation(exists ? "Tracker entry updated." : "Tracker entry added.");
  }

  function removeTrackerEntry(entryId: string) {
    deleteCustomTrackerEntry(entryId);
    refresh();
    setConfirmation("Tracker entry removed.");
  }

  function duplicateTracker(tracker: CustomTracker) {
    const now = new Date().toISOString();
    const copy = {
      ...tracker,
      id: makeId("tracker"),
      name: `${tracker.name} copy`,
      order: trackers.length,
      createdAt: now,
      updatedAt: now,
    };
    saveCustomTrackers([...trackers, copy]);
    refresh();
    setConfirmation("Tracker duplicated.");
  }

  function removeTracker(tracker: CustomTracker, withEntries = false) {
    const nextTrackers = trackers.filter((item) => item.id !== tracker.id);
    saveCustomTrackers(nextTrackers);
    if (withEntries) {
      const nextEntries = trackerEntries.filter((entry) => entry.trackerId !== tracker.id);
      saveCustomTrackerEntries(nextEntries);
      refresh();
    } else {
      refresh();
    }
    setConfirmation(
      withEntries
        ? "Tracker and entries removed."
        : "Tracker removed. Existing entries were kept.",
    );
  }

  return (
    <div className="wc-page mx-auto flex w-full max-w-5xl flex-col">
      <PageHeader
        date={currentDate}
        greetingMode
        profile={profile}
        profileReady={isHydrated}
        title={greetingTitle}
        trailingAction={
          <div className="today-header-actions">
            <button
              className="today-customize-button btn btn-secondary-outline min-h-10 px-3 text-xs"
              onClick={openTodayCustomize}
              ref={customizeButtonRef}
              type="button"
            >
              Customize Today
            </button>
            <button
              aria-label={
                dailyFortune
                  ? "Read today's fortune again"
                  : "Open today's fortune"
              }
              className={`today-fortune-button relative grid h-11 w-11 shrink-0 place-items-center rounded-full border text-stone-800 shadow-sm transition motion-reduce:transition-none ${
                dailyFortune
                  ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                  : "border-stone-300 bg-white hover:border-[var(--accent)]"
              }`}
              onClick={openDailyFortune}
              ref={fortuneButtonRef}
              type="button"
            >
              <WellCanvasIcon
                name={dailyFortune ? "opened-cookie" : "cookie"}
                size="fortune"
              />
              {dailyFortune ? (
                <span
                  aria-hidden="true"
                  className="absolute -right-0.5 -top-0.5 grid h-4 w-4 place-items-center rounded-full bg-[var(--accent)] text-[10px] font-bold text-white"
                >
                  ✓
                </span>
              ) : (
                <span
                  aria-hidden="true"
                  className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[var(--accent)]"
                />
              )}
            </button>
          </div>
        }
      />

      <ToastBridge
        actionLabel={
          undoEntry || undoHydrationEntry || trackerUndoEntry ? "Undo" : undefined
        }
        message={confirmation}
        onAction={
          undoEntry || undoHydrationEntry || trackerUndoEntry ? undo : undefined
        }
        type={confirmation.toLowerCase().includes("removed") ? "information" : "success"}
      />

      {hasOverviewModules ? (
        <section
          aria-label="Today overview"
          className="today-overview-plaque wc-section wc-section-padded"
        >
          <div
            className={`today-overview-grid ${
              useSingleOverviewColumn ? "today-overview-grid-single" : ""
            }`}
          >
            {todayModules.nutrition && (
              <DailyBalanceCard
                hasEstimated={summed.hasEstimated}
                hydrationTargetMl={hydrationPreferences.targetMl}
                incomplete={summed.incomplete}
                layout={todayModules.todayNutritionLayout}
                plainHydrationMl={plainHydration}
                targets={targets}
                totalHydrationMl={totalHydration}
                totals={summed.totals}
              />
            )}
            {hasRightRailModules && (
              <div className="today-right-rail">
                {todayModules.activity && (
                  <WeeklyActivitySummary
                    dateKey={todayKey}
                    entries={activityWeekEntries}
                    sessionCount={activityWeekEntries.length}
                    sessionTarget={weeklySessionTarget}
                    strengthTarget={activityPreferences.weeklyStrengthDaysTarget}
                    summary={weeklyActivity}
                    weeklyMinutesTarget={activityPreferences.weeklyMinutesTarget}
                    weekStartsOn={calendarPreferences.weekStartsOn}
                  />
                )}
                {todayModules.personalTrackers && (
                  <PersonalTrackersOverview
                    addStates={trackerAddStates}
                    dateKey={todayKey}
                    entries={trackerEntries}
                    onAdd={() => setTrackerModal({ type: "add" })}
                    onDetails={(tracker) =>
                      setTrackerModal({ type: "details", tracker })
                    }
                    onQuickAdd={(tracker) =>
                      setTrackerModal({ type: "entry", tracker })
                    }
                    onViewAll={() => setTrackerModal({ type: "list" })}
                    trackers={pinnedTrackers}
                    weekStartsOn={calendarPreferences.weekStartsOn}
                  />
                )}
              </div>
            )}
          </div>
        </section>
      ) : (
        <section className="wc-section wc-section-padded">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-stone-950">
                Your Today dashboard is hidden.
              </h2>
              <p className="mt-1 text-sm text-stone-500">
                Choose which modules to show whenever you want them back.
              </p>
            </div>
            <button
              className="btn btn-secondary-outline shrink-0"
              onClick={openTodayCustomize}
              type="button"
            >
              Customize Today
            </button>
          </div>
        </section>
      )}
      {todayModules.nutrition && summed.hasIncomplete && (
        <p className="wc-section px-4 py-3 text-sm text-stone-500">
          Some entries are incomplete. Nutrition totals show known values.
        </p>
      )}

      {todayLogModuleCount > 0 && (
        <section className={`today-log-plaque wc-section ${todayLogPlaqueClass}`}>
          {todayModules.nutrition && (
            <TodayColumn
              actionLabel="+ Add food"
              onAction={() => openAddFoodModal()}
              title="Ration"
            >
              {rationSummaries.length === 0 ? (
                <p className="text-sm text-stone-500">No food logged today.</p>
              ) : (
                <>
                  {rationSummaries.slice(0, 5).map((summary) => (
                    <CompactRationRow
                      key={summary.key}
                      onInfo={() =>
                        setDetailModal({
                          type: "ration",
                          entries: summary.entries,
                          title: summary.name,
                        })
                      }
                      summary={summary}
                    />
                  ))}
                  {rationSummaries.length > 5 && (
                    <button
                      className="text-left text-sm font-semibold text-[var(--accent)]"
                      onClick={() =>
                        setDetailModal({
                          type: "ration",
                          entries,
                          title: "All ration entries",
                        })
                      }
                      type="button"
                    >
                      View all
                    </button>
                  )}
                </>
              )}
            </TodayColumn>
          )}

          {todayModules.nutrition && (
          <TodayColumn
            actionLabel="+ Drink"
            footer={`${formatNumber(totalHydration / 1000, 2)} / ${formatNumber(
              hydrationPreferences.targetMl / 1000,
              1,
            )} L total\nPlain water: ${formatNumber(
              plainHydration / 1000,
              2,
            )} L`}
            onAction={() => openDrinkModal()}
            title="Hydration"
          >
            {hydrationEntries.length === 0 ? (
              <p className="text-sm text-stone-500">No drinks logged today.</p>
            ) : (
              hydrationSummaries.slice(0, 5).map((summary) => (
                <CompactHydrationRow
                  key={summary.key}
                  onInfo={() =>
                    setDetailModal({
                      type: "hydration",
                      entries: summary.entries,
                      title: summary.name,
                    })
                  }
                  summary={summary}
                />
              ))
            )}
          </TodayColumn>
          )}

          {todayModules.activity && (
          <TodayColumn
            footer={
              activityEnergy === null
                ? `${activityMinutes} min · estimated active energy —`
                : `${activityMinutes} min · ≈ ${Math.round(activityEnergy)} active kcal`
            }
            actionLabel="+ Sport"
            onAction={() => setActivityAddOpen(true)}
            title="Activity"
          >
            {activityEntries.length === 0 ? (
              <p className="text-sm text-stone-500">No activity logged today.</p>
            ) : (
              [...activityEntries]
                .sort((a, b) => a.startTime.localeCompare(b.startTime))
                .slice(0, 5)
                .map((entry) => (
                  <CompactActivityRow
                    entry={entry}
                    key={entry.id}
                    onInfo={() =>
                      setDetailModal({
                        type: "activity",
                        entries: [entry],
                        title: entry.displayName,
                      })
                    }
                  />
                ))
            )}
          </TodayColumn>
          )}

          {todayModules.activity && activityInsight && (
            <div className="today-log-insight">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-stone-950">
                    Activity insight
                  </h2>
                  <p className="mt-1 text-sm text-stone-600">{activityInsight}</p>
                </div>
                <button
                  aria-label="Dismiss activity insight"
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-stone-300 text-lg leading-none text-stone-600 hover:border-stone-500"
                  onClick={dismissActivityInsight}
                  type="button"
                >
                  ×
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {addFoodModal && (
        <AddFoodModal
          collectionSuggestions={collectionSuggestions}
          foods={foods}
          meals={meals}
          onAddFood={addFood}
          onAddEntry={addEntry}
          onAddMeal={addMeal}
          onAddRecent={addRecent}
          onClose={closeAddFoodModal}
          onSaveFood={saveFoodFromComposer}
          onSaveAndAddNewFood={saveNewFood}
          onSaveNewFoodOnly={saveNewFoodOnly}
          onSaveMeal={saveMealFromComposer}
          recentEntries={recentEntries}
          state={addFoodModal}
        />
      )}
      {drinkModalEntry !== undefined && (
        <AddDrinkModal
          defaultVolumeMl={lastDrinkVolumeMl}
          entry={drinkModalEntry}
          onAdd={addDrink}
          onClose={closeDrinkModal}
          onUpdate={updateDrink}
        />
      )}
      {editingEntry && (
        <EditLogEntry
          entry={editingEntry}
          onCancel={() => setEditingEntry(null)}
          onSave={saveEntry}
        />
      )}
      {detailModal && (
        <TodayDetailModal
          detail={detailModal}
          onAddAnother={() => {
            const type = detailModal.type;
            setDetailModal(null);
            if (type === "ration") openAddFoodModal();
            if (type === "hydration") openDrinkModal();
            if (type === "activity") setActivityAddOpen(true);
          }}
          onClose={() => setDetailModal(null)}
          onEditDrink={openDrinkModal}
          onEditEntry={setEditingEntry}
          onRemoveDrink={removeDrink}
          onRemoveEntry={removeEntry}
        />
      )}
      {activityAddOpen && (
        <AddActivityModal
          onAdd={addActivity}
          onClose={() => setActivityAddOpen(false)}
        />
      )}
      {todayCustomizeOpen && (
        <CustomizeTodayDialog
          modules={todayModules}
          onChange={updateTodayModule}
          onNutritionLayoutChange={updateTodayNutritionLayout}
          onClose={closeTodayCustomize}
        />
      )}
      {trackerModal && (
        <TrackerModal
          dateKey={todayKey}
          entries={trackerEntries}
          modal={trackerModal}
          onAddEntry={addManualTrackerEntry}
          onClose={() => setTrackerModal(null)}
          onDeleteEntry={removeTrackerEntry}
          onDeleteTracker={removeTracker}
          onDuplicateTracker={duplicateTracker}
          onUpdateEntry={saveTrackerEntry}
          onSaveTracker={saveTracker}
          trackers={enabledTrackers}
          weekStartsOn={calendarPreferences.weekStartsOn}
        />
      )}
      {fortuneModalOpen && dailyFortune && (
        <DailyFortuneModal
          copyState={fortuneCopyState}
          fortune={dailyFortune}
          onClose={closeDailyFortune}
          onCopy={copyDailyFortune}
        />
      )}
    </div>
  );
}

type RationSummary = {
  calories: number | null;
  entries: FoodLogEntry[];
  hasEstimated: boolean;
  key: string;
  name: string;
  quantity: number;
};

type HydrationSummary = {
  entries: HydrationEntry[];
  key: string;
  name: string;
  volumeMl: number;
};

function DailyFortuneModal({
  copyState,
  fortune,
  onClose,
  onCopy,
}: {
  copyState: "idle" | "copied" | "failed";
  fortune: DailyFortune;
  onClose: () => void;
  onCopy: () => void;
}) {
  return (
    <DialogFrame onClose={onClose} title="Daily fortune">
      <div className="space-y-4">
        <p className="select-text text-lg font-medium leading-relaxed text-stone-950">
          “{fortune.text}”
        </p>
        <p className="text-sm text-stone-500">
          A new fortune appears with the next local day.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            className="min-h-10 rounded-lg border border-stone-300 px-4 text-sm font-semibold text-stone-800 hover:border-stone-500"
            onClick={onClose}
            type="button"
          >
            Close
          </button>
          <button
            className="min-h-10 rounded-lg border border-stone-300 px-4 text-sm font-semibold text-stone-800 hover:border-stone-500"
            onClick={onCopy}
            type="button"
          >
            {copyState === "copied" ? "Copied" : "Copy"}
          </button>
          {copyState === "failed" && (
            <span className="text-sm text-stone-500">
              Copy unavailable. The text can still be selected.
            </span>
          )}
        </div>
      </div>
    </DialogFrame>
  );
}

function CustomizeTodayDialog({
  modules,
  onChange,
  onNutritionLayoutChange,
  onClose,
}: {
  modules: TodayModulesVisibility;
  onChange: (
    module: keyof Omit<TodayModulesVisibility, "todayNutritionLayout">,
    value: boolean,
  ) => void;
  onNutritionLayoutChange: (
    value: TodayModulesVisibility["todayNutritionLayout"],
  ) => void;
  onClose: () => void;
}) {
  const options: Array<{
    key: keyof Omit<TodayModulesVisibility, "todayNutritionLayout">;
    label: string;
  }> = [
    { key: "nutrition", label: "Nutrition" },
    { key: "activity", label: "Activity" },
    { key: "personalTrackers", label: "Personal trackers" },
  ];

  return (
    <DialogFrame onClose={onClose} title="Customize Today">
      <div className="grid gap-4">
        <p className="text-sm text-stone-600">
          Choose what appears on your Today dashboard.
        </p>
        <div className="grid gap-2">
          {options.map((option) => (
            <div className="grid gap-2" key={option.key}>
              <label className="flex min-h-12 items-center gap-3 rounded-xl border border-stone-200 bg-stone-50/70 px-3 py-2 text-sm font-semibold text-stone-900">
                <input
                  checked={modules[option.key]}
                  className="h-4 w-4 accent-[var(--accent)]"
                  onChange={(event) => onChange(option.key, event.target.checked)}
                  type="checkbox"
                />
                {option.label}
              </label>
              {option.key === "nutrition" && modules.nutrition && (
                <fieldset className="ml-7 grid gap-2 rounded-xl border border-stone-200 bg-white/70 p-3">
                  <legend className="px-1 text-xs font-semibold uppercase tracking-normal text-stone-500">
                    Layout
                  </legend>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: "One column", value: "one-column" },
                      { label: "Two columns", value: "two-column" },
                    ].map((option) => (
                      <label
                        className={`flex min-h-10 items-center justify-center rounded-lg border px-3 text-sm font-semibold ${
                          modules.todayNutritionLayout === option.value
                            ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                            : "border-stone-200 bg-white text-stone-700"
                        }`}
                        key={option.value}
                      >
                        <input
                          checked={modules.todayNutritionLayout === option.value}
                          className="sr-only"
                          name="today-nutrition-layout"
                          onChange={() =>
                            onNutritionLayoutChange(
                              option.value as TodayModulesVisibility["todayNutritionLayout"],
                            )
                          }
                          type="radio"
                          value={option.value}
                        />
                        {option.label}
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-end">
          <button className="btn btn-primary-dark" onClick={onClose} type="button">
            Done
          </button>
        </div>
      </div>
    </DialogFrame>
  );
}

function summarizeRationEntries(entries: FoodLogEntry[]): RationSummary[] {
  const grouped = new Map<string, FoodLogEntry[]>();
  for (const entry of entries) {
    const key = `${entry.sourceType}:${entry.sourceId ?? entry.name}`;
    grouped.set(key, [...(grouped.get(key) ?? []), entry]);
  }

  return [...grouped.entries()]
    .map(([key, group]) => {
      const calories = group.some((entry) => entry.nutritionSnapshot.caloriesKcal === null)
        ? null
        : group.reduce((total, entry) => total + (entry.nutritionSnapshot.caloriesKcal ?? 0), 0);
      return {
        calories,
        entries: group.sort((a, b) => a.time.localeCompare(b.time)),
        hasEstimated: group.some((entry) => entry.nutritionStatus === "estimated"),
        key,
        name: group[0]?.name ?? "Food",
        quantity: group.reduce((total, entry) => total + entry.quantity, 0),
      };
    })
    .sort((a, b) => a.entries[0].time.localeCompare(b.entries[0].time));
}

function summarizeHydrationEntries(entries: HydrationEntry[]): HydrationSummary[] {
  const grouped = new Map<string, HydrationEntry[]>();
  for (const entry of entries) {
    const key = `${entry.beverageType}:${entry.displayName}`;
    grouped.set(key, [...(grouped.get(key) ?? []), entry]);
  }

  return [...grouped.entries()]
    .map(([key, group]) => ({
      entries: group.sort((a, b) => a.time.localeCompare(b.time)),
      key,
      name: group[0]?.displayName ?? "Drink",
      volumeMl: group.reduce((total, entry) => total + entry.volumeMl, 0),
    }))
    .sort((a, b) => a.entries[0].time.localeCompare(b.entries[0].time));
}

function CompactInfoButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      aria-label="View details"
      className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-stone-300 text-xs font-semibold text-stone-600"
      onClick={onClick}
      type="button"
    >
      i
    </button>
  );
}

function CompactRationRow({
  onInfo,
  summary,
}: {
  onInfo: () => void;
  summary: RationSummary;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto_auto] items-center gap-2 text-sm">
      <p className="truncate font-medium text-stone-900">
        {summary.quantity !== 1 ? `${formatNumber(summary.quantity, 1)}× ` : ""}
        {summary.name}
      </p>
      <p className="text-right font-semibold text-stone-700">
        {summary.calories === null
          ? "Known"
          : `${summary.hasEstimated ? "≈" : ""}${formatNumber(summary.calories, 0)} kcal`}
      </p>
      <CompactInfoButton onClick={onInfo} />
    </div>
  );
}

function CompactHydrationRow({
  onInfo,
  summary,
}: {
  onInfo: () => void;
  summary: HydrationSummary;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto_auto] items-center gap-2 text-sm">
      <p className="truncate font-medium text-stone-900">
        {summary.name}
        {summary.entries.length > 1 ? ` ×${summary.entries.length}` : ""}
      </p>
      <p className="text-right font-semibold text-stone-700">
        {summary.volumeMl >= 1000
          ? `${formatNumber(summary.volumeMl / 1000, 1)} L`
          : `${Math.round(summary.volumeMl)} ml`}
      </p>
      <CompactInfoButton onClick={onInfo} />
    </div>
  );
}

function CompactActivityRow({
  entry,
  onInfo,
}: {
  entry: ActivityEntry;
  onInfo: () => void;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto_auto] items-center gap-2 text-sm">
      <p className="truncate font-medium text-stone-900">{entry.displayName}</p>
      <p className="text-right font-semibold text-stone-700">
        {entry.durationMinutes} min
      </p>
      <CompactInfoButton onClick={onInfo} />
    </div>
  );
}

function TodayDetailModal({
  detail,
  onAddAnother,
  onClose,
  onEditDrink,
  onEditEntry,
  onRemoveDrink,
  onRemoveEntry,
}: {
  detail:
    | { type: "ration"; entries: FoodLogEntry[]; title: string }
    | { type: "hydration"; entries: HydrationEntry[]; title: string }
    | { type: "activity"; entries: ActivityEntry[]; title: string };
  onAddAnother: () => void;
  onClose: () => void;
  onEditDrink: (entry: HydrationEntry) => void;
  onEditEntry: (entry: FoodLogEntry) => void;
  onRemoveDrink: (entry: HydrationEntry) => void;
  onRemoveEntry: (entry: FoodLogEntry) => void;
}) {
  return (
    <DialogFrame onClose={onClose} title={detail.title}>
      <div className="grid gap-3">
        {detail.type === "ration" &&
          detail.entries.map((entry, index) => (
            <LoggedEntryRow
              entry={entry}
              index={index + 1}
              key={entry.id}
              onEdit={() => onEditEntry(entry)}
              onRemove={() => onRemoveEntry(entry)}
            />
          ))}
        {detail.type === "hydration" &&
          detail.entries.map((entry) => (
            <HydrationRow
              entry={entry}
              key={entry.id}
              onEdit={() => onEditDrink(entry)}
              onRemove={() => onRemoveDrink(entry)}
            />
          ))}
        {detail.type === "activity" &&
          detail.entries.map((entry) => (
            <ActivityTodayRow entry={entry} key={entry.id} />
          ))}
        <button
          className="min-h-10 rounded-md bg-teal-700 px-3 text-sm font-semibold text-white"
          onClick={onAddAnother}
          type="button"
        >
          Add another
        </button>
      </div>
    </DialogFrame>
  );
}

function LoggedEntryRow({
  compact = false,
  entry,
  index,
  onEdit,
  onRemove,
}: {
  compact?: boolean;
  entry: FoodLogEntry;
  index: number;
  onEdit: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-md bg-stone-50 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-stone-900">
            <span className="mr-2 text-stone-400">{index}.</span>
            {entry.name}
          </p>
          <p className="mt-1 text-sm text-stone-500">
            {entry.quantity} × {entry.servingLabel} · {entry.time}
          </p>
          <p className="mt-1 text-sm text-stone-700">
            {formatCalories(
              entry.nutritionSnapshot.caloriesKcal,
              entry.nutritionStatus === "estimated",
            )}{" "}
            kcal
          </p>
        </div>
        <span
          className={`rounded-md px-2 py-1 text-xs font-semibold ${statusClasses(
            entry.nutritionStatus,
          )}`}
          >
            {statusLabel(entry.nutritionStatus)}
          </span>
      </div>
      <div className={`mt-3 grid gap-2 ${compact ? "grid-cols-2" : "grid-cols-2"}`}>
        <button
          className="min-h-9 rounded-md border border-stone-300 px-3 text-xs font-semibold text-stone-800"
          onClick={onEdit}
          type="button"
        >
          Edit
        </button>
        <button
          className="min-h-9 rounded-md border border-red-200 px-3 text-xs font-semibold text-red-700"
          onClick={onRemove}
          type="button"
        >
          Remove
        </button>
      </div>
    </div>
  );
}

function TodayColumn({
  actionLabel,
  children,
  footer,
  onAction,
  title,
}: {
  actionLabel: string;
  children: React.ReactNode;
  footer?: string;
  onAction: () => void;
  title: string;
}) {
  return (
    <article className="today-log-column">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-stone-950">{title}</h3>
        <button
          className="min-h-9 rounded-md bg-teal-700 px-3 text-xs font-semibold text-white"
          onClick={onAction}
          type="button"
        >
          {actionLabel}
        </button>
      </div>
      <div className="mt-3 grid gap-2">{children}</div>
      {footer && (
        <p className="mt-3 whitespace-pre-line rounded-md bg-stone-50 px-3 py-2 text-sm font-semibold text-stone-700">
          {footer}
        </p>
      )}
    </article>
  );
}

function HydrationRow({
  entry,
  onEdit,
  onRemove,
}: {
  entry: HydrationEntry;
  onEdit: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-md bg-white p-3 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium text-stone-900">
            {entry.displayName} · {Math.round(entry.volumeMl)} ml
          </p>
          <p className="mt-1 text-stone-500">
            {entry.time}
            {entry.caloriesKcal !== null && entry.caloriesKcal > 0
              ? ` · ${entry.nutritionStatus === "estimated" ? "≈ " : ""}${formatNumber(
                  entry.caloriesKcal,
                  0,
                )} kcal`
              : ""}
          </p>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button
          className="min-h-9 rounded-md border border-stone-300 px-3 text-xs font-semibold text-stone-800"
          onClick={onEdit}
          type="button"
        >
          Edit
        </button>
        <button
          className="min-h-9 rounded-md border border-red-200 px-3 text-xs font-semibold text-red-700"
          onClick={onRemove}
          type="button"
        >
          Remove
        </button>
      </div>
    </div>
  );
}

function ActivityTodayRow({ entry }: { entry: ActivityEntry }) {
  return (
    <div className="rounded-md bg-white p-3 text-sm">
      <p className="font-medium text-stone-900">{entry.displayName}</p>
      <p className="mt-1 text-stone-500">
        {entry.durationMinutes} min · {entry.startTime}
      </p>
      <p className="mt-1 font-semibold text-stone-700">
        {entry.estimatedActiveCaloriesKcal === null
          ? "Energy —"
          : `≈ ${entry.estimatedActiveCaloriesKcal} active kcal`}
      </p>
    </div>
  );
}

type MetricKind = "goal" | "limit" | "neutral";

function DailyBalanceCard({
  hasEstimated,
  hydrationTargetMl,
  incomplete,
  layout,
  plainHydrationMl,
  targets,
  totalHydrationMl,
  totals,
}: {
  hasEstimated: boolean;
  hydrationTargetMl: number;
  incomplete: Record<keyof LoggedNutrition, boolean>;
  layout: TodayModulesVisibility["todayNutritionLayout"];
  plainHydrationMl: number;
  targets: NutritionTargets;
  totalHydrationMl: number;
  totals: LoggedNutrition;
}) {
  return (
    <div className="today-balance-panel">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-stone-500">Daily balance</p>
          <h2 className="mt-1 text-xl font-semibold text-stone-950">
            Food, drink and hydration
          </h2>
        </div>
        {(hasEstimated || Object.values(incomplete).some(Boolean)) && (
          <div className="flex flex-wrap justify-end gap-1 text-[11px] font-semibold">
            {hasEstimated && (
              <span className="rounded-full bg-amber-50 px-2 py-1 text-amber-800">
                Approximate
              </span>
            )}
            {Object.values(incomplete).some(Boolean) && (
              <span className="rounded-full bg-stone-100 px-2 py-1 text-stone-700">
                Known total
              </span>
            )}
          </div>
        )}
      </div>
      <div
        className={`today-nutrition-metrics mt-4 grid gap-3 ${
          layout === "two-column" ? "today-nutrition-metrics-two" : ""
        }`}
      >
        <MetricBar
          isEstimated={hasEstimated}
          isIncomplete={incomplete.caloriesKcal}
          kind="neutral"
          label="Calories"
          meaningLabel="Daily reference"
          target={targets.caloriesKcal}
          unit="kcal"
          value={totals.caloriesKcal}
        />
        <MetricBar
          isEstimated={hasEstimated}
          isIncomplete={incomplete.proteinG}
          kind="goal"
          label="Protein"
          meaningLabel="Daily target"
          target={targets.proteinG}
          unit="g"
          value={totals.proteinG}
          valueDigits={1}
        />
        <MetricBar
          isEstimated={hasEstimated}
          isIncomplete={incomplete.fibreG}
          kind="goal"
          label="Fibre"
          meaningLabel="Daily target"
          target={targets.fibreG}
          unit="g"
          value={totals.fibreG}
          valueDigits={1}
        />
        <MetricBar
          isEstimated={hasEstimated}
          isIncomplete={incomplete.saturatedFatG}
          kind="limit"
          label="Saturated fat"
          meaningLabel="Upper limit"
          target={targets.saturatedFatLimitG}
          unit="g"
          value={totals.saturatedFatG}
          valueDigits={1}
        />
        <MetricBar
          isEstimated={hasEstimated}
          isIncomplete={incomplete.sodiumMg}
          kind="limit"
          label="Sodium"
          meaningLabel="Upper limit"
          target={targets.sodiumLimitMg}
          unit="mg"
          value={totals.sodiumMg}
        />
        <MetricBar
          kind="goal"
          label="Hydration"
          meaningLabel="Daily target"
          secondaryText={`Plain water: ${formatNumber(plainHydrationMl / 1000, 2)} L`}
          target={hydrationTargetMl / 1000}
          unit="L"
          value={totalHydrationMl / 1000}
          valueDigits={1}
        />
      </div>
    </div>
  );
}

function MetricBar({
  isEstimated = false,
  isIncomplete = false,
  kind,
  label,
  meaningLabel,
  secondaryText,
  target,
  unit,
  value,
  valueDigits = 0,
}: {
  isEstimated?: boolean;
  isIncomplete?: boolean;
  kind: MetricKind;
  label: string;
  meaningLabel: string;
  secondaryText?: string;
  target: number | null;
  unit: string;
  value: number | null;
  valueDigits?: number;
}) {
  const safeValue =
    typeof value === "number" && Number.isFinite(value) ? Math.max(value, 0) : null;
  const safeTarget =
    typeof target === "number" && Number.isFinite(target) && target > 0
      ? target
      : null;
  const ratio = safeValue !== null && safeTarget !== null ? safeValue / safeTarget : 0;
  const visualRatio = clampRatio(ratio);
  const valueText = formatNumber(safeValue, valueDigits);
  const targetText = formatNumber(target, valueDigits);
  const denominator =
    target === null
      ? `${meaningLabel}: not set`
      : kind === "limit"
        ? `${targetText} ${unit} limit`
        : `${targetText} ${unit}`;
  const barClass =
    kind === "goal"
      ? "bg-[var(--accent)]"
      : kind === "neutral"
        ? "bg-stone-500"
        : safeTarget !== null && safeValue !== null && safeValue > safeTarget
          ? "bg-red-500"
          : ratio >= 0.75
            ? "bg-amber-500"
            : "bg-stone-400";
  const defaultSecondary = metricSecondaryText({
    kind,
    target,
    unit,
    value: safeValue,
    valueDigits,
  });

  return (
    <div
      aria-label={`${label}: ${valueText} ${unit}; ${denominator}; ${
        secondaryText ?? defaultSecondary
      }`}
      className="rounded-md border border-stone-100 bg-stone-50 p-3"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-stone-950">{label}</p>
          <p className="text-[11px] font-semibold uppercase tracking-normal text-stone-500">
            {meaningLabel}
          </p>
        </div>
        {(isEstimated || isIncomplete) && (
          <span className="rounded-full bg-white px-2 py-1 text-[11px] font-semibold text-stone-600">
            {isIncomplete ? "Known total" : "Approximate"}
          </span>
        )}
      </div>
      <p className="mt-2 text-sm font-semibold text-stone-900">
        {valueText} / {denominator}
      </p>
      <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-stone-200">
        <div
          className={`h-full rounded-full ${barClass}`}
          style={{ width: `${visualRatio * 100}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-stone-500">
        {secondaryText ?? defaultSecondary}
      </p>
    </div>
  );
}

function metricSecondaryText({
  kind,
  target,
  unit,
  value,
  valueDigits,
}: {
  kind: MetricKind;
  target: number | null;
  unit: string;
  value: number | null;
  valueDigits: number;
}) {
  if (target === null || value === null || !Number.isFinite(target)) {
    return "Saved when logged";
  }
  const difference = target - value;
  if (kind === "neutral") {
    return difference >= 0
      ? `${formatNumber(difference, valueDigits)} ${unit} before reference`
      : `${formatNumber(Math.abs(difference), valueDigits)} ${unit} over reference`;
  }
  if (kind === "limit") {
    return difference >= 0
      ? `${formatNumber(difference, valueDigits)} ${unit} remaining`
      : `${formatNumber(Math.abs(difference), valueDigits)} ${unit} over limit`;
  }
  if (target <= 0) return `${formatNumber(value, valueDigits)} ${unit} recorded`;
  return `${Math.round((value / target) * 100)}% of daily target`;
}

function WeeklyActivitySummary({
  dateKey,
  entries,
  sessionCount,
  sessionTarget,
  strengthTarget,
  summary,
  weeklyMinutesTarget,
  weekStartsOn,
}: {
  dateKey: string;
  entries: ActivityEntry[];
  sessionCount: number;
  sessionTarget: number | null;
  strengthTarget: number | null;
  summary: {
    activeCalories: number | null;
    activeDays: number;
    moderateEquivalent: number;
    strengthDays: number;
    totalMinutes: number;
    vigorousMinutes: number;
  };
  weeklyMinutesTarget: number | null;
  weekStartsOn: CalendarPreferences["weekStartsOn"];
}) {
  const sessionText =
    sessionTarget === null
      ? `${sessionCount} ${sessionCount === 1 ? "session" : "sessions"} logged`
      : `${sessionCount} / ${sessionTarget}`;
  const weekStartKey = weekStart(dateKey, weekStartsOn);
  const days = Array.from({ length: 7 }, (_, index) =>
    addLocalDays(weekStartKey, index),
  );

  return (
    <div className="today-internal-panel">
      <p className="text-sm font-semibold text-stone-500">Activity this week</p>
      <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
        <WeeklyActivityStat label="Sessions" value={sessionText} />
        <WeeklyActivityStat
          label="Moderate-equivalent minutes"
          value={
            weeklyMinutesTarget === null
              ? `${Math.round(summary.moderateEquivalent)}`
              : `${Math.round(summary.moderateEquivalent)} / ${weeklyMinutesTarget}`
          }
        />
        <WeeklyActivityStat
          label="Strength days"
          value={
            strengthTarget === null
              ? `${summary.strengthDays}`
              : `${summary.strengthDays} / ${strengthTarget}`
          }
        />
      </div>
      <div className="mt-4 grid grid-cols-7 gap-1" aria-label="Activity by day">
        {days.map((dayKey) => (
          <ActivityDaySegment
            entries={entries.filter((entry) => entry.date === dayKey)}
            isToday={dayKey === dateKey}
            key={dayKey}
            dateKey={dayKey}
          />
        ))}
      </div>
      <p className="mt-3 text-sm font-medium text-stone-700">
        {Math.round(summary.totalMinutes)} actual min ·{" "}
        {summary.activeCalories === null
          ? "estimated active energy —"
          : `≈ ${Math.round(summary.activeCalories)} active kcal`}
      </p>
      <p className="mt-1 text-sm text-stone-500">
        {summary.activeDays} active {summary.activeDays === 1 ? "day" : "days"} ·{" "}
        {weekStartsOn === "monday" ? "Monday" : "Sunday"} week start
      </p>
    </div>
  );
}

function WeeklyActivityStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-normal text-stone-500">
        {label}
      </p>
      <p className="mt-1 font-semibold text-stone-950">{value}</p>
    </div>
  );
}

function ActivityDaySegment({
  dateKey,
  entries,
  isToday,
}: {
  dateKey: string;
  entries: ActivityEntry[];
  isToday: boolean;
}) {
  const date = new Date(`${dateKey}T12:00:00`);
    const label = new Intl.DateTimeFormat(DISPLAY_LOCALE, { weekday: "short" })
    .format(date)
    .slice(0, 1);
  const minutes = Math.round(sumActiveMinutes(entries));
  const hasStrength = entries.some((entry) => entry.activityType === "strength");
  const hasVigorous = entries.some((entry) => entry.intensity === "vigorous");
  const hasModerate = entries.some((entry) => entry.intensity === "moderate");
  const markerClass =
    entries.length === 0
      ? "bg-stone-200"
      : hasStrength || hasVigorous
        ? "bg-[var(--accent)]"
        : hasModerate
          ? "bg-stone-500"
          : "bg-stone-300";
  const accessibleLabel =
    entries.length === 0
      ? `${new Intl.DateTimeFormat(DISPLAY_LOCALE, {
          weekday: "long",
        }).format(date)}: no activity logged`
      : `${new Intl.DateTimeFormat(DISPLAY_LOCALE, {
          weekday: "long",
        }).format(date)}: ${minutes} minutes ${entries
          .map((entry) => entry.displayName)
          .join(", ")}`;

  return (
    <div className="text-center">
      <p className="text-[11px] font-semibold text-stone-500">{label}</p>
      <div
        aria-label={accessibleLabel}
        className={`mt-1 h-3 rounded-full ${markerClass} ${
          isToday ? "outline outline-2 outline-offset-2 outline-stone-900" : ""
        }`}
        role="img"
        title={accessibleLabel}
      />
    </div>
  );
}

function clampRatio(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(value, 0), 1);
}

function trackerTargetText(tracker: CustomTracker, value: number | null) {
  const formatted = trackerValueWithUnit(value, tracker);
  const target =
    tracker.targetValue === null
      ? null
      : trackerValueWithUnit(tracker.targetValue, tracker);

  if (tracker.kind === "goal") {
    if (target === null) return value === null ? "No value recorded" : `${formatted} recorded`;
    return `${formatted} of ${target}`;
  }

  if (tracker.kind === "upper-limit") {
    if (tracker.targetValue === null) {
      return value === null ? "No value recorded" : `${formatted} recorded`;
    }
    if (tracker.targetValue === 0) {
      return `${formatted} recorded · zero-use goal`;
    }
    return `${formatted} recorded · maximum ${target}`;
  }

  return value === null
    ? "No value recorded"
    : `${trackerAggregationLabels[tracker.aggregation]}: ${formatted}`;
}

function trackerSecondaryText(tracker: CustomTracker, value: number | null) {
  if (tracker.kind === "goal") {
    return tracker.targetValue === null
      ? `${trackerPeriodLabels[tracker.period]} ${trackerAggregationLabels[
          tracker.aggregation
        ].toLowerCase()}`
      : "Value to work toward";
  }

  if (tracker.kind === "upper-limit") {
    if (tracker.targetValue === null) return "No maximum set";
    const current = value ?? 0;
    if (tracker.targetValue === 0) {
      return current > 0 ? "Over the selected maximum" : "0 recorded";
    }
    const remaining = tracker.targetValue - current;
    return remaining >= 0
      ? `${trackerValueWithUnit(remaining, tracker)} remaining`
      : `${trackerValueWithUnit(Math.abs(remaining), tracker)} over the selected maximum`;
  }

  return `${trackerPeriodLabels[tracker.period]} · ${trackerAggregationLabels[
    tracker.aggregation
  ].toLowerCase()} aggregation`;
}

function trackerBarState(tracker: CustomTracker, value: number | null) {
  if (tracker.kind === "log-only" || tracker.targetValue === null) {
    return { className: "bg-stone-300", ratio: 0.18 };
  }

  const current = value ?? 0;
  const ratio =
    tracker.targetValue === 0
      ? current > 0
        ? 1
        : 0
      : current / tracker.targetValue;

  if (tracker.kind === "upper-limit") {
    const className =
      tracker.targetValue === 0
        ? current > 0
          ? "bg-red-500"
          : "bg-stone-300"
        : current > tracker.targetValue
          ? "bg-red-500"
          : ratio >= 0.75
            ? "bg-amber-500"
            : "bg-stone-400";
    return { className, ratio: clampRatio(ratio) };
  }

  return { className: "bg-[var(--accent)]", ratio: clampRatio(ratio) };
}

const trackerPeriodBadges: Record<
  TrackerPeriod,
  { label: string; shortLabel: string }
> = {
  day: { label: "Daily tracker", shortLabel: "D" },
  week: { label: "Weekly tracker", shortLabel: "W" },
  month: { label: "Monthly tracker", shortLabel: "M" },
};

function compactTrackerValue(tracker: CustomTracker, value: number | null) {
  const displayValue =
    value === null && (tracker.aggregation === "sum" || tracker.aggregation === "count")
      ? 0
      : value;
  const formatted =
    tracker.aggregation === "count"
      ? formatTrackerValue(displayValue, tracker)
      : trackerValueWithUnit(displayValue, tracker);
  return tracker.aggregation === "count"
    ? `${formatted} ${displayValue === 1 ? "entry" : "entries"}`
    : formatted;
}

function trackerValueWithUnit(value: number | null, tracker: CustomTracker) {
  const formatted = formatTrackerValue(value, tracker);
  const unit = tracker.unit.trim();
  return unit ? `${formatted} ${unit}` : formatted;
}

function trackerBarLabel(tracker: CustomTracker, value: number | null) {
  const current = value ?? 0;
  const formatted = trackerValueWithUnit(current, tracker);
  const period = trackerPeriodLabels[tracker.period].toLowerCase();

  if (tracker.kind === "goal") {
    return tracker.targetValue === null
      ? `${tracker.name}: ${formatted}, ${period} goal tracker with no target set.`
      : `${tracker.name}: ${formatted} of ${trackerValueWithUnit(
          tracker.targetValue,
          tracker,
        )} ${period} target.`;
  }

  if (tracker.kind === "upper-limit") {
    return tracker.targetValue === null
      ? `${tracker.name}: ${formatted}, ${period} upper-limit tracker with no cap set.`
      : `${tracker.name}: ${formatted} of ${trackerValueWithUnit(
          tracker.targetValue,
          tracker,
        )} ${period} upper limit.`;
  }

  return `${tracker.name}: ${compactTrackerValue(tracker, value)}, ${period} ${trackerAggregationLabels[
    tracker.aggregation
  ].toLowerCase()} tracker.`;
}

function PersonalTrackersOverview({
  addStates,
  dateKey,
  entries,
  onAdd,
  onDetails,
  onQuickAdd,
  onViewAll,
  trackers,
  weekStartsOn,
}: {
  addStates: Record<string, SaveState>;
  dateKey: string;
  entries: CustomTrackerEntry[];
  onAdd: () => void;
  onDetails: (tracker: CustomTracker) => void;
  onQuickAdd: (tracker: CustomTracker) => void;
  onViewAll: () => void;
  trackers: CustomTracker[];
  weekStartsOn: CalendarPreferences["weekStartsOn"];
}) {
  const visibleMobileTrackers = trackers.slice(0, 3);

  return (
    <div className="today-internal-panel today-trackers-panel">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-stone-950">
          Personal trackers
        </h2>
        <button className="btn btn-primary-accent min-h-9 px-3 text-xs" onClick={onAdd} type="button">
          + Add
        </button>
      </div>

      {trackers.length > 0 && (
        <>
          <div
            aria-label="Pinned personal trackers"
            className="mt-2 hidden max-h-[232px] gap-1.5 overflow-y-auto pr-1 lg:grid"
            tabIndex={0}
          >
            {trackers.map((tracker) => (
              <CompactTrackerRow
                addState={addStates[tracker.id] ?? "idle"}
                entries={entriesForTrackerPeriod(
                  tracker,
                  entries,
                  dateKey,
                  weekStartsOn,
                )}
                key={tracker.id}
                onDetails={() => onDetails(tracker)}
                onQuickAdd={() => onQuickAdd(tracker)}
                tracker={tracker}
              />
            ))}
          </div>
          <div className="mt-2 grid gap-1.5 lg:hidden">
            {visibleMobileTrackers.map((tracker) => (
              <CompactTrackerRow
                addState={addStates[tracker.id] ?? "idle"}
                entries={entriesForTrackerPeriod(
                  tracker,
                  entries,
                  dateKey,
                  weekStartsOn,
                )}
                key={tracker.id}
                onDetails={() => onDetails(tracker)}
                onQuickAdd={() => onQuickAdd(tracker)}
                tracker={tracker}
              />
            ))}
            {trackers.length > 3 && (
              <button
                aria-label={`View all ${trackers.length} pinned personal trackers`}
                className="btn btn-tertiary-text justify-self-start"
                onClick={onViewAll}
                type="button"
              >
                View all {trackers.length} trackers
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function CompactTrackerRow({
  addState,
  entries,
  onDetails,
  onQuickAdd,
  tracker,
}: {
  addState: SaveState;
  entries: CustomTrackerEntry[];
  onDetails: () => void;
  onQuickAdd: () => void;
  tracker: CustomTracker;
}) {
  const value = aggregateTrackerValue(tracker, entries);
  const bar = trackerBarState(tracker, value);
  const periodBadge = trackerPeriodBadges[tracker.period];
  const currentValue = compactTrackerValue(tracker, value);
  return (
    <article className="rounded-[var(--wc-card-radius)] border border-stone-200 bg-stone-50 px-2.5 py-2">
      <div className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto_auto] items-center gap-2">
        <h3 className="truncate text-sm font-semibold text-stone-950">
          {tracker.name}
        </h3>
        <span
          aria-label={periodBadge.label}
          className="grid h-6 min-w-6 place-items-center rounded border border-stone-300 bg-white px-1 text-[11px] font-bold text-stone-700"
          title={trackerPeriodLabels[tracker.period]}
        >
          {periodBadge.shortLabel}
        </span>
        <p className="whitespace-nowrap text-right text-sm font-semibold text-stone-800">
          {currentValue}
        </p>
        <button
          aria-label={
            addState === "saved"
              ? `Added ${tracker.name}`
              : `Add entry to ${tracker.name}`
          }
          className="btn btn-primary-accent min-h-8 min-w-12 px-2.5 text-xs"
          disabled={addState === "saving"}
          onClick={onQuickAdd}
          type="button"
        >
          {addState === "saving"
            ? "Adding…"
            : addState === "saved"
              ? "✓"
              : "+"}
        </button>
        <button
          aria-label={`View ${tracker.name} details`}
          className="grid h-8 w-8 place-items-center rounded-full border border-stone-300 bg-white text-xs font-semibold text-stone-700"
          onClick={onDetails}
          type="button"
        >
          i
        </button>
      </div>
      <button
        aria-label={trackerBarLabel(tracker, value)}
        className="mt-1.5 block w-full text-left"
        onClick={onDetails}
        type="button"
      >
        {tracker.kind !== "log-only" && tracker.targetValue !== null ? (
          <div className="h-1.5 overflow-hidden rounded-full bg-stone-200">
            <span
              className={`block h-full rounded-full ${bar.className}`}
              style={{ width: `${bar.ratio * 100}%` }}
            />
          </div>
        ) : (
          <div className="h-1.5 overflow-hidden rounded-full bg-stone-200">
            <span className="block h-full w-8 rounded-full bg-stone-300" />
          </div>
        )}
      </button>
    </article>
  );
}

function blankTracker(order: number) {
  const now = new Date().toISOString();
  return {
    aggregation: "sum",
    colourKey: "accent",
    createdAt: now,
    decimalPlaces: 0,
    iconKey: "custom",
    id: makeId("tracker"),
    isEnabled: true,
    isPinnedToToday: true,
    kind: "goal",
    name: "",
    notes: "",
    order,
    period: "day",
    quickIncrement: 1,
    rangeMaximum: null,
    rangeMinimum: null,
    shortName: "",
    targetValue: null,
    unit: "",
    updatedAt: now,
  } satisfies CustomTracker;
}

function TrackerModal({
  dateKey,
  entries,
  modal,
  onAddEntry,
  onClose,
  onDeleteEntry,
  onDeleteTracker,
  onDuplicateTracker,
  onUpdateEntry,
  onSaveTracker,
  trackers,
  weekStartsOn,
}: {
  dateKey: string;
  entries: CustomTrackerEntry[];
  modal:
    | { type: "add" }
    | { type: "entry"; tracker: CustomTracker }
    | { type: "edit"; tracker: CustomTracker }
    | { type: "details"; tracker: CustomTracker }
    | { type: "list" };
  onAddEntry: (input: {
    date: string;
    note: string;
    time: string;
    tracker: CustomTracker;
    value: number;
  }) => void;
  onClose: () => void;
  onDeleteEntry: (entryId: string) => void;
  onDeleteTracker: (tracker: CustomTracker, withEntries?: boolean) => void;
  onDuplicateTracker: (tracker: CustomTracker) => void;
  onUpdateEntry: (entry: CustomTrackerEntry) => void;
  onSaveTracker: (tracker: CustomTracker) => void;
  trackers: CustomTracker[];
  weekStartsOn: CalendarPreferences["weekStartsOn"];
}) {
  const [selectedDraft, setSelectedDraft] = useState<CustomTracker | null>(
    modal.type === "add"
      ? blankTracker(trackers.length)
      : modal.type === "edit"
        ? modal.tracker
        : null,
  );
  const title =
    modal.type === "add"
      ? "Add personal tracker"
      : modal.type === "entry"
        ? modal.tracker.aggregation === "sum" || modal.tracker.aggregation === "count"
          ? `Add to ${modal.tracker.name}`
          : `Record ${modal.tracker.name}`
        : modal.type === "edit"
          ? "Edit tracker"
          : modal.type === "details"
            ? modal.tracker.name
            : "All personal trackers";

  return (
    <DialogFrame onClose={onClose} title={title}>
      {modal.type === "add" && selectedDraft && (
        <TrackerEditor
          mode="create"
          onCancel={onClose}
          onSave={onSaveTracker}
          tracker={selectedDraft}
        />
      )}

      {modal.type === "edit" && (
        <TrackerEditor
          mode="edit"
          onCancel={onClose}
            onDeleteTracker={(withEntries) => {
              const message = withEntries
                ? `Delete “${modal.tracker.name}”? Its tracker configuration and recorded entries will be removed.`
                : `Delete “${modal.tracker.name}”? Its tracker configuration will be removed. Existing recorded entries will remain in storage but no longer appear with this tracker.`;
              if (!window.confirm(message)) return;
              onDeleteTracker(modal.tracker, withEntries);
              onClose();
            }}
          onDuplicateTracker={() => {
            onDuplicateTracker(modal.tracker);
            onClose();
          }}
          onSave={onSaveTracker}
          tracker={modal.tracker}
        />
      )}

      {modal.type === "entry" && (
        <TrackerEntryForm onAdd={onAddEntry} onCancel={onClose} tracker={modal.tracker} />
      )}

      {modal.type === "details" && (
        selectedDraft ? (
          <TrackerEditor
            mode="edit"
            onCancel={() => setSelectedDraft(null)}
            onDeleteTracker={(withEntries) => {
              const message = withEntries
                ? `Delete “${modal.tracker.name}”? Its tracker configuration and recorded entries will be removed.`
                : `Delete “${modal.tracker.name}”? Its tracker configuration will be removed. Existing recorded entries will remain in storage but no longer appear with this tracker.`;
              if (!window.confirm(message)) return;
              onDeleteTracker(modal.tracker, withEntries);
              onClose();
            }}
            onDuplicateTracker={() => {
              onDuplicateTracker(modal.tracker);
              onClose();
            }}
            onSave={onSaveTracker}
            tracker={selectedDraft}
          />
        ) : (
          <TrackerDetails
            dateKey={dateKey}
            entries={entries}
            onDeleteEntry={onDeleteEntry}
            onSaveEntry={onUpdateEntry}
            onEditTracker={() => setSelectedDraft(modal.tracker)}
            tracker={modal.tracker}
            weekStartsOn={weekStartsOn}
          />
        )
      )}

      {modal.type === "list" && (
        <div className="grid gap-2">
          {trackers.length === 0 ? (
            <p className="rounded-md bg-stone-50 p-3 text-sm text-stone-500">
              No personal trackers yet.
            </p>
          ) : (
            trackers.map((tracker) => {
              const periodEntries = entriesForTrackerPeriod(
                tracker,
                entries,
                dateKey,
                weekStartsOn,
              );
              const value = aggregateTrackerValue(tracker, periodEntries);
              return (
                <div className="rounded-md border border-stone-200 p-3" key={tracker.id}>
                  <p className="font-semibold text-stone-950">{tracker.name}</p>
                  <p className="mt-1 text-sm text-stone-600">
                    {trackerTargetText(tracker, value)}
                  </p>
                  <p className="mt-1 text-xs text-stone-500">
                    {trackerKindLabels[tracker.kind]} ·{" "}
                    {trackerPeriodLabels[tracker.period]} ·{" "}
                    {trackerAggregationLabels[tracker.aggregation]}
                  </p>
                </div>
              );
            })
          )}
        </div>
      )}
    </DialogFrame>
  );
}

function TrackerEditor({
  mode,
  onCancel,
  onDeleteTracker,
  onDuplicateTracker,
  onSave,
  tracker,
}: {
  mode: "create" | "edit";
  onCancel: () => void;
  onDeleteTracker?: (withEntries: boolean) => void;
  onDuplicateTracker?: () => void;
  onSave: (tracker: CustomTracker) => void;
  tracker: CustomTracker;
}) {
  const [draft, setDraft] = useState<CustomTracker>(tracker);
  const [showMoreOptions, setShowMoreOptions] = useState(mode === "edit");
  const [target, setTarget] = useState(
    tracker.kind === "goal" && tracker.targetValue !== null
      ? String(tracker.targetValue)
      : "",
  );
  const [cap, setCap] = useState(
    tracker.kind === "upper-limit" && tracker.targetValue !== null
      ? String(tracker.targetValue)
      : "",
  );
  const [quickIncrement, setQuickIncrement] = useState(String(tracker.quickIncrement));
  const [decimalPlaces, setDecimalPlaces] = useState(String(tracker.decimalPlaces));
  const [notes, setNotes] = useState(tracker.notes);
  const [error, setError] = useState("");
  const isCreate = mode === "create";

  function submit() {
    const nextQuick = Number(quickIncrement);
    const nextDecimals = Number(decimalPlaces);
    const nextTarget: number | null = target.trim() === "" ? null : Number(target);
    const nextCap: number | null = cap.trim() === "" ? null : Number(cap);
    if (!draft.name.trim()) {
      setError("Name is required.");
      return;
    }
    if (!Number.isFinite(nextQuick) || nextQuick < 0) {
      setError("Quick increment must be zero or greater.");
      return;
    }
    if (!Number.isFinite(nextDecimals) || nextDecimals < 0 || nextDecimals > 3) {
      setError("Decimal places must be between 0 and 3.");
      return;
    }
    if (
      target.trim() !== "" &&
      (nextTarget === null || !Number.isFinite(nextTarget) || nextTarget < 0)
    ) {
      setError("Target must be zero or greater.");
      return;
    }
    if (
      cap.trim() !== "" &&
      (nextCap === null || !Number.isFinite(nextCap) || nextCap < 0)
    ) {
      setError("Limit / cap must be zero or greater.");
      return;
    }
    if (isCreate && nextTarget !== null && nextCap !== null) {
      setError("Use either a target or a limit / cap, not both.");
      return;
    }
    const nextKind: TrackerKind = isCreate
      ? nextCap !== null
        ? "upper-limit"
        : nextTarget !== null
          ? "goal"
          : "log-only"
      : draft.kind;
    const nextTargetValue = isCreate
      ? nextCap ?? nextTarget
      : draft.kind === "log-only"
        ? null
        : draft.kind === "upper-limit"
          ? nextCap
          : nextTarget;
    onSave({
      ...draft,
      name: draft.name.trim(),
      shortName: draft.shortName.trim() || draft.name.trim(),
      unit: draft.unit.trim(),
      kind: nextKind,
      targetValue: nextTargetValue,
      quickIncrement: nextQuick,
      decimalPlaces: Math.round(nextDecimals),
      notes: notes.trim(),
    });
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-3">
        <TextInput
          label="Name *"
          onChange={(value) => setDraft((current) => ({ ...current, name: value }))}
          value={draft.name}
        />
        <TextInput
          label="Unit, optional"
          onChange={(value) => setDraft((current) => ({ ...current, unit: value }))}
          value={draft.unit}
        />
        {isCreate && (
          <button
            className="btn btn-secondary-outline justify-self-start"
            onClick={() => setShowMoreOptions((current) => !current)}
            type="button"
          >
            {showMoreOptions ? "Less options" : "More options"}
          </button>
        )}
      </div>

      {showMoreOptions && (
        <div className="grid gap-4 rounded-xl border border-stone-200 bg-stone-50/60 p-3">
          {!isCreate && (
            <TextInput
              label="Short name"
              onChange={(value) =>
                setDraft((current) => ({ ...current, shortName: value }))
              }
              value={draft.shortName}
            />
          )}
          {!isCreate && (
            <SelectField
              label="Kind"
              onChange={(value) =>
                setDraft((current) => ({ ...current, kind: value as TrackerKind }))
              }
              options={[
                ["goal", "Goal"],
                ["upper-limit", "Upper limit"],
                ["log-only", "Log only"],
              ]}
              value={draft.kind}
            />
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <SelectField
              label="Period"
              onChange={(value) =>
                setDraft((current) => ({ ...current, period: value as TrackerPeriod }))
              }
              options={[
                ["day", "Daily"],
                ["week", "Weekly"],
                ["month", "Monthly"],
              ]}
              value={draft.period}
            />
            <SelectField
              label="Aggregation"
              onChange={(value) =>
                setDraft((current) => ({
                  ...current,
                  aggregation: value as TrackerAggregation,
                }))
              }
              options={[
                ["sum", "Sum"],
                ["latest", "Latest"],
                ["average", "Average"],
                ["count", "Count"],
              ]}
              value={draft.aggregation}
            />
          </div>
          {isCreate ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <TextInput
                label="Target, optional"
                onChange={setTarget}
                type="number"
                value={target}
              />
              <TextInput
                label="Limit / cap, optional"
                onChange={setCap}
                type="number"
                value={cap}
              />
            </div>
          ) : (
            draft.kind !== "log-only" && (
              <TextInput
                label={
                  draft.kind === "goal"
                    ? "Value to work toward"
                    : "Maximum you do not want to exceed"
                }
                onChange={draft.kind === "upper-limit" ? setCap : setTarget}
                type="number"
                value={draft.kind === "upper-limit" ? cap : target}
              />
            )
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <TextInput
              label="Quick-add amount, optional"
              onChange={setQuickIncrement}
              type="number"
              value={quickIncrement}
            />
            {!isCreate && (
              <TextInput
                label="Decimal places"
                onChange={setDecimalPlaces}
                type="number"
                value={decimalPlaces}
              />
            )}
          </div>
          <TextInput label="Notes, optional" onChange={setNotes} value={notes} />
          {!isCreate && (
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="flex min-h-10 items-center gap-2 text-sm font-medium text-stone-700">
                <input
                  checked={draft.isPinnedToToday}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      isPinnedToToday: event.target.checked,
                    }))
                  }
                  type="checkbox"
                />
                Pin to Today
              </label>
              <label className="flex min-h-10 items-center gap-2 text-sm font-medium text-stone-700">
                <input
                  checked={draft.isEnabled}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      isEnabled: event.target.checked,
                    }))
                  }
                  type="checkbox"
                />
                Enabled
              </label>
            </div>
          )}
        </div>
      )}
      {error && <p className="text-sm font-medium text-red-700">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-tertiary-text" onClick={onCancel} type="button">
          Cancel
        </button>
        <button className="btn btn-primary-dark" onClick={submit} type="button">
          {isCreate ? "Save tracker" : "Save changes"}
        </button>
        {onDuplicateTracker && (
          <button className="btn btn-secondary-outline" onClick={onDuplicateTracker} type="button">
            Duplicate
          </button>
        )}
        {onDeleteTracker && (
          <>
            <button
              className="btn btn-destructive"
              onClick={() => onDeleteTracker(false)}
              type="button"
            >
              Delete tracker
            </button>
            <button
              className="btn btn-destructive"
              onClick={() => onDeleteTracker(true)}
              type="button"
            >
              Delete tracker and entries
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function TrackerEntryForm({
  onAdd,
  onCancel,
  tracker,
}: {
  onAdd: (input: {
    date: string;
    note: string;
    time: string;
    tracker: CustomTracker;
    value: number;
  }) => void;
  onCancel: () => void;
  tracker: CustomTracker;
}) {
  const [value, setValue] = useState(
    tracker.aggregation === "count" ? "1" : String(tracker.quickIncrement),
  );
  const [date, setDate] = useState(localDateKey());
  const [time, setTime] = useState(currentLocalTime());
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  function submit() {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setError("Value must be zero or greater.");
      return;
    }
    onAdd({ date, note, time, tracker, value: parsed });
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <TextInput
          label={
            tracker.aggregation === "sum" || tracker.aggregation === "count"
              ? `Value * (${tracker.unit || "value"})`
              : `Value * (${tracker.unit || "value"})`
          }
          onChange={setValue}
          type="number"
          value={value}
        />
        <TextInput label="Date" onChange={setDate} type="date" value={date} />
        <TextInput label="Time" onChange={setTime} type="time" value={time} />
      </div>
      <TextInput label="Entry name, optional" onChange={setNote} value={note} />
      {error && <p className="text-sm font-medium text-red-700">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-primary-dark" onClick={submit} type="button">
          Add entry
        </button>
        <button className="btn btn-tertiary-text" onClick={onCancel} type="button">
          Cancel
        </button>
      </div>
    </div>
  );
}

function TrackerDetails({
  dateKey,
  entries,
  onDeleteEntry,
  onSaveEntry,
  onEditTracker,
  tracker,
  weekStartsOn,
}: {
  dateKey: string;
  entries: CustomTrackerEntry[];
  onDeleteEntry: (entryId: string) => void;
  onSaveEntry: (entry: CustomTrackerEntry) => void;
  onEditTracker: () => void;
  tracker: CustomTracker;
  weekStartsOn: CalendarPreferences["weekStartsOn"];
}) {
  const summaries = trackerPeriodSummaries(tracker, entries, dateKey, weekStartsOn);
  const currentSummary = trackerPeriodSummaryForDate(
    tracker,
    entries,
    dateKey,
    weekStartsOn,
  );
  const [selectedPeriodStart, setSelectedPeriodStart] = useState(
    currentSummary.periodStart,
  );
  const [editingEntry, setEditingEntry] = useState<CustomTrackerEntry | null>(null);
  const selectedSummary =
    summaries.find((summary) => summary.periodStart === selectedPeriodStart) ??
    currentSummary;
  const historySummaries = summaries.filter(
    (summary) => summary.periodStart !== currentSummary.periodStart,
  );
  const value = currentSummary.value;
  const selectedValue = selectedSummary.value;

  function saveEditedEntry(entry: CustomTrackerEntry) {
    onSaveEntry(entry);
    setEditingEntry(null);
  }

  function exportSummaries(periodOnly: boolean) {
    const exportEntries = periodOnly
      ? selectedSummary.entries
      : entries.filter((entry) => entry.trackerId === tracker.id);
    downloadTrackerEntriesCsv({
      entries: exportEntries,
      fileSuffix: periodOnly ? selectedSummary.periodStart : "history",
      tracker,
      weekStartsOn,
    });
  }

  return (
    <div className="grid gap-4">
      <div className="rounded-md bg-stone-50 p-3">
        <p className="text-sm font-semibold text-stone-500">
          {trackerKindLabels[tracker.kind]} · {trackerPeriodLabels[tracker.period]} ·{" "}
          {trackerAggregationLabels[tracker.aggregation]}
        </p>
        <p className="mt-1 text-xl font-semibold text-stone-950">
          {trackerTargetText(tracker, value)}
        </p>
        <p className="mt-1 text-sm text-stone-500">
          {trackerSecondaryText(tracker, value)}
        </p>
        <button
          className="btn btn-secondary-outline mt-3 min-h-9 px-3 text-xs"
          onClick={onEditTracker}
          type="button"
        >
          Edit / Delete
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          className="btn btn-primary-accent min-h-9 px-3 text-xs"
          onClick={() => setEditingEntry(createBlankTrackerEntry(tracker))}
          type="button"
        >
          + Add entry
        </button>
        <button
          className="btn btn-secondary-outline min-h-9 px-3 text-xs"
          onClick={() => exportSummaries(true)}
          type="button"
        >
          Export this period
        </button>
        <button
          className="btn btn-secondary-outline min-h-9 px-3 text-xs"
          onClick={() => exportSummaries(false)}
          type="button"
        >
          Export tracker history
        </button>
      </div>
      {editingEntry && (
        <TrackerEntryEditor
          entry={editingEntry}
          isNew={!entries.some((entry) => entry.id === editingEntry.id)}
          onCancel={() => setEditingEntry(null)}
          onSave={saveEditedEntry}
          tracker={tracker}
        />
      )}
      <div>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
              {selectedSummary.periodStart === currentSummary.periodStart
                ? "Current period"
                : "Selected period"}
            </h3>
            <p className="mt-1 text-base font-semibold text-stone-950">
              {formatTrackerPeriodRange(selectedSummary)}
            </p>
          </div>
          <p className="text-sm font-semibold text-stone-700">
            {compactTrackerValue(tracker, selectedValue)}
          </p>
        </div>
        <div className="mt-2 grid gap-2">
          {selectedSummary.entries.length === 0 ? (
            <p className="rounded-md bg-stone-50 p-3 text-sm text-stone-500">
              No entries in this period.
            </p>
          ) : (
            [...selectedSummary.entries]
              .sort((a, b) =>
                `${entryDateKey(b)} ${entryTimeKey(b)}`.localeCompare(
                  `${entryDateKey(a)} ${entryTimeKey(a)}`,
                ),
              )
              .map((entry) => (
                <div
                  className="grid gap-2 rounded-md border border-stone-200 p-3 text-sm sm:grid-cols-[1fr_auto]"
                  key={entry.id}
                >
                  <div>
                    <p className="font-semibold text-stone-900">
                      {trackerValueWithUnit(entry.value, tracker)}
                      {entry.note ? ` · ${entry.note}` : ""}
                    </p>
                    <p className="mt-1 text-stone-500">
                      {entryDateKey(entry)} at {entryTimeKey(entry)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 sm:justify-end">
                    <button
                      className="btn btn-secondary-outline min-h-9 px-3 text-xs"
                      onClick={() => setEditingEntry(entry)}
                      type="button"
                    >
                      Edit
                    </button>
                    <button
                      className="btn btn-destructive min-h-9 px-3 text-xs"
                      onClick={() => onDeleteEntry(entry.id)}
                      type="button"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))
          )}
        </div>
      </div>
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
          History
        </h3>
        <div className="mt-2 grid gap-2">
          {historySummaries.length === 0 ? (
            <p className="rounded-md bg-stone-50 p-3 text-sm text-stone-500">
              Previous periods appear here after entries are recorded.
            </p>
          ) : (
            historySummaries.map((summary) => (
              <button
                className={`grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 rounded-md border p-3 text-left text-sm ${
                  summary.periodStart === selectedSummary.periodStart
                    ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                    : "border-stone-200 bg-white hover:border-stone-300"
                }`}
                key={summary.periodStart}
                onClick={() => setSelectedPeriodStart(summary.periodStart)}
                type="button"
              >
                <span className="min-w-0 font-medium text-stone-800">
                  {formatTrackerPeriodRange(summary)}
                </span>
                <span className="font-semibold text-stone-950">
                  {compactTrackerValue(tracker, summary.value)}
                </span>
                <span aria-hidden="true" className="text-stone-400">
                  ›
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function createBlankTrackerEntry(tracker: CustomTracker) {
  const now = new Date().toISOString();
  const date = localDateKey();
  const time = currentLocalTime();
  return {
    createdAt: now,
    date,
    id: makeId("tracker-entry"),
    note: "",
    occurredAt: makeTrackerOccurredAt(date, time),
    time,
    trackerId: tracker.id,
    updatedAt: now,
    value: tracker.aggregation === "count" ? 1 : tracker.quickIncrement,
  } satisfies CustomTrackerEntry;
}

function TrackerEntryEditor({
  entry,
  isNew,
  onCancel,
  onSave,
  tracker,
}: {
  entry: CustomTrackerEntry;
  isNew: boolean;
  onCancel: () => void;
  onSave: (entry: CustomTrackerEntry) => void;
  tracker: CustomTracker;
}) {
  const [value, setValue] = useState(String(entry.value));
  const [date, setDate] = useState(entryDateKey(entry));
  const [time, setTime] = useState(entryTimeKey(entry));
  const [note, setNote] = useState(entry.note);
  const [error, setError] = useState("");
  const valueRef = useRef<HTMLInputElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);
  const timeRef = useRef<HTMLInputElement>(null);
  const noteRef = useRef<HTMLInputElement>(null);

  function submit() {
    const currentValue = valueRef.current?.value ?? value;
    const currentDate = dateRef.current?.value ?? date;
    const currentTime = timeRef.current?.value ?? time;
    const currentNote = noteRef.current?.value ?? note;
    const parsed = Number(currentValue);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setError("Value must be zero or greater.");
      return;
    }
    if (!currentDate) {
      setError("Date is required.");
      return;
    }
    if (!currentTime) {
      setError("Time is required.");
      return;
    }
    onSave({
      ...entry,
      date: currentDate,
      note: currentNote.trim(),
      occurredAt: makeTrackerOccurredAt(currentDate, currentTime),
      time: currentTime,
      value: parsed,
    });
  }

  return (
    <div className="rounded-xl border border-stone-200 bg-stone-50/70 p-3">
      <h3 className="text-sm font-semibold text-stone-950">
        {isNew ? `Add ${tracker.name} entry` : "Edit entry"}
      </h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <TextInput
          inputRef={valueRef}
          label={tracker.aggregation === "sum" || tracker.aggregation === "count" ? "Value" : "Value"}
          onChange={setValue}
          type="number"
          value={value}
        />
        <TextInput inputRef={dateRef} label="Date" onChange={setDate} type="date" value={date} />
        <TextInput inputRef={timeRef} label="Time" onChange={setTime} type="time" value={time} />
      </div>
      <div className="mt-3">
        <TextInput
          inputRef={noteRef}
          label="Entry name, optional"
          onChange={setNote}
          value={note}
        />
      </div>
      {error && <p className="mt-2 text-sm font-medium text-red-700">{error}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <button className="btn btn-tertiary-text" onClick={onCancel} type="button">
          Cancel
        </button>
        <button className="btn btn-primary-dark" onClick={submit} type="button">
          {isNew ? "Add entry" : "Save changes"}
        </button>
      </div>
    </div>
  );
}

function formatShortDate(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Intl.DateTimeFormat(DISPLAY_LOCALE, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(year, month - 1, day, 12));
}

function formatMonthPeriod(dateKey: string) {
  const [year, month] = dateKey.split("-").map(Number);
  return new Intl.DateTimeFormat(DISPLAY_LOCALE, {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 1, 12));
}

function formatTrackerPeriodRange(summary: TrackerPeriodSummary) {
  if (summary.periodType === "day") return formatShortDate(summary.periodStart);
  if (summary.periodType === "month") return formatMonthPeriod(summary.periodStart);
  return `${formatShortDate(summary.periodStart)} – ${formatShortDate(summary.periodEnd)}`;
}

function csvEscape(value: string | number | null | undefined) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function fileSafe(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function downloadTrackerEntriesCsv({
  entries,
  fileSuffix,
  tracker,
  weekStartsOn,
}: {
  entries: CustomTrackerEntry[];
  fileSuffix: string;
  tracker: CustomTracker;
  weekStartsOn: CalendarPreferences["weekStartsOn"];
}) {
  const rows = [
    ["tracker", "period", "date", "time", "value", "note"],
    ...[...entries]
      .sort((a, b) =>
        `${entryDateKey(a)} ${entryTimeKey(a)}`.localeCompare(
          `${entryDateKey(b)} ${entryTimeKey(b)}`,
        ),
      )
      .map((entry) => {
        const summary = trackerPeriodSummaryForDate(
          tracker,
          entries,
          entryDateKey(entry),
          weekStartsOn,
        );
        return [
          tracker.name,
          formatTrackerPeriodRange(summary),
          entryDateKey(entry),
          entryTimeKey(entry),
          entry.value,
          entry.note,
        ];
      }),
  ];
  const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `wellcanvas-${fileSafe(tracker.name)}-${fileSafe(fileSuffix)}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function SelectField({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  options: Array<[string, string]>;
  value: string;
}) {
  return (
    <label>
      <span className="text-sm font-medium text-stone-700">{label}</span>
      <select
        className="mt-2 min-h-11 w-full rounded-md border border-stone-300 bg-white px-3 text-sm outline-none focus:border-stone-900"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

function DialogFrame({
  children,
  onClose,
  title,
}: {
  children: React.ReactNode;
  onClose: () => void;
  title: string;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const titleRef = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => {
    titleRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab" || !panelRef.current) return;

      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      aria-labelledby="today-dialog-title"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end bg-stone-950/35 p-0 sm:items-center sm:justify-center sm:p-4"
      role="dialog"
    >
      <button
        aria-label="Close dialog"
        className="absolute inset-0 h-full w-full cursor-default"
        onClick={onClose}
        type="button"
      />
      <div
        className="relative max-h-[calc(100dvh-1rem)] w-full max-w-[calc(100vw-1rem)] overflow-hidden rounded-t-[var(--wc-section-radius)] bg-white shadow-2xl sm:max-h-[min(760px,calc(100dvh-2rem))] sm:max-w-3xl sm:rounded-[var(--wc-section-radius)]"
        ref={panelRef}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-stone-200 bg-white px-4 py-3 sm:px-5">
          <h2
            className="text-lg font-semibold text-stone-950 outline-none"
            id="today-dialog-title"
            ref={titleRef}
            tabIndex={-1}
          >
            {title}
          </h2>
          <button
            aria-label="Close"
            className="min-h-9 rounded-md border border-stone-300 px-3 text-sm font-semibold text-stone-800"
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        </div>
        <div className="max-h-[calc(100dvh-5rem)] overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 sm:max-h-[680px] sm:px-5">
          {children}
        </div>
      </div>
    </div>
  );
}

function parseOptionalNonNegative(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : Number.NaN;
}

function quickActivityMet(
  activityType: ActivityType,
  intensity: ActivityIntensity,
) {
  const byIntensity = {
    light: 0,
    moderate: 1,
    vigorous: 2,
  }[intensity];
  const values: Record<ActivityType, [number | null, number | null, number | null]> = {
    walking: [2.8, 3.8, 5.5],
    jogging: [6.5, 7.8, 7.8],
    running: [8.5, 9.3, 11],
    treadmill: [2.8, 7.8, 9.3],
    cycling: [4.3, 7, 9],
    "table-tennis": [4, 4, 5],
    tennis: [5, 6.8, 8],
    strength: [3.5, 5, 6],
    other: [null, null, null],
  };
  return values[activityType][byIntensity];
}

function activityUncertainty(activityType: ActivityType) {
  if (activityType === "strength") return 35;
  if (activityType === "table-tennis" || activityType === "tennis") return 30;
  if (activityType === "other") return null;
  return 25;
}

function AddActivityModal({
  onAdd,
  onClose,
}: {
  onAdd: (entry: ActivityEntry) => void;
  onClose: () => void;
}) {
  const [activityType, setActivityType] = useState<ActivityType>("walking");
  const [date, setDate] = useState(localDateKey());
  const [dateTouched, setDateTouched] = useState(false);
  const [startTime, setStartTime] = useState(currentLocalTime());
  const [duration, setDuration] = useState("30");
  const [intensity, setIntensity] = useState<ActivityIntensity>("moderate");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");

  useEffect(() => {
    function handleLocalDayChange() {
      if (dateTouched) return;
      setDate(localDateKey());
      setStartTime(currentLocalTime());
    }

    window.addEventListener(LOCAL_DAY_CHANGED_EVENT, handleLocalDayChange);
    return () => {
      window.removeEventListener(LOCAL_DAY_CHANGED_EVENT, handleLocalDayChange);
    };
  }, [dateTouched]);

  function submit() {
    const durationMinutes = Number(duration);
    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
      setError("Enter a positive duration.");
      return;
    }

    setError("");
    setSaveState("saving");
    window.setTimeout(() => {
      const now = new Date().toISOString();
      const metValue = quickActivityMet(activityType, intensity);
      const weightUsedKg = weightForActivity(date);
      const estimatedActiveCaloriesKcal = estimateActiveCalories({
        durationMinutes,
        metValue,
        weightKg: weightUsedKg,
      });
      onAdd({
        activityType,
        averageRepetitions: null,
        calorieEstimateUncertaintyPercent:
          estimatedActiveCaloriesKcal === null
            ? null
            : activityUncertainty(activityType),
        calorieSource:
          estimatedActiveCaloriesKcal === null ? "not-estimated" : "met-estimate",
        createdAt: now,
        date,
        displayName: activityTypeLabels[activityType],
        distanceKm: null,
        durationMinutes,
        estimatedActiveCaloriesKcal,
        exercises: [],
        id: makeId("activity"),
        inclinePercent: null,
        intensity,
        metValue,
        notes,
        perceivedEffort: null,
        speedKmh: null,
        startTime,
        strengthMode: activityType === "strength" ? "quick" : null,
        totalSets: null,
        updatedAt: now,
        weightUsedKg,
        workoutSnapshot: null,
        workoutTemplateId: null,
      });
      setSaveState("saved");
    }, 180);
  }

  return (
    <DialogFrame onClose={onClose} title="Add activity">
      <div className="grid gap-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {(
            [
              "walking",
              "jogging",
              "running",
              "cycling",
              "table-tennis",
              "tennis",
              "strength",
              "other",
            ] as ActivityType[]
          ).map((type) => (
            <button
              className={`min-h-10 rounded-md px-3 text-sm font-semibold ${
                activityType === type
                  ? "accent-selected"
                  : "border border-stone-300 text-stone-800"
              }`}
              key={type}
              onClick={() => setActivityType(type)}
              type="button"
            >
              {activityTypeLabels[type]}
            </button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <TextInput
            label="Date"
            onChange={(value) => {
              setDate(value);
              setDateTouched(true);
            }}
            type="date"
            value={date}
          />
          <TextInput
            label="Start time"
            onChange={setStartTime}
            type="time"
            value={startTime}
          />
          <TextInput
            label="Duration"
            onChange={setDuration}
            type="number"
            value={duration}
          />
        </div>
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(intensityLabels) as ActivityIntensity[]).map((value) => (
            <button
              className={`min-h-10 rounded-md px-3 text-sm font-semibold ${
                intensity === value
                  ? "accent-selected"
                  : "border border-stone-300 text-stone-800"
              }`}
              key={value}
              onClick={() => setIntensity(value)}
              type="button"
            >
              {intensityLabels[value]}
            </button>
          ))}
        </div>
        <TextInput label="Notes, optional" onChange={setNotes} value={notes} />
        {error && <p className="text-sm font-medium text-red-700">{error}</p>}
        <button
          className="min-h-11 rounded-md bg-stone-900 px-4 text-sm font-semibold text-white"
          disabled={saveState === "saving"}
          onClick={submit}
          type="button"
        >
          {saveState === "saving"
            ? "Saving…"
            : saveState === "saved"
              ? "✓ Saved"
              : "Save activity"}
        </button>
      </div>
    </DialogFrame>
  );
}

function AddDrinkModal({
  defaultVolumeMl,
  entry,
  onAdd,
  onClose,
  onUpdate,
}: {
  defaultVolumeMl: number;
  entry: HydrationEntry | null;
  onAdd: (entry: HydrationEntry) => void;
  onClose: () => void;
  onUpdate: (entry: HydrationEntry) => void;
}) {
  const [beverageType, setBeverageType] = useState<BeverageType>(
    entry?.beverageType ?? "tap-water",
  );
  const [volumeMl, setVolumeMl] = useState(String(entry?.volumeMl ?? defaultVolumeMl));
  const [customName, setCustomName] = useState(entry?.displayName ?? "");
  const [customCalories, setCustomCalories] = useState(
    entry?.caloriesKcal === null || entry?.caloriesKcal === undefined
      ? ""
      : String(entry.caloriesKcal),
  );
  const [customCarbs, setCustomCarbs] = useState(
    entry?.carbohydratesG === null || entry?.carbohydratesG === undefined
      ? ""
      : String(entry.carbohydratesG),
  );
  const [customSodium, setCustomSodium] = useState(
    entry?.sodiumMg === null || entry?.sodiumMg === undefined
      ? ""
      : String(entry.sodiumMg),
  );
  const [customNotes, setCustomNotes] = useState(entry?.notes ?? "");
  const [error, setError] = useState("");

  function submit() {
    setError("");
    const parsedVolume = Number(volumeMl);
    if (!Number.isFinite(parsedVolume) || parsedVolume <= 0) {
      setError("Enter a positive drink volume.");
      return;
    }

    const calories = parseOptionalNonNegative(customCalories);
    const carbs = parseOptionalNonNegative(customCarbs);
    const sodium = parseOptionalNonNegative(customSodium);
    if ([calories, carbs, sodium].some((value) => Number.isNaN(value))) {
      setError("Nutrition values must be non-negative numbers.");
      return;
    }

    const nextEntry = createHydrationEntry({
      beverageType,
      manualNutrition:
        beverageType === "other"
          ? {
              caloriesKcal: calories,
              carbohydratesG: carbs,
              displayName: customName,
              notes: customNotes,
              nutritionStatus:
                calories === null && carbs === null && sodium === null
                  ? "missing"
                  : "estimated",
              sodiumMg: sodium,
            }
          : undefined,
      volumeMl: parsedVolume,
    });

    if (entry) {
      onUpdate({ ...nextEntry, id: entry.id, createdAt: entry.createdAt });
    } else {
      onAdd(nextEntry);
    }
  }

  return (
    <DialogFrame onClose={onClose} title={entry ? "Edit drink" : "Add drink"}>
      <div className="grid gap-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {(Object.keys(beverageLabels) as BeverageType[]).map((type) => (
            <button
              className={`min-h-10 rounded-md px-3 text-sm font-semibold ${
                beverageType === type
                  ? "accent-selected"
                  : "border border-stone-300 text-stone-800"
              }`}
              key={type}
              onClick={() => setBeverageType(type)}
              type="button"
            >
              {beverageLabels[type]}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {[150, 250, 330, 500].map((volume) => (
            <button
              className={`min-h-10 rounded-md px-3 text-sm font-semibold ${
                volumeMl === String(volume)
                  ? "accent-selected"
                  : "border border-stone-300 text-stone-800"
              }`}
              key={volume}
              onClick={() => setVolumeMl(String(volume))}
              type="button"
            >
              {volume} ml
            </button>
          ))}
          <label className="flex min-h-10 items-center gap-2 rounded-md border border-stone-300 px-3 text-sm font-semibold text-stone-800">
            Custom
            <input
              className="w-20 border-l border-stone-200 pl-2 outline-none"
              inputMode="decimal"
              onChange={(event) => setVolumeMl(event.target.value)}
              type="text"
              value={volumeMl}
            />
          </label>
        </div>
        {beverageType === "sweet-soda" && (
          <p className="rounded-md bg-stone-50 p-3 text-sm text-stone-600">
            {volumeMl || "0"} ml sweet soda: approximately{" "}
            {formatNumber(Number(volumeMl || 0) * 0.42, 0)} kcal.
          </p>
        )}
        {beverageType === "other" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <TextInput label="Drink name" onChange={setCustomName} value={customName} />
            <TextInput
              label="Calories for this volume"
              onChange={setCustomCalories}
              type="number"
              value={customCalories}
            />
            <TextInput
              label="Carbohydrates (g)"
              onChange={setCustomCarbs}
              type="number"
              value={customCarbs}
            />
            <TextInput
              label="Sodium (mg)"
              onChange={setCustomSodium}
              type="number"
              value={customSodium}
            />
            <label className="sm:col-span-2">
              <span className="text-sm font-medium text-stone-700">Notes</span>
              <input
                className="mt-2 min-h-11 w-full rounded-md border border-stone-300 px-3 text-sm outline-none focus:border-stone-900"
                onChange={(event) => setCustomNotes(event.target.value)}
                value={customNotes}
              />
            </label>
          </div>
        )}
        {error && <p className="text-sm font-medium text-red-700">{error}</p>}
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            className="min-h-11 rounded-md bg-stone-900 px-4 text-sm font-semibold text-white"
            onClick={submit}
            type="button"
          >
            {entry ? "Save drink" : "Add drink"}
          </button>
          {!entry && (
            <a
              className="btn btn-secondary-outline min-h-11 px-4 text-sm"
              href="/foods?tool=drink"
            >
              Create reusable drink
            </a>
          )}
        </div>
      </div>
    </DialogFrame>
  );
}

function MealTypePills({
  onChange,
  value,
}: {
  onChange: (mealType: FoodLogEntry["mealType"]) => void;
  value: FoodLogEntry["mealType"];
}) {
  return (
    <div>
      <p className="text-sm font-medium text-stone-700">Meal type</p>
      <div className="mt-2 grid grid-cols-4 gap-2">
        {mealTypes.map((mealType) => (
          <button
            className={`min-h-10 rounded-md px-2 text-sm font-semibold ${
              value === mealType
                ? "accent-selected"
                : "border border-stone-300 text-stone-800"
            }`}
            key={mealType}
            onClick={() => onChange(mealType)}
            type="button"
          >
            {mealTypeLabel(mealType)}
          </button>
        ))}
      </div>
    </div>
  );
}

type AddFoodSearchResult =
  | {
      item: MealTemplate;
      key: string;
      name: string;
      nutritionStatus: NutritionStatus;
      nutritionSummary: string;
      recentAt: string;
      score: number;
      servingSummary: string;
      type: "meal";
    }
  | {
      item: FoodItem;
      key: string;
      name: string;
      nutritionStatus: NutritionStatus;
      nutritionSummary: string;
      recentAt: string;
      score: number;
      servingSummary: string;
      type: "food";
    };

function recentSourceKey(entry: FoodLogEntry) {
  if ((entry.sourceType === "meal" || entry.sourceType === "food") && entry.sourceId) {
    return `${entry.sourceType}:${entry.sourceId}`;
  }
  return `${entry.sourceType}:${normalizeFoodSearchText(entry.name)}`;
}

function AddFoodModal({
  collectionSuggestions,
  foods,
  meals,
  onAddFood,
  onAddEntry,
  onAddMeal,
  onAddRecent,
  onClose,
  onSaveFood,
  onSaveAndAddNewFood,
  onSaveMeal,
  onSaveNewFoodOnly,
  recentEntries,
  state,
}: {
  collectionSuggestions: string[];
  foods: FoodItem[];
  meals: MealTemplate[];
  onAddFood: (
    food: FoodItem,
    mealType: FoodLogEntry["mealType"],
    quantity: number,
  ) => void;
  onAddMeal: (
    meal: MealTemplate,
    mealType: FoodLogEntry["mealType"],
    quantity: number,
  ) => void;
  onAddRecent: (
    entry: FoodLogEntry,
    mealType: FoodLogEntry["mealType"],
    quantity: number,
  ) => void;
  onAddEntry: (entry: FoodLogEntry) => void;
  onClose: () => void;
  onSaveFood: (food: FoodItem) => void;
  onSaveAndAddNewFood: (
    food: FoodItem,
    saveToLibrary: boolean,
    mealType: FoodLogEntry["mealType"],
  ) => void;
  onSaveMeal: (meal: MealTemplate) => void;
  onSaveNewFoodOnly: (food: FoodItem) => void;
  recentEntries: FoodLogEntry[];
  state: AddFoodModalState;
}) {
  const [activeTab, setActiveTab] = useState<AddFoodTab>(state.tab);
  const [mealType, setMealType] = useState<FoodLogEntry["mealType"]>(state.mealType);
  const [query, setQuery] = useState("");
  const normalizedQuery = normalizeFoodSearchText(query);
  const [resultLimitState, setResultLimitState] = useState({
    limit: 12,
    query: "",
  });
  const [estimateMode, setEstimateMode] = useState<"meal" | "snack">("meal");
  const [modalMessage, setModalMessage] = useState("");
  const recentBySource = useMemo(() => {
    const map = new Map<string, string>();
    for (const entry of recentEntries) {
      map.set(recentSourceKey(entry), `${entry.date} ${entry.time}`);
    }
    return map;
  }, [recentEntries]);
  const savedMeals = useMemo(
    () => meals.toSorted((a, b) => a.name.localeCompare(b.name)).slice(0, 8),
    [meals],
  );
  const savedFoods = useMemo(
    () => foods.toSorted((a, b) => a.name.localeCompare(b.name)).slice(0, 8),
    [foods],
  );
  const searchResults = useMemo<AddFoodSearchResult[]>(() => {
    if (!normalizedQuery) return [];

    const mealResults = meals.flatMap((meal): AddFoodSearchResult[] => {
      const nutrition = calculateMealNutrition(meal, foods);
      const componentNames = meal.items
        .map((item) => foods.find((food) => food.id === item.foodItemId)?.name)
        .filter(Boolean);
      const baseScore = scoreFoodSearchCandidate(normalizedQuery, {
        collectionName: collectionForMeal(meal),
        description: meal.description,
        fallbackText: [meal.locationName, ...componentNames],
        name: meal.name,
        servingLabel: "One meal",
      });
      if (baseScore <= 0) return [];
      const recentAt = recentBySource.get(`meal:${meal.id}`) ?? "";
      const score =
        baseScore +
        (recentAt ? 30 : 0) +
        (!meal.isSeedItem ? 20 : 0) +
        (nutrition.isComplete ? 10 : 0);
      return [{
        item: meal,
        key: `meal:${meal.id}`,
        name: meal.name,
        nutritionStatus: nutrition.status,
        nutritionSummary: nutrition.nutrition
          ? formatCalories(nutrition.nutrition.caloriesKcal, nutrition.status === "estimated")
          : "Nutrition incomplete",
        recentAt,
        score,
        servingSummary: "One meal",
        type: "meal",
      }];
    });

    const foodResults = foods.flatMap((food): AddFoodSearchResult[] => {
      const baseScore = scoreFoodSearchCandidate(normalizedQuery, {
        brand: food.brand,
        collectionName: collectionForFood(food),
        description: food.description,
        fallbackText: [
          food.locationName,
          food.sourceLabel,
          ...(food.assumptions ?? []),
        ],
        name: food.name,
        servingLabel: food.servingLabel,
      });
      if (baseScore <= 0) return [];
      const recentAt = recentBySource.get(`food:${food.id}`) ?? "";
      const score =
        baseScore +
        (recentAt ? 30 : 0) +
        (!food.isSeedItem ? 20 : 0) +
        (food.nutrition ? 10 : 0);
      return [{
        item: food,
        key: `food:${food.id}`,
        name: food.name,
        nutritionStatus: food.nutritionStatus,
        nutritionSummary: food.nutrition
          ? formatCalories(food.nutrition.caloriesKcal, food.nutritionStatus === "estimated")
          : "Nutrition incomplete",
        recentAt,
        score,
        servingSummary: food.servingLabel,
        type: "food",
      }];
    });

    return [...mealResults, ...foodResults].sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.recentAt !== a.recentAt) return b.recentAt.localeCompare(a.recentAt);
      return a.name.localeCompare(b.name);
    });
  }, [foods, meals, normalizedQuery, recentBySource]);
  const resultLimit =
    resultLimitState.query === normalizedQuery ? resultLimitState.limit : 12;
  const visibleSearchResults = searchResults.slice(0, resultLimit);

  return (
    <DialogFrame onClose={onClose} title="Add food">
      {state.mealTypeWasPreset && (
        <p className="mb-3 rounded-md bg-stone-50 px-3 py-2 text-sm text-stone-600">
          Starting in {mealTypeLabel(state.mealType)}. You can change the meal type.
        </p>
      )}
      <MealTypePills onChange={setMealType} value={mealType} />
      <div className="mt-4 grid grid-cols-4 gap-1 rounded-md bg-stone-100 p-1">
        {[
          ["library", "Search library"],
          ["plate", "Build a plate"],
          ["estimate", "Quick estimate"],
          ["new-food", "New food"],
        ].map(([tab, label]) => (
          <button
            aria-pressed={activeTab === tab}
            className={`min-h-10 rounded px-2 text-xs font-semibold sm:text-sm ${
              activeTab === tab ? "bg-white text-stone-950 shadow-sm" : "text-stone-600"
            }`}
            key={tab}
            onClick={() => setActiveTab(tab as AddFoodTab)}
            type="button"
          >
            {label}
          </button>
        ))}
      </div>
      <ToastBridge message={modalMessage} />

      {activeTab === "library" && (
        <div className="mt-4 grid gap-4">
          <div>
            <label htmlFor="add-food-search">
              <span className="text-sm font-medium text-stone-700">Search</span>
            </label>
            <div className="mt-2 flex min-h-11 items-center gap-2 rounded-md border border-stone-300 bg-white px-3 focus-within:border-stone-900">
              <input
                className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                id="add-food-search"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search saved meals or foods"
                type="search"
                value={query}
              />
              {query && (
                <button
                  className="text-sm font-semibold text-stone-600"
                  onClick={() => setQuery("")}
                  type="button"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {normalizedQuery ? (
            <ChooserGroup title={`Search results · ${searchResults.length} ${searchResults.length === 1 ? "result" : "results"}`}>
              {searchResults.length === 0 ? (
                <div className="rounded-md bg-stone-50 p-3 text-sm text-stone-600">
                  <p>No saved food matches “{query}”.</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button className="btn btn-secondary-outline" onClick={() => setActiveTab("new-food")} type="button">
                      Add new food
                    </button>
                    <button className="btn btn-secondary-outline" onClick={() => setActiveTab("estimate")} type="button">
                      Quick estimate
                    </button>
                    <button className="btn btn-tertiary-text" onClick={() => setQuery("")} type="button">
                      Clear search
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {visibleSearchResults.map((result) => (
                    <LibraryResultRow
                      defaultQuantity={1}
                      key={result.key}
                      name={result.name}
                      nutritionStatus={result.nutritionStatus}
                      nutritionSummary={result.nutritionSummary}
                      onAdd={(quantity) =>
                        result.type === "meal"
                          ? onAddMeal(result.item, mealType, quantity)
                          : onAddFood(result.item, mealType, quantity)
                      }
                      servingSummary={result.servingSummary}
                      typeLabel={result.type === "meal" ? "Meal" : "Food"}
                    />
                  ))}
                  {searchResults.length > visibleSearchResults.length && (
                    <button
                      className="btn btn-secondary-outline justify-self-start"
                      onClick={() =>
                        setResultLimitState({
                          limit: resultLimit + 12,
                          query: normalizedQuery,
                        })
                      }
                      type="button"
                    >
                      Show more results
                    </button>
                  )}
                </>
              )}
            </ChooserGroup>
          ) : (
            <>
              <ChooserGroup title="Recent items">
                {recentEntries.length === 0 ? (
                  <p className="rounded-md bg-stone-50 p-3 text-sm text-stone-500">
                    Recent meals and foods will appear here.
                  </p>
                ) : (
                  recentEntries.map((entry) => (
                    <LibraryResultRow
                      defaultQuantity={entry.quantity || 1}
                      key={entry.id}
                      name={entry.name}
                      nutritionStatus={entry.nutritionStatus}
                      nutritionSummary={formatCalories(
                        entry.nutritionSnapshot.caloriesKcal,
                        entry.nutritionStatus === "estimated",
                      )}
                      onAdd={(quantity) => onAddRecent(entry, mealType, quantity)}
                      servingSummary={entry.servingLabel}
                      typeLabel={entry.sourceType === "meal" ? "Meal" : "Food"}
                    />
                  ))
                )}
              </ChooserGroup>
              <ChooserGroup title="Saved meals">
                {savedMeals.map((meal) => {
                  const result = calculateMealNutrition(meal, foods);
                  return (
                    <LibraryResultRow
                      defaultQuantity={1}
                      key={meal.id}
                      name={meal.name}
                      nutritionStatus={result.status}
                      nutritionSummary={
                        result.nutrition
                          ? formatCalories(result.nutrition.caloriesKcal, result.status === "estimated")
                          : "Nutrition incomplete"
                      }
                      onAdd={(quantity) => onAddMeal(meal, mealType, quantity)}
                      servingSummary="One meal"
                      typeLabel="Meal"
                    />
                  );
                })}
              </ChooserGroup>
              <ChooserGroup title="Saved foods">
                {savedFoods.map((food) => (
                  <LibraryResultRow
                    defaultQuantity={1}
                    key={food.id}
                    name={food.name}
                    nutritionStatus={food.nutritionStatus}
                    nutritionSummary={
                      food.nutrition
                        ? formatCalories(food.nutrition.caloriesKcal, food.nutritionStatus === "estimated")
                        : "Nutrition incomplete"
                    }
                    onAdd={(quantity) => onAddFood(food, mealType, quantity)}
                    servingSummary={food.servingLabel}
                    typeLabel="Food"
                  />
                ))}
              </ChooserGroup>
            </>
          )}
        </div>
      )}

      {activeTab === "plate" && (
        <div className="mt-4">
          <BuildPlateForm
            collectionSuggestions={collectionSuggestions}
            foods={foods}
            initialMealType={mealType}
            onAddEntry={onAddEntry}
            onClose={onClose}
            onSaveMeal={(meal) => {
              onSaveMeal(meal);
              setModalMessage("Meal saved.");
            }}
          />
        </div>
      )}

      {activeTab === "estimate" && (
        <div className="mt-4 grid gap-3">
          <div className="grid grid-cols-2 gap-2">
            <button
              className={`min-h-10 rounded-md px-3 text-sm font-semibold ${
                estimateMode === "meal"
                  ? "accent-selected"
                  : "border border-stone-300 text-stone-800"
              }`}
              onClick={() => setEstimateMode("meal")}
              type="button"
            >
              Quick meal estimate
            </button>
            <button
              className={`min-h-10 rounded-md px-3 text-sm font-semibold ${
                estimateMode === "snack"
                  ? "accent-selected"
                  : "border border-stone-300 text-stone-800"
              }`}
              onClick={() => setEstimateMode("snack")}
              type="button"
            >
              Quick snack
            </button>
          </div>
          {estimateMode === "meal" ? (
            <QuickEstimateForm
              initialMealType={mealType}
              onAddEntry={onAddEntry}
              onClose={onClose}
              onSaveFood={(food) => {
                onSaveFood(food);
                setModalMessage("Food saved to your library.");
              }}
            />
          ) : (
            <QuickSnackForm
              onAddEntry={onAddEntry}
              onClose={onClose}
              onSaveFood={(food) => {
                onSaveFood(food);
                setModalMessage("Food saved to your library.");
              }}
            />
          )}
        </div>
      )}

      {activeTab === "new-food" && (
        <div className="mt-4">
          <NewFoodQuickForm
            defaultMealType={mealType}
            onAdd={(food, saveToLibrary) => {
              onSaveAndAddNewFood(food, saveToLibrary, mealType);
            }}
            onCancel={onClose}
            onSaveOnly={(food) => {
              onSaveNewFoodOnly(food);
              onClose();
            }}
          />
        </div>
      )}
    </DialogFrame>
  );
}

function ChooserGroup({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <div className="mt-4">
      <h3 className="text-sm font-semibold text-stone-800">{title}</h3>
      <div className="mt-2 grid gap-2">{children}</div>
    </div>
  );
}

function LibraryResultRow({
  defaultQuantity,
  name,
  nutritionStatus,
  nutritionSummary,
  onAdd,
  servingSummary,
  typeLabel,
}: {
  defaultQuantity: number;
  name: string;
  nutritionStatus: NutritionStatus;
  nutritionSummary: string;
  onAdd: (quantity: number) => void;
  servingSummary: string;
  typeLabel: string;
}) {
  const [quantity, setQuantity] = useState(String(defaultQuantity));

  function submit() {
    const parsed = Number(quantity);
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    onAdd(parsed);
  }

  return (
    <div className="grid gap-3 rounded-md border border-stone-200 p-3 sm:grid-cols-[1fr_5rem_auto] sm:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium text-stone-950">{name}</p>
          <span
            className={`rounded-md px-2 py-1 text-[11px] font-semibold ${statusClasses(
              nutritionStatus,
            )}`}
          >
            {statusLabel(nutritionStatus)}
          </span>
        </div>
        <p className="mt-1 text-sm text-stone-500">
          {typeLabel} · {servingSummary} · {nutritionSummary}
        </p>
      </div>
      <label>
        <span className="sr-only">Quantity</span>
        <input
          className="min-h-10 w-full rounded-md border border-stone-300 px-2 text-sm"
          min="0.1"
          onChange={(event) => setQuantity(event.target.value)}
          step="0.1"
          type="number"
          value={quantity}
        />
      </label>
      <button
        className="min-h-10 rounded-md bg-teal-700 px-4 text-sm font-semibold text-white"
        onClick={submit}
        type="button"
      >
        Add today
      </button>
    </div>
  );
}

function EditLogEntry({
  entry,
  onCancel,
  onSave,
}: {
  entry: FoodLogEntry;
  onCancel: () => void;
  onSave: (entry: FoodLogEntry) => void;
}) {
  const [draft, setDraft] = useState(entry);
  const [quantity, setQuantity] = useState(String(entry.quantity));
  const [error, setError] = useState("");

  function save() {
    const parsedQuantity = Number(quantity);
    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      setError("Quantity must be greater than zero.");
      return;
    }

    onSave(rescaleLogEntry(draft, parsedQuantity));
  }

  return (
    <section className="wc-section wc-section-padded shadow-sm">
      <h2 className="text-lg font-semibold text-stone-950">Edit logged entry</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {draft.sourceType === "custom-one-off" && (
          <TextInput
            label="Name"
            onChange={(value) => setDraft((current) => ({ ...current, name: value }))}
            value={draft.name}
          />
        )}
        <MealTypeSelect
          onChange={(mealType) => setDraft((current) => ({ ...current, mealType }))}
          value={draft.mealType}
        />
        <TextInput
          label="Date"
          onChange={(date) => setDraft((current) => ({ ...current, date }))}
          type="date"
          value={draft.date}
        />
        <TextInput
          label="Time"
          onChange={(time) => setDraft((current) => ({ ...current, time }))}
          type="time"
          value={draft.time}
        />
        <TextInput label="Quantity" onChange={setQuantity} type="number" value={quantity} />
      </div>
      {error && <p className="mt-3 text-sm font-medium text-red-700">{error}</p>}
      <div className="mt-5 grid grid-cols-2 gap-2">
        <SmallButton onClick={onCancel}>Cancel</SmallButton>
        <button
          className="min-h-10 rounded-md bg-stone-900 px-3 text-sm font-semibold text-white"
          onClick={save}
          type="button"
        >
          Save entry
        </button>
      </div>
    </section>
  );
}

function NewFoodQuickForm({
  defaultMealType,
  onAdd,
  onCancel,
  onSaveOnly,
}: {
  defaultMealType: FoodLogEntry["mealType"];
  onAdd: (food: FoodItem, saveToLibrary: boolean) => void;
  onCancel: () => void;
  onSaveOnly: (food: FoodItem) => void;
}) {
  const [name, setName] = useState("");
  const [servingLabel, setServingLabel] = useState("");
  const [nutritionDraft, setNutritionDraft] = useState(emptyNutritionDraft);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function buildFood() {
    const nextErrors: Record<string, string> = {};
    if (!name.trim()) nextErrors.name = "Food name is required.";
    if (!servingLabel.trim()) nextErrors.servingLabel = "Serving is required.";

    const nutrition: LoggedNutrition = {
      caloriesKcal: null,
      proteinG: null,
      carbohydratesG: null,
      totalFatG: null,
      saturatedFatG: null,
      fibreG: null,
      sodiumMg: null,
    };
    let hasNutrition = false;

    for (const key of Object.keys(nutritionDraft) as Array<keyof NutritionValues>) {
      const value = nutritionDraft[key].trim();
      if (!value) continue;
      const parsed = Number(value);
      if (!Number.isFinite(parsed) || parsed < 0) {
        nextErrors[key] = "Use a non-negative number.";
      } else {
        nutrition[key] = parsed;
        hasNutrition = true;
      }
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return null;

    const now = new Date().toISOString();
    return {
      id: makeId("food"),
      name: name.trim(),
      description: name.trim(),
      brand: null,
      servingLabel: servingLabel.trim(),
      locationName: null,
      collectionName: null,
      countryCode: "SG" as const,
      nutrition: hasNutrition ? nutrition : null,
      nutritionStatus: hasNutrition ? ("estimated" as const) : ("missing" as const),
      uncertaintyPercent: hasNutrition ? 25 : null,
      sourceLabel: null,
      sourceUrl: null,
      lastVerifiedAt: null,
      assumptions: [],
      isSeedItem: false,
      clonedFromId: null,
      createdAt: now,
      updatedAt: now,
    };
  }

  function submit(saveToLibrary: boolean) {
    const food = buildFood();
    if (food) onAdd(food, saveToLibrary);
  }

  function saveOnly() {
    const food = buildFood();
    if (food) onSaveOnly(food);
  }

  return (
    <section className="wc-section wc-section-padded shadow-sm">
      <h2 className="text-lg font-semibold text-stone-950">New food</h2>
      <p className="mt-1 text-sm text-stone-500">
        Save a reusable food or add it to {mealTypeLabel(defaultMealType)}.
      </p>
      <div className="mt-4 grid gap-3">
        <TextInput error={errors.name} label="Food name" onChange={setName} value={name} />
        <TextInput
          error={errors.servingLabel}
          label="Serving description"
          onChange={setServingLabel}
          value={servingLabel}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            ["caloriesKcal", "Calories", "kcal"],
            ["proteinG", "Protein", "g"],
            ["carbohydratesG", "Carbohydrates", "g"],
            ["totalFatG", "Total fat", "g"],
            ["saturatedFatG", "Saturated fat", "g"],
            ["fibreG", "Fibre", "g"],
            ["sodiumMg", "Sodium", "mg"],
          ].map(([key, label, unit]) => (
            <TextInput
              error={errors[key]}
              key={key}
              label={`${label} (${unit})`}
              onChange={(value) =>
                setNutritionDraft((current) => ({
                  ...current,
                  [key]: value,
                }))
              }
              type="number"
              value={nutritionDraft[key as keyof NutritionValues]}
            />
          ))}
        </div>
      </div>
      <div className="mt-5 grid gap-2">
        <button
          className="min-h-11 rounded-md bg-stone-900 px-3 text-sm font-semibold text-white"
          onClick={saveOnly}
          type="button"
        >
          Save to foods
        </button>
        <button
          className="min-h-11 rounded-md bg-teal-700 px-3 text-sm font-semibold text-white"
          onClick={() => submit(true)}
          type="button"
        >
          Save and add to today
        </button>
        <button
          className="min-h-11 rounded-md border border-stone-300 px-3 text-sm font-semibold text-stone-800"
          onClick={() => submit(false)}
          type="button"
        >
          Add once without saving
        </button>
        <SmallButton onClick={onCancel}>Cancel</SmallButton>
      </div>
    </section>
  );
}

function SmallButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      className="min-h-10 rounded-md border border-stone-300 px-3 text-sm font-semibold text-stone-800"
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function TextInput({
  error,
  inputRef,
  label,
  onChange,
  type = "text",
  value,
}: {
  error?: string;
  inputRef?: Ref<HTMLInputElement>;
  label: string;
  onChange: (value: string) => void;
  type?: string;
  value: string;
}) {
  return (
    <label>
      <span className="text-sm font-medium text-stone-700">{label}</span>
      <input
        className="mt-2 min-h-11 w-full rounded-md border border-stone-300 px-3 text-sm outline-none focus:border-stone-900"
        ref={inputRef}
        min={type === "number" ? "0" : undefined}
        onChange={(event) => onChange(event.target.value)}
        onInput={(event) => onChange(event.currentTarget.value)}
        step={type === "number" ? "0.1" : undefined}
        type={type}
        value={value}
      />
      {error && <p className="mt-2 text-sm font-medium text-red-700">{error}</p>}
    </label>
  );
}

function MealTypeSelect({
  onChange,
  value,
}: {
  onChange: (value: FoodLogEntry["mealType"]) => void;
  value: FoodLogEntry["mealType"];
}) {
  return (
    <label>
      <span className="text-sm font-medium text-stone-700">Meal type</span>
      <select
        className="mt-2 min-h-11 w-full rounded-md border border-stone-300 bg-white px-3 text-sm"
        onChange={(event) => onChange(event.target.value as FoodLogEntry["mealType"])}
        value={value}
      >
        <option value="breakfast">Breakfast</option>
        <option value="lunch">Lunch</option>
        <option value="dinner">Dinner</option>
        <option value="snack">Snack</option>
      </select>
    </label>
  );
}
