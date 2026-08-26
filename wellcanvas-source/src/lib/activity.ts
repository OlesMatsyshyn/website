import {
  RECOMMENDATION_PROFILE_STORAGE_KEY,
  type RecommendationProfile,
} from "@/lib/nutrition-targets";
import {
  addLocalDays,
  weekStart as calendarWeekStart,
  type WeekStartsOn,
} from "@/lib/calendar";
import { currentLocalTime, localDateKey, makeId } from "@/lib/food-log";
import {
  latestMorningWeightOnOrBeforeV2,
  latestPrimaryWeightOnOrBefore,
} from "@/lib/weight";

export type ActivityType =
  | "walking"
  | "jogging"
  | "running"
  | "treadmill"
  | "cycling"
  | "table-tennis"
  | "tennis"
  | "strength"
  | "other";

export type ActivityIntensity = "light" | "moderate" | "vigorous";

export type StrengthExercise = {
  id: string;
  name: string;
  sets: number;
  repetitions: number | null;
  loadKg: number | null;
  notes: string;
};

export type WorkoutStep = {
  id: string;
  type: "warmup" | "exercise" | "cardio" | "rest" | "cooldown" | "note";
  name: string;
  durationMinutes: number | null;
  sets: number | null;
  repetitions: number | null;
  loadKg: number | null;
  distanceKm: number | null;
  notes: string;
  order: number;
};

export type ActivityEntry = {
  id: string;
  date: string;
  startTime: string;
  activityType: ActivityType;
  displayName: string;
  durationMinutes: number;
  intensity: ActivityIntensity;
  speedKmh: number | null;
  distanceKm: number | null;
  inclinePercent: number | null;
  strengthMode: "quick" | "detailed" | null;
  totalSets: number | null;
  averageRepetitions: number | null;
  exercises: StrengthExercise[];
  metValue: number | null;
  estimatedActiveCaloriesKcal: number | null;
  calorieEstimateUncertaintyPercent: number | null;
  calorieSource: "met-estimate" | "device" | "manual" | "not-estimated";
  perceivedEffort: 1 | 2 | 3 | 4 | 5 | null;
  notes: string;
  weightUsedKg: number | null;
  deviceOrManualCaloriesKcal?: number | null;
  deviceSourceNote?: string;
  workoutTemplateId: string | null;
  workoutSnapshot: {
    name: string;
    steps: WorkoutStep[];
  } | null;
  createdAt: string;
  updatedAt: string;
};

export type ActivityTemplate = Omit<
  ActivityEntry,
  | "id"
  | "date"
  | "startTime"
  | "estimatedActiveCaloriesKcal"
  | "weightUsedKg"
  | "createdAt"
  | "updatedAt"
> & {
  id: string;
  templateName: string;
  templateKind: "simple" | "structured";
  steps: WorkoutStep[];
  estimatedDurationMinutes: number | null;
  source: "user-created" | "starter-library" | "copied";
  isArchived?: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ActivityPreferences = {
  weeklyMinutesTarget: number | null;
  weeklyStrengthDaysTarget: number | null;
  preferredActivities: ActivityType[];
  showActivityInsights: boolean;
  updatedAt: string;
};

type StoredWeightEntry = {
  date: string;
  morning?: { weightKg: number; time: string };
};

export const ACTIVITY_ENTRIES_STORAGE_KEY =
  "health-tracker-pwa.activity-entries.v1";
export const ACTIVITY_TEMPLATES_STORAGE_KEY =
  "health-tracker-pwa.activity-templates.v1";
export const ACTIVITY_PREFERENCES_STORAGE_KEY =
  "health-tracker-pwa.activity-preferences.v1";
export const ACTIVITY_CHANGED_EVENT = "health-tracker:activity-changed";

const WEIGHT_ENTRIES_STORAGE_KEY = "health-tracker-pwa.weight-entries.v1";

export const DEFAULT_ACTIVITY_PREFERENCES: ActivityPreferences = {
  weeklyMinutesTarget: 150,
  weeklyStrengthDaysTarget: 2,
  preferredActivities: [],
  showActivityInsights: true,
  updatedAt: "",
};

export const activityTypeLabels: Record<ActivityType, string> = {
  walking: "Walking",
  jogging: "Jogging",
  running: "Running",
  treadmill: "Treadmill",
  cycling: "Bicycle",
  "table-tennis": "Table tennis",
  tennis: "Tennis",
  strength: "Strength training",
  other: "Other activity",
};

export const intensityLabels: Record<ActivityIntensity, string> = {
  light: "Light",
  moderate: "Moderate",
  vigorous: "Vigorous",
};

export function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function saveJson<T>(key: string, value: T) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent(ACTIVITY_CHANGED_EVENT));
  }
}

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isActivityType(value: unknown): value is ActivityType {
  return typeof value === "string" && value in activityTypeLabels;
}

function isIntensity(value: unknown): value is ActivityIntensity {
  return value === "light" || value === "moderate" || value === "vigorous";
}

function normalizeWorkoutStep(step: Partial<WorkoutStep>, index: number): WorkoutStep | null {
  if (!step.id || !step.name) return null;
  const type =
    step.type === "warmup" ||
    step.type === "exercise" ||
    step.type === "cardio" ||
    step.type === "rest" ||
    step.type === "cooldown" ||
    step.type === "note"
      ? step.type
      : "exercise";

  return {
    id: step.id,
    type,
    name: step.name,
    durationMinutes: finiteNumber(step.durationMinutes) ? step.durationMinutes : null,
    sets: finiteNumber(step.sets) ? step.sets : null,
    repetitions: finiteNumber(step.repetitions) ? step.repetitions : null,
    loadKg: finiteNumber(step.loadKg) ? step.loadKg : null,
    distanceKm: finiteNumber(step.distanceKm) ? step.distanceKm : null,
    notes: step.notes || "",
    order: finiteNumber(step.order) ? step.order : index,
  };
}

function normalizedEntry(entry: Partial<ActivityEntry>): ActivityEntry | null {
  if (!entry.id || !entry.date || !entry.startTime || !entry.activityType) {
    return null;
  }

  return {
    id: entry.id,
    date: entry.date,
    startTime: entry.startTime,
    activityType: entry.activityType,
    displayName: entry.displayName || activityTypeLabels[entry.activityType] || "Activity",
    durationMinutes: finiteNumber(entry.durationMinutes)
      ? entry.durationMinutes
      : 0,
    intensity:
      entry.intensity === "vigorous" || entry.intensity === "moderate"
        ? entry.intensity
        : "light",
    speedKmh: finiteNumber(entry.speedKmh) ? entry.speedKmh : null,
    distanceKm: finiteNumber(entry.distanceKm) ? entry.distanceKm : null,
    inclinePercent: finiteNumber(entry.inclinePercent) ? entry.inclinePercent : null,
    strengthMode:
      entry.strengthMode === "quick" || entry.strengthMode === "detailed"
        ? entry.strengthMode
        : null,
    totalSets: finiteNumber(entry.totalSets) ? entry.totalSets : null,
    averageRepetitions: finiteNumber(entry.averageRepetitions)
      ? entry.averageRepetitions
      : null,
    exercises: Array.isArray(entry.exercises) ? entry.exercises : [],
    metValue: finiteNumber(entry.metValue) ? entry.metValue : null,
    estimatedActiveCaloriesKcal: finiteNumber(entry.estimatedActiveCaloriesKcal)
      ? entry.estimatedActiveCaloriesKcal
      : null,
    calorieEstimateUncertaintyPercent: finiteNumber(
      entry.calorieEstimateUncertaintyPercent,
    )
      ? entry.calorieEstimateUncertaintyPercent
      : null,
    calorieSource:
      entry.calorieSource === "device" ||
      entry.calorieSource === "manual" ||
      entry.calorieSource === "met-estimate"
        ? entry.calorieSource
        : "not-estimated",
    perceivedEffort:
      entry.perceivedEffort === 1 ||
      entry.perceivedEffort === 2 ||
      entry.perceivedEffort === 3 ||
      entry.perceivedEffort === 4 ||
      entry.perceivedEffort === 5
        ? entry.perceivedEffort
        : null,
    notes: entry.notes || "",
    weightUsedKg: finiteNumber(entry.weightUsedKg) ? entry.weightUsedKg : null,
    deviceOrManualCaloriesKcal: finiteNumber(entry.deviceOrManualCaloriesKcal)
      ? entry.deviceOrManualCaloriesKcal
      : null,
    deviceSourceNote: entry.deviceSourceNote || "",
    workoutTemplateId:
      typeof entry.workoutTemplateId === "string" ? entry.workoutTemplateId : null,
    workoutSnapshot:
      entry.workoutSnapshot &&
      typeof entry.workoutSnapshot === "object" &&
      typeof entry.workoutSnapshot.name === "string" &&
      Array.isArray(entry.workoutSnapshot.steps)
        ? {
            name: entry.workoutSnapshot.name,
            steps: entry.workoutSnapshot.steps
              .map(normalizeWorkoutStep)
              .filter((step): step is WorkoutStep => Boolean(step))
              .sort((a, b) => a.order - b.order),
          }
        : null,
    createdAt: entry.createdAt || new Date().toISOString(),
    updatedAt: entry.updatedAt || new Date().toISOString(),
  };
}

function normalizedTemplate(template: Partial<ActivityTemplate>): ActivityTemplate | null {
  if (!template.id) return null;
  const activityType = isActivityType(template.activityType)
    ? template.activityType
    : "other";
  const now = new Date().toISOString();
  const steps = Array.isArray(template.steps)
    ? template.steps
        .map(normalizeWorkoutStep)
        .filter((step): step is WorkoutStep => Boolean(step))
        .sort((a, b) => a.order - b.order)
    : [];

  return {
    id: template.id,
    templateName: template.templateName || template.displayName || activityTypeLabels[activityType],
    activityType,
    displayName: template.displayName || template.templateName || activityTypeLabels[activityType],
    durationMinutes: finiteNumber(template.durationMinutes)
      ? template.durationMinutes
      : finiteNumber(template.estimatedDurationMinutes)
        ? template.estimatedDurationMinutes
        : 0,
    intensity: isIntensity(template.intensity) ? template.intensity : "moderate",
    speedKmh: finiteNumber(template.speedKmh) ? template.speedKmh : null,
    distanceKm: finiteNumber(template.distanceKm) ? template.distanceKm : null,
    inclinePercent: finiteNumber(template.inclinePercent) ? template.inclinePercent : null,
    strengthMode:
      template.strengthMode === "quick" || template.strengthMode === "detailed"
        ? template.strengthMode
        : activityType === "strength"
          ? "quick"
          : null,
    totalSets: finiteNumber(template.totalSets) ? template.totalSets : null,
    averageRepetitions: finiteNumber(template.averageRepetitions)
      ? template.averageRepetitions
      : null,
    exercises: Array.isArray(template.exercises) ? template.exercises : [],
    metValue: finiteNumber(template.metValue) ? template.metValue : null,
    calorieEstimateUncertaintyPercent: finiteNumber(
      template.calorieEstimateUncertaintyPercent,
    )
      ? template.calorieEstimateUncertaintyPercent
      : null,
    calorieSource:
      template.calorieSource === "met-estimate" ? "met-estimate" : "not-estimated",
    perceivedEffort:
      template.perceivedEffort === 1 ||
      template.perceivedEffort === 2 ||
      template.perceivedEffort === 3 ||
      template.perceivedEffort === 4 ||
      template.perceivedEffort === 5
        ? template.perceivedEffort
        : null,
    notes: template.notes || "",
    deviceOrManualCaloriesKcal: null,
    deviceSourceNote: "",
    workoutTemplateId: null,
    workoutSnapshot: null,
    templateKind: template.templateKind === "structured" ? "structured" : "simple",
    steps,
    estimatedDurationMinutes: finiteNumber(template.estimatedDurationMinutes)
      ? template.estimatedDurationMinutes
      : finiteNumber(template.durationMinutes)
        ? template.durationMinutes
        : null,
    source:
      template.source === "starter-library" || template.source === "copied"
        ? template.source
        : "user-created",
    isArchived: template.isArchived === true,
    createdAt: template.createdAt || now,
    updatedAt: template.updatedAt || now,
  };
}

export function readActivityEntries() {
  return readJson<Partial<ActivityEntry>[]>(ACTIVITY_ENTRIES_STORAGE_KEY, [])
    .map(normalizedEntry)
    .filter((entry): entry is ActivityEntry => Boolean(entry))
    .sort((a, b) => `${b.date} ${b.startTime}`.localeCompare(`${a.date} ${a.startTime}`));
}

export function saveActivityEntries(entries: ActivityEntry[]) {
  saveJson(ACTIVITY_ENTRIES_STORAGE_KEY, entries);
}

export function addActivityEntry(entry: ActivityEntry) {
  const entries = [entry, ...readActivityEntries()];
  saveActivityEntries(entries);
  return entries;
}

export function updateActivityEntry(entry: ActivityEntry) {
  const now = new Date().toISOString();
  const entries = readActivityEntries().map((current) =>
    current.id === entry.id ? { ...entry, updatedAt: now } : current,
  );
  saveActivityEntries(entries);
  return entries;
}

export function deleteActivityEntry(id: string) {
  const entries = readActivityEntries().filter((entry) => entry.id !== id);
  saveActivityEntries(entries);
  return entries;
}

export function activityEntriesForDate(date: string) {
  return readActivityEntries().filter((entry) => entry.date === date);
}

export function weekStart(
  dateKey = localDateKey(),
  weekStartsOn: WeekStartsOn = "monday",
) {
  return calendarWeekStart(dateKey, weekStartsOn);
}

export function addDays(dateKey: string, days: number) {
  return addLocalDays(dateKey, days);
}

export function activityEntriesForWeek(
  dateKey = localDateKey(),
  weekStartsOn: WeekStartsOn = "monday",
) {
  const start = weekStart(dateKey, weekStartsOn);
  const days = Array.from({ length: 7 }, (_, index) => addDays(start, index));
  const daySet = new Set(days);
  return readActivityEntries().filter((entry) => daySet.has(entry.date));
}

export function sumActiveMinutes(entries: ActivityEntry[]) {
  return entries.reduce((total, entry) => total + entry.durationMinutes, 0);
}

export function sumEstimatedActiveCalories(entries: ActivityEntry[]) {
  const values = entries
    .map((entry) => entry.estimatedActiveCaloriesKcal)
    .filter((value): value is number => finiteNumber(value));
  return values.length === 0
    ? null
    : values.reduce((total, value) => total + value, 0);
}

export function moderateEquivalentMinutes(entries: ActivityEntry[]) {
  return entries.reduce((total, entry) => {
    if (entry.intensity === "vigorous") return total + entry.durationMinutes * 2;
    if (entry.intensity === "moderate") return total + entry.durationMinutes;
    return total;
  }, 0);
}

export function vigorousMinutes(entries: ActivityEntry[]) {
  return entries
    .filter((entry) => entry.intensity === "vigorous")
    .reduce((total, entry) => total + entry.durationMinutes, 0);
}

export function strengthTrainingDays(entries: ActivityEntry[]) {
  return new Set(
    entries
      .filter((entry) => entry.activityType === "strength")
      .map((entry) => entry.date),
  ).size;
}

export function activeDays(entries: ActivityEntry[]) {
  return new Set(entries.map((entry) => entry.date)).size;
}

export function latestMorningWeightOnOrBefore(dateKey: string) {
  const entries = readJson<StoredWeightEntry[]>(WEIGHT_ENTRIES_STORAGE_KEY, []);
  return entries
    .filter((entry) => entry.date <= dateKey && finiteNumber(entry.morning?.weightKg))
    .sort((a, b) => b.date.localeCompare(a.date))[0]?.morning?.weightKg ?? null;
}

export function recommendationProfileWeight() {
  const profile = readJson<Partial<RecommendationProfile>>(
    RECOMMENDATION_PROFILE_STORAGE_KEY,
    {},
  );
  const parsed = Number(profile.weightKg);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function weightForActivity(dateKey: string) {
  return (
    latestPrimaryWeightOnOrBefore(dateKey) ??
    latestMorningWeightOnOrBeforeV2(dateKey) ??
    latestMorningWeightOnOrBefore(dateKey) ??
    recommendationProfileWeight()
  );
}

export function walkingMetFromSpeed(speedKmh: number) {
  if (speedKmh < 4) return 2.8;
  if (speedKmh < 5.2) return 3.8;
  if (speedKmh < 6.3) return 4.8;
  return 5.5;
}

export function runningMetFromSpeed(speedKmh: number) {
  const bands = [
    { speed: 6.6, met: 6.5 },
    { speed: 7.3, met: 7.8 },
    { speed: 8.2, met: 8.5 },
    { speed: 9.0, met: 9.0 },
    { speed: 9.9, met: 9.3 },
    { speed: 10.8, met: 10.5 },
    { speed: 11.3, met: 11.0 },
    { speed: 12.1, met: 11.8 },
    { speed: 12.9, met: 12.0 },
  ];
  return bands.reduce((closest, band) =>
    Math.abs(band.speed - speedKmh) < Math.abs(closest.speed - speedKmh)
      ? band
      : closest,
  ).met;
}

export function cyclingMetFromSpeed(speedKmh: number) {
  if (speedKmh < 16) return 4.0;
  if (speedKmh < 19) return 6.8;
  if (speedKmh < 22) return 8.0;
  return 10.0;
}

export function roundActiveCalories(value: number) {
  return Math.round(value / 5) * 5;
}

export function estimateActiveCalories({
  durationMinutes,
  metValue,
  weightKg,
}: {
  durationMinutes: number;
  metValue: number | null;
  weightKg: number | null;
}) {
  if (!metValue || !weightKg) return null;
  return roundActiveCalories(
    Math.max(metValue - 1, 0) * 3.5 * weightKg * durationMinutes / 200,
  );
}

export function readActivityPreferences() {
  const parsed = readJson<Partial<ActivityPreferences> | null>(
    ACTIVITY_PREFERENCES_STORAGE_KEY,
    null,
  );
  const profile = readJson<Partial<RecommendationProfile>>(
    RECOMMENDATION_PROFILE_STORAGE_KEY,
    {},
  );
  const age = Number(profile.ageYears);
  const fallback =
    Number.isFinite(age) && age < 18
      ? {
          ...DEFAULT_ACTIVITY_PREFERENCES,
          weeklyMinutesTarget: null,
          weeklyStrengthDaysTarget: null,
        }
      : DEFAULT_ACTIVITY_PREFERENCES;

  if (!parsed) return fallback;

  return {
    weeklyMinutesTarget:
      finiteNumber(parsed.weeklyMinutesTarget) ? parsed.weeklyMinutesTarget : null,
    weeklyStrengthDaysTarget:
      finiteNumber(parsed.weeklyStrengthDaysTarget)
        ? parsed.weeklyStrengthDaysTarget
        : null,
    preferredActivities: Array.isArray(parsed.preferredActivities)
      ? parsed.preferredActivities.filter((activity) => activity in activityTypeLabels)
      : [],
    showActivityInsights: parsed.showActivityInsights !== false,
    updatedAt: parsed.updatedAt || "",
  };
}

export function saveActivityPreferences(preferences: ActivityPreferences) {
  saveJson(ACTIVITY_PREFERENCES_STORAGE_KEY, preferences);
}

export function readActivityTemplates() {
  return readJson<Partial<ActivityTemplate>[]>(ACTIVITY_TEMPLATES_STORAGE_KEY, [])
    .map(normalizedTemplate)
    .filter((template): template is ActivityTemplate => Boolean(template))
    .sort((a, b) => a.templateName.localeCompare(b.templateName));
}

export function saveActivityTemplates(templates: ActivityTemplate[]) {
  saveJson(ACTIVITY_TEMPLATES_STORAGE_KEY, templates);
}

export function templateFromEntry(entry: ActivityEntry, templateName = entry.displayName) {
  const now = new Date().toISOString();
  return {
    id: makeId("activity-template"),
    templateName,
    activityType: entry.activityType,
    displayName: entry.displayName,
    durationMinutes: entry.durationMinutes,
    intensity: entry.intensity,
    speedKmh: entry.speedKmh,
    distanceKm: entry.distanceKm,
    inclinePercent: entry.inclinePercent,
    strengthMode: entry.strengthMode,
    totalSets: entry.totalSets,
    averageRepetitions: entry.averageRepetitions,
    exercises: entry.exercises,
    metValue: entry.metValue,
    calorieEstimateUncertaintyPercent: entry.calorieEstimateUncertaintyPercent,
    calorieSource:
      entry.calorieSource === "device" || entry.calorieSource === "manual"
        ? "not-estimated"
        : entry.calorieSource,
    perceivedEffort: entry.perceivedEffort,
    notes: entry.notes,
    deviceOrManualCaloriesKcal: null,
    deviceSourceNote: "",
    workoutTemplateId: null,
    workoutSnapshot: null,
    templateKind: entry.workoutSnapshot ? "structured" : "simple",
    steps: entry.workoutSnapshot?.steps ?? [],
    estimatedDurationMinutes: entry.durationMinutes,
    source: "user-created",
    isArchived: false,
    createdAt: now,
    updatedAt: now,
  } satisfies ActivityTemplate;
}

export function entryFromTemplate(template: ActivityTemplate) {
  const now = new Date().toISOString();
  const date = localDateKey();
  const durationMinutes = template.estimatedDurationMinutes ?? template.durationMinutes;
  const weightUsedKg = weightForActivity(date);
  const estimatedActiveCaloriesKcal = estimateActiveCalories({
    durationMinutes,
    metValue: template.metValue,
    weightKg: weightUsedKg,
  });

  return {
    id: makeId("activity"),
    date,
    startTime: currentLocalTime(),
    activityType: template.activityType,
    displayName: template.displayName || template.templateName,
    durationMinutes,
    intensity: template.intensity,
    speedKmh: template.speedKmh,
    distanceKm: template.distanceKm,
    inclinePercent: template.inclinePercent,
    strengthMode: template.strengthMode,
    totalSets: template.totalSets,
    averageRepetitions: template.averageRepetitions,
    exercises: template.exercises,
    metValue: template.metValue,
    calorieEstimateUncertaintyPercent: template.calorieEstimateUncertaintyPercent,
    calorieSource: estimatedActiveCaloriesKcal === null ? "not-estimated" : "met-estimate",
    perceivedEffort: template.perceivedEffort,
    notes: template.notes,
    weightUsedKg,
    estimatedActiveCaloriesKcal,
    deviceOrManualCaloriesKcal: null,
    deviceSourceNote: "",
    workoutTemplateId: template.id,
    workoutSnapshot:
      template.templateKind === "structured"
        ? {
            name: template.templateName,
            steps: template.steps,
          }
        : null,
    createdAt: now,
    updatedAt: now,
  } satisfies ActivityEntry;
}

function starterStep(
  order: number,
  name: string,
  type: WorkoutStep["type"],
  durationMinutes: number | null,
  sets: number | null,
  repetitions: number | null,
) {
  return {
    id: `starter-step-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${order}`,
    type,
    name,
    durationMinutes,
    sets,
    repetitions,
    loadKg: null,
    distanceKm: null,
    notes: "",
    order,
  } satisfies WorkoutStep;
}

export const starterWorkoutTemplates: ActivityTemplate[] = [
  {
    id: "starter-beginner-full-body-strength",
    templateName: "Beginner full-body strength",
    activityType: "strength",
    displayName: "Beginner full-body strength",
    durationMinutes: 40,
    intensity: "moderate",
    speedKmh: null,
    distanceKm: null,
    inclinePercent: null,
    strengthMode: "detailed",
    totalSets: 16,
    averageRepetitions: 9,
    exercises: [],
    metValue: 5,
    calorieEstimateUncertaintyPercent: 35,
    calorieSource: "met-estimate",
    perceivedEffort: null,
    notes: "General editable example, not a personalized prescription.",
    deviceOrManualCaloriesKcal: null,
    deviceSourceNote: "",
    workoutTemplateId: null,
    workoutSnapshot: null,
    templateKind: "structured",
    estimatedDurationMinutes: 40,
    source: "starter-library",
    steps: [
      starterStep(1, "Warm-up", "warmup", 5, null, null),
      starterStep(2, "Bodyweight squat", "exercise", null, 3, 10),
      starterStep(3, "Supported row or cable row", "exercise", null, 3, 10),
      starterStep(4, "Push-up or chest press", "exercise", null, 3, 8),
      starterStep(5, "Hip hinge or light deadlift", "exercise", null, 3, 8),
      starterStep(6, "Cooldown", "cooldown", 5, null, null),
    ],
    isArchived: false,
    createdAt: "",
    updatedAt: "",
  },
  {
    id: "starter-short-mobility-session",
    templateName: "Short mobility session",
    activityType: "other",
    displayName: "Short mobility session",
    durationMinutes: 15,
    intensity: "light",
    speedKmh: null,
    distanceKm: null,
    inclinePercent: null,
    strengthMode: null,
    totalSets: null,
    averageRepetitions: null,
    exercises: [],
    metValue: null,
    calorieEstimateUncertaintyPercent: null,
    calorieSource: "not-estimated",
    perceivedEffort: null,
    notes: "General editable mobility example.",
    deviceOrManualCaloriesKcal: null,
    deviceSourceNote: "",
    workoutTemplateId: null,
    workoutSnapshot: null,
    templateKind: "structured",
    estimatedDurationMinutes: 15,
    source: "starter-library",
    steps: [
      starterStep(1, "Easy warm-up", "warmup", 3, null, null),
      starterStep(2, "Shoulder mobility", "exercise", 3, null, null),
      starterStep(3, "Hip mobility", "exercise", 3, null, null),
      starterStep(4, "Gentle leg mobility", "exercise", 3, null, null),
      starterStep(5, "Easy cooldown", "cooldown", 3, null, null),
    ],
    isArchived: false,
    createdAt: "",
    updatedAt: "",
  },
  {
    id: "starter-simple-interval-walk",
    templateName: "Simple interval walk",
    activityType: "walking",
    displayName: "Simple interval walk",
    durationMinutes: 30,
    intensity: "moderate",
    speedKmh: null,
    distanceKm: null,
    inclinePercent: null,
    strengthMode: null,
    totalSets: null,
    averageRepetitions: null,
    exercises: [],
    metValue: 4.8,
    calorieEstimateUncertaintyPercent: 25,
    calorieSource: "met-estimate",
    perceivedEffort: null,
    notes: "General editable walking example.",
    deviceOrManualCaloriesKcal: null,
    deviceSourceNote: "",
    workoutTemplateId: null,
    workoutSnapshot: null,
    templateKind: "structured",
    estimatedDurationMinutes: 30,
    source: "starter-library",
    steps: [
      starterStep(1, "Easy walk", "warmup", 5, null, null),
      starterStep(2, "Brisk walk", "cardio", 5, null, null),
      starterStep(3, "Easy walk", "cardio", 3, null, null),
      starterStep(4, "Brisk walk", "cardio", 5, null, null),
      starterStep(5, "Easy walk", "cardio", 3, null, null),
      starterStep(6, "Brisk walk", "cardio", 4, null, null),
      starterStep(7, "Cooldown", "cooldown", 5, null, null),
    ],
    isArchived: false,
    createdAt: "",
    updatedAt: "",
  },
];

export function weeklyActivitySummary(entries: ActivityEntry[]) {
  return {
    totalMinutes: sumActiveMinutes(entries),
    moderateEquivalent: moderateEquivalentMinutes(entries),
    vigorousMinutes: vigorousMinutes(entries),
    strengthDays: strengthTrainingDays(entries),
    activeDays: activeDays(entries),
    activeCalories: sumEstimatedActiveCalories(entries),
  };
}

export function generateActivityInsights({
  entriesToday,
  proteinCurrent,
  proteinTarget,
  preferences,
  weekEntries,
}: {
  entriesToday: ActivityEntry[];
  proteinCurrent: number | null;
  proteinTarget: number;
  preferences: ActivityPreferences;
  weekEntries: ActivityEntry[];
}) {
  if (!preferences.showActivityInsights) return [];

  const insights: string[] = [];
  const summary = weeklyActivitySummary(weekEntries);
  const hasRecentActivity = readActivityEntries().some(
    (entry) => entry.date >= addDays(localDateKey(), -6),
  );

  if (
    preferences.weeklyMinutesTarget !== null &&
    summary.moderateEquivalent >= preferences.weeklyMinutesTarget &&
    (preferences.weeklyStrengthDaysTarget === null ||
      summary.strengthDays >= preferences.weeklyStrengthDaysTarget)
  ) {
    insights.push("You have completed your current weekly activity plan.");
  } else {
    if (preferences.weeklyMinutesTarget !== null) {
      insights.push(
        `You have logged ${Math.round(summary.moderateEquivalent)} of your planned ${preferences.weeklyMinutesTarget} moderate-equivalent minutes this week.`,
      );
    }
    if (
      preferences.weeklyStrengthDaysTarget !== null &&
      summary.strengthDays < preferences.weeklyStrengthDaysTarget
    ) {
      insights.push(
        `You have logged ${summary.strengthDays} of your planned ${preferences.weeklyStrengthDaysTarget} strength-training days this week.`,
      );
    }
  }

  if (!hasRecentActivity) {
    insights.unshift(
      "No activity has been logged in the last seven days. A short walk or another activity you enjoy can be an easy restart.",
    );
  }

  if (
    entriesToday.some((entry) => entry.activityType === "strength") &&
    proteinCurrent !== null &&
    proteinCurrent < proteinTarget
  ) {
    insights.unshift(
      "You logged strength training today. Protein is currently below your daily target; consider including a protein source in a later meal.",
    );
  }

  return insights.slice(0, 2);
}
