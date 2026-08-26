"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { ToastBridge } from "@/components/toast";
import {
  DEFAULT_ACTIVITY_PREFERENCES,
  activeDays,
  activityTypeLabels,
  addActivityEntry,
  addDays,
  cyclingMetFromSpeed,
  deleteActivityEntry,
  entryFromTemplate,
  estimateActiveCalories,
  intensityLabels,
  moderateEquivalentMinutes,
  readActivityEntries,
  readActivityPreferences,
  readActivityTemplates,
  roundActiveCalories,
  runningMetFromSpeed,
  saveActivityPreferences,
  saveActivityTemplates,
  starterWorkoutTemplates,
  strengthTrainingDays,
  sumActiveMinutes,
  sumEstimatedActiveCalories,
  templateFromEntry,
  updateActivityEntry,
  vigorousMinutes,
  walkingMetFromSpeed,
  weekStart,
  weightForActivity,
  type ActivityEntry,
  type ActivityIntensity,
  type ActivityPreferences,
  type ActivityTemplate,
  type ActivityType,
  type StrengthExercise,
  type WorkoutStep,
} from "@/lib/activity";
import { readCalendarPreferences, type WeekStartsOn } from "@/lib/calendar";
import {
  currentLocalTime,
  localDateKey,
  makeId,
} from "@/lib/food-log";

type Draft = {
  id: string | null;
  activityType: ActivityType;
  displayName: string;
  date: string;
  startTime: string;
  durationMinutes: string;
  intensity: ActivityIntensity;
  perceivedEffort: string;
  notes: string;
  walkingMode: "simple" | "speed";
  walkingPace: "easy" | "normal" | "brisk" | "very-brisk";
  runningPace: string;
  treadmillMode: "walking" | "jogging" | "running";
  cyclingPlace: "indoor" | "outdoor";
  cyclingEffort: ActivityIntensity;
  racquetMode: string;
  speedKmh: string;
  distanceKm: string;
  inclinePercent: string;
  strengthMode: "quick" | "detailed";
  totalSets: string;
  averageRepetitions: string;
  exercises: StrengthExercise[];
  customMet: string;
  calorieMode: "estimate" | "device" | "manual" | "none";
  activeCalories: string;
  deviceSourceNote: string;
  workoutTemplateId: string | null;
  workoutSnapshot: ActivityEntry["workoutSnapshot"];
};

type ActivityDraftAction = "add" | "add-and-save" | "save-template";
type ActivityDraftActionState = "idle" | "processing" | "success";

const quickTypes: ActivityType[] = [
  "walking",
  "jogging",
  "running",
  "treadmill",
  "cycling",
  "table-tennis",
  "tennis",
  "strength",
  "other",
];

const walkingPaceMet = {
  easy: { label: "Easy", met: 2.8, intensity: "light" as const },
  normal: { label: "Normal", met: 3.8, intensity: "moderate" as const },
  brisk: { label: "Brisk", met: 4.8, intensity: "moderate" as const },
  "very-brisk": { label: "Very brisk", met: 5.5, intensity: "vigorous" as const },
};

const joggingPaceMet = {
  easy: { label: "Easy jog", met: 6.5 },
  normal: { label: "Normal jog", met: 7.8 },
};

const runningPaceMet = {
  steady: { label: "Steady run", met: 8.5 },
  moderate: { label: "Moderate run", met: 9.3 },
  fast: { label: "Fast run", met: 11.0 },
  "very-fast": { label: "Very fast run", met: 12.0 },
};

const cyclingEffortMet = {
  light: 4.3,
  moderate: 7.0,
  vigorous: 9.0,
};

const racquetMet = {
  "table-light": { label: "Light/recreational", met: 4.0, intensity: "moderate" as const },
  "table-vigorous": { label: "Vigorous", met: 5.0, intensity: "vigorous" as const },
  "tennis-practice": { label: "Hitting practice", met: 5.0, intensity: "moderate" as const },
  "tennis-doubles": { label: "Doubles/recreational", met: 5.5, intensity: "moderate" as const },
  "tennis-general": { label: "Moderate general play", met: 6.8, intensity: "moderate" as const },
  "tennis-singles": { label: "Singles or competitive", met: 8.0, intensity: "vigorous" as const },
};

const strengthMet = {
  light: 3.5,
  moderate: 5.0,
  vigorous: 6.0,
};

const exerciseSuggestions = [
  "Squat",
  "Deadlift",
  "Bench press",
  "Overhead press",
  "Row",
  "Lat pulldown",
  "Leg press",
  "Biceps curl",
  "Triceps extension",
  "Other",
];

function parseOptional(value: string) {
  return value.trim() === "" ? null : Number(value);
}

function parsePositive(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function formatNumber(value: number | null | undefined, digits = 0) {
  return typeof value === "number" && Number.isFinite(value)
    ? value.toLocaleString(undefined, { maximumFractionDigits: digits })
    : "—";
}

function formatEnergy(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value)
    ? `≈ ${Math.round(value).toLocaleString()} active kcal`
    : "—";
}

function defaultDraft(activityType: ActivityType): Draft {
  return {
    id: null,
    activityType,
    displayName: activityTypeLabels[activityType],
    date: localDateKey(),
    startTime: currentLocalTime(),
    durationMinutes: activityType === "walking" ? "30" : "",
    intensity: "moderate",
    perceivedEffort: "",
    notes: "",
    walkingMode: "simple",
    walkingPace: "brisk",
    runningPace: activityType === "jogging" ? "normal" : "moderate",
    treadmillMode: "walking",
    cyclingPlace: "outdoor",
    cyclingEffort: "moderate",
    racquetMode: activityType === "table-tennis" ? "table-light" : "tennis-general",
    speedKmh: "",
    distanceKm: "",
    inclinePercent: "",
    strengthMode: "quick",
    totalSets: "",
    averageRepetitions: "",
    exercises: [],
    customMet: "",
    calorieMode: "estimate",
    activeCalories: "",
    deviceSourceNote: "",
    workoutTemplateId: null,
    workoutSnapshot: null,
  };
}

function draftFromEntry(entry: ActivityEntry): Draft {
  return {
    ...defaultDraft(entry.activityType),
    id: entry.id,
    displayName: entry.displayName,
    date: entry.date,
    startTime: entry.startTime,
    durationMinutes: String(entry.durationMinutes),
    intensity: entry.intensity,
    perceivedEffort: entry.perceivedEffort === null ? "" : String(entry.perceivedEffort),
    notes: entry.notes,
    speedKmh: entry.speedKmh === null ? "" : String(entry.speedKmh),
    distanceKm: entry.distanceKm === null ? "" : String(entry.distanceKm),
    inclinePercent: entry.inclinePercent === null ? "" : String(entry.inclinePercent),
    strengthMode: entry.strengthMode ?? "quick",
    totalSets: entry.totalSets === null ? "" : String(entry.totalSets),
    averageRepetitions:
      entry.averageRepetitions === null ? "" : String(entry.averageRepetitions),
    exercises: entry.exercises,
    customMet: entry.metValue === null ? "" : String(entry.metValue),
    calorieMode:
      entry.calorieSource === "device" || entry.calorieSource === "manual"
        ? entry.calorieSource
        : entry.calorieSource === "not-estimated"
          ? "none"
          : "estimate",
    activeCalories:
      entry.deviceOrManualCaloriesKcal === null ||
      entry.deviceOrManualCaloriesKcal === undefined
        ? ""
        : String(entry.deviceOrManualCaloriesKcal),
    deviceSourceNote: entry.deviceSourceNote ?? "",
    workoutTemplateId: entry.workoutTemplateId,
    workoutSnapshot: entry.workoutSnapshot,
  };
}

function metForDraft(draft: Draft) {
  const speed = parseOptional(draft.speedKmh);

  if (draft.activityType === "walking") {
    return draft.walkingMode === "speed" && speed
      ? walkingMetFromSpeed(speed)
      : walkingPaceMet[draft.walkingPace].met;
  }
  if (draft.activityType === "jogging") {
    return speed ? runningMetFromSpeed(speed) : joggingPaceMet[draft.runningPace as "easy" | "normal"].met;
  }
  if (draft.activityType === "running") {
    return speed ? runningMetFromSpeed(speed) : runningPaceMet[draft.runningPace as keyof typeof runningPaceMet].met;
  }
  if (draft.activityType === "treadmill") {
    return speed ? (draft.treadmillMode === "walking" ? walkingMetFromSpeed(speed) : runningMetFromSpeed(speed)) : null;
  }
  if (draft.activityType === "cycling") {
    return draft.cyclingPlace === "outdoor" && speed
      ? cyclingMetFromSpeed(speed)
      : cyclingEffortMet[draft.cyclingEffort];
  }
  if (draft.activityType === "table-tennis" || draft.activityType === "tennis") {
    return racquetMet[draft.racquetMode as keyof typeof racquetMet]?.met ?? null;
  }
  if (draft.activityType === "strength") {
    return strengthMet[draft.intensity];
  }
  return parseOptional(draft.customMet);
}

function uncertaintyForDraft(draft: Draft) {
  if (draft.calorieMode === "device" || draft.calorieMode === "manual") return null;
  if (draft.activityType === "strength") return 35;
  if (draft.activityType === "table-tennis" || draft.activityType === "tennis") return 30;
  if (draft.activityType === "treadmill" && Number(draft.inclinePercent) > 0) return 30;
  if (
    (draft.activityType === "walking" && draft.walkingMode === "speed") ||
    ["jogging", "running"].includes(draft.activityType) ||
    (draft.activityType === "cycling" && draft.cyclingPlace === "outdoor" && draft.speedKmh)
  ) {
    return 20;
  }
  return draft.activityType === "other" && !draft.customMet ? null : 25;
}

function buildEntry(draft: Draft): { entry: ActivityEntry | null; error: string } {
  const duration = parsePositive(draft.durationMinutes);
  if (!duration) return { entry: null, error: "Duration must be a positive number." };

  const speed = parseOptional(draft.speedKmh);
  const distance = parseOptional(draft.distanceKm);
  const incline = parseOptional(draft.inclinePercent);
  const manualCalories = parseOptional(draft.activeCalories);

  for (const [value, label] of [
    [speed, "Speed"],
    [distance, "Distance"],
    [incline, "Incline"],
    [manualCalories, "Active calories"],
    [parseOptional(draft.totalSets), "Sets"],
    [parseOptional(draft.averageRepetitions), "Repetitions"],
  ] as Array<[number | null, string]>) {
    if (value !== null && (!Number.isFinite(value) || value < 0)) {
      return { entry: null, error: `${label} cannot be negative or invalid.` };
    }
  }

  if (
    (draft.calorieMode === "device" || draft.calorieMode === "manual") &&
    (!manualCalories || manualCalories < 0)
  ) {
    return { entry: null, error: "Enter a positive active-energy value." };
  }

  const now = new Date().toISOString();
  const metValue = metForDraft(draft);
  const weightUsedKg = weightForActivity(draft.date);
  const estimatedFromMet = estimateActiveCalories({
    durationMinutes: duration,
    metValue,
    weightKg: weightUsedKg,
  });
  const estimatedActiveCaloriesKcal =
    draft.calorieMode === "none"
      ? null
      : draft.calorieMode === "device" || draft.calorieMode === "manual"
      ? roundActiveCalories(manualCalories ?? 0)
      : estimatedFromMet;
  const calorieSource =
    draft.calorieMode === "none"
      ? "not-estimated"
      : draft.calorieMode === "device" || draft.calorieMode === "manual"
      ? draft.calorieMode
      : estimatedFromMet === null
        ? "not-estimated"
        : "met-estimate";
  const derivedDistance =
    distance ?? (speed ? Math.round((speed * duration / 60) * 100) / 100 : null);
  const totalSets =
    draft.activityType === "strength" && draft.strengthMode === "detailed"
      ? draft.exercises.reduce((total, exercise) => total + exercise.sets, 0)
      : parseOptional(draft.totalSets);
  const averageRepetitions = parseOptional(draft.averageRepetitions);

  if (draft.activityType === "other" && calorieSource === "not-estimated" && metValue === null) {
    // This is allowed; the activity still contributes minutes.
  }

  return {
    error: "",
    entry: {
      id: draft.id ?? makeId("activity"),
      date: draft.date,
      startTime: draft.startTime,
      activityType: draft.activityType,
      displayName: draft.displayName.trim() || activityTypeLabels[draft.activityType],
      durationMinutes: duration,
      intensity: draft.intensity,
      speedKmh: speed,
      distanceKm: derivedDistance,
      inclinePercent: incline,
      strengthMode: draft.activityType === "strength" ? draft.strengthMode : null,
      totalSets,
      averageRepetitions,
      exercises: draft.activityType === "strength" ? draft.exercises : [],
      metValue,
      estimatedActiveCaloriesKcal,
      calorieEstimateUncertaintyPercent: uncertaintyForDraft(draft),
      calorieSource,
      perceivedEffort: draft.perceivedEffort
        ? (Number(draft.perceivedEffort) as ActivityEntry["perceivedEffort"])
        : null,
      notes: draft.notes,
      weightUsedKg,
      deviceOrManualCaloriesKcal:
        draft.calorieMode === "device" || draft.calorieMode === "manual"
          ? manualCalories
          : null,
      deviceSourceNote: draft.deviceSourceNote,
      workoutTemplateId: draft.workoutTemplateId,
      workoutSnapshot: draft.workoutSnapshot,
      createdAt: draft.id ? now : now,
      updatedAt: now,
    },
  };
}

export default function ActivityPage() {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [templates, setTemplates] = useState<ActivityTemplate[]>([]);
  const [preferences, setPreferences] = useState<ActivityPreferences>(
    DEFAULT_ACTIVITY_PREFERENCES,
  );
  const [weekStartsOn, setWeekStartsOn] = useState<WeekStartsOn>("monday");
  const [weekAnchor, setWeekAnchor] = useState(localDateKey());
  const [draft, setDraft] = useState<Draft | null>(null);
  const [detailEntry, setDetailEntry] = useState<ActivityEntry | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [templateEditor, setTemplateEditor] = useState<ActivityTemplate | null>(null);
  const [templateDetail, setTemplateDetail] = useState<ActivityTemplate | null>(null);
  const [starterDetail, setStarterDetail] = useState<ActivityTemplate | null>(null);
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [undoEntry, setUndoEntry] = useState<ActivityEntry | null>(null);
  const [actionStates, setActionStates] = useState<
    Record<ActivityDraftAction, ActivityDraftActionState>
  >({
    add: "idle",
    "add-and-save": "idle",
    "save-template": "idle",
  });
  const [loggedEntryAwaitingTemplate, setLoggedEntryAwaitingTemplate] =
    useState<ActivityEntry | null>(null);

  function refresh() {
    setEntries(readActivityEntries());
    setTemplates(readActivityTemplates());
    setPreferences(readActivityPreferences());
    setWeekStartsOn(readCalendarPreferences().weekStartsOn);
  }

  useEffect(() => {
    queueMicrotask(refresh);
  }, []);

  const todayKey = localDateKey();
  const weekDays = useMemo(() => {
    const start = weekStart(weekAnchor, weekStartsOn);
    return Array.from({ length: 7 }, (_, index) => addDays(start, index));
  }, [weekAnchor, weekStartsOn]);
  const weekEntries = useMemo(() => {
    const daySet = new Set(weekDays);
    return entries.filter((entry) => daySet.has(entry.date));
  }, [entries, weekDays]);
  const weekEnergy = sumEstimatedActiveCalories(weekEntries);
  const weekSummary = {
    totalMinutes: sumActiveMinutes(weekEntries),
    moderateEquivalent: moderateEquivalentMinutes(weekEntries),
    vigorousMinutes: vigorousMinutes(weekEntries),
    strengthDays: strengthTrainingDays(weekEntries),
    activeDays: activeDays(weekEntries),
    activeCalories: weekEnergy,
  };
  const activeTemplates = templates.filter((template) => !template.isArchived);
  const sortedEntries = [...entries].sort((a, b) =>
    `${b.date} ${b.startTime}`.localeCompare(`${a.date} ${a.startTime}`),
  );
  const hasFutureActivity = entries.some((entry) => entry.date > weekDays[6]);

  function openDraft(activityType: ActivityType = "other") {
    setDraft(defaultDraft(activityType));
    setDetailEntry(null);
    setError("");
    setLoggedEntryAwaitingTemplate(null);
    setActionStates({
      add: "idle",
      "add-and-save": "idle",
      "save-template": "idle",
    });
  }

  function setActionState(action: ActivityDraftAction, state: ActivityDraftActionState) {
    setActionStates((current) => ({ ...current, [action]: state }));
  }

  function saveDraft(action: ActivityDraftAction) {
    if (!draft || actionStates[action] === "processing") return;
    const result = buildEntry(draft);
    if (!result.entry) {
      setError(result.error);
      return;
    }
    setError("");

    setActionState(action, "processing");
    window.setTimeout(() => {
      try {
        if (action === "save-template" || (action === "add-and-save" && loggedEntryAwaitingTemplate)) {
          const sourceEntry = loggedEntryAwaitingTemplate ?? result.entry!;
          const nextTemplates = [templateFromEntry(sourceEntry), ...readActivityTemplates()];
          saveActivityTemplates(nextTemplates);
          setConfirmation(
            loggedEntryAwaitingTemplate
              ? "Workout saved. The earlier activity log was kept."
              : "Workout saved.",
          );
          setLoggedEntryAwaitingTemplate(null);
        } else if (draft.id) {
          updateActivityEntry(result.entry!);
          setConfirmation("Activity updated.");
        } else if (action === "add") {
          addActivityEntry(result.entry!);
          setUndoEntry(result.entry!);
          setConfirmation(
            result.entry!.date === todayKey
              ? "Activity added to today."
              : "Activity saved.",
          );
        } else {
          addActivityEntry(result.entry!);
          setUndoEntry(result.entry!);
          try {
            const nextTemplates = [
              templateFromEntry(result.entry!),
              ...readActivityTemplates(),
            ];
            saveActivityTemplates(nextTemplates);
            setConfirmation("Activity added and saved as workout.");
            setLoggedEntryAwaitingTemplate(null);
          } catch {
            setLoggedEntryAwaitingTemplate(result.entry!);
            setError(
              "Activity was logged, but the workout could not be saved. Use Save to retry without logging again.",
            );
            setConfirmation("Activity logged, but workout save failed.");
            setActionState(action, "idle");
            refresh();
            return;
          }
        }

        setActionState(action, "success");
        refresh();
        window.setTimeout(() => {
          setDraft(null);
          setActionState(action, "idle");
        }, 800);
      } catch {
        setError("Could not save. Your previous data was not changed.");
        setActionState(action, "idle");
      }
    }, 180);
  }

  function undo() {
    if (!undoEntry) return;
    deleteActivityEntry(undoEntry.id);
    setUndoEntry(null);
    setConfirmation("Activity removed.");
    refresh();
  }

  function remove(entry: ActivityEntry) {
    deleteActivityEntry(entry.id);
    setUndoEntry(entry);
    setConfirmation("Activity removed.");
    refresh();
  }

  function reuseTemplate(template: ActivityTemplate) {
    const entry = entryFromTemplate(template);
    setDraft(draftFromEntry(entry));
    setTemplateDetail(null);
  }

  function savePreferencePatch(patch: Partial<ActivityPreferences>) {
    const next = { ...preferences, ...patch, updatedAt: new Date().toISOString() };
    setPreferences(next);
    saveActivityPreferences(next);
    setConfirmation("Activity plan saved.");
    setPlanOpen(false);
  }

  function saveTemplate(template: ActivityTemplate) {
    const now = new Date().toISOString();
    const exists = templates.some((current) => current.id === template.id);
    const nextTemplate = { ...template, updatedAt: now };
    const nextTemplates = exists
      ? templates.map((current) => current.id === template.id ? nextTemplate : current)
      : [{ ...nextTemplate, createdAt: now }, ...templates];
    saveActivityTemplates(nextTemplates);
    setTemplates(nextTemplates);
    setTemplateEditor(null);
    setTemplateDetail(null);
    setStarterDetail(null);
    setConfirmation("Workout saved.");
  }

  function copyStarter(template: ActivityTemplate) {
    saveTemplate({
      ...template,
      id: makeId("activity-template"),
      source: "copied",
      isArchived: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  function archiveTemplate(template: ActivityTemplate) {
    const nextTemplates = templates.map((current) =>
      current.id === template.id
        ? { ...current, isArchived: true, updatedAt: new Date().toISOString() }
        : current,
    );
    saveActivityTemplates(nextTemplates);
    setTemplates(nextTemplates);
    setTemplateDetail(null);
    setConfirmation("Workout archived. Logged activity history was kept.");
  }

  function deleteTemplate(template: ActivityTemplate) {
    const nextTemplates = templates.filter((current) => current.id !== template.id);
    saveActivityTemplates(nextTemplates);
    setTemplates(nextTemplates);
    setTemplateDetail(null);
    setConfirmation("Workout deleted. Logged activity history was kept.");
  }

  return (
    <div className="wc-page mx-auto flex w-full max-w-5xl flex-col">
      <PageHeader
        title="Activity"
        trailingAction={
          <button className="btn btn-primary-accent" onClick={() => openDraft()} type="button">
            + Log activity
          </button>
        }
      />

      <div aria-live="polite" className="sr-only">
        {error}
      </div>
      <ToastBridge
        actionLabel={undoEntry ? "Undo" : undefined}
        message={confirmation}
        onAction={undoEntry ? undo : undefined}
        type={confirmation.toLowerCase().includes("removed") ? "information" : "success"}
      />

      <section className="wc-section wc-section-padded shadow-sm">
        <div className="grid gap-[var(--wc-section-gap)] lg:grid-cols-[minmax(260px,0.85fr)_minmax(0,1.55fr)]">
          <div className="lg:order-2">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-stone-950">This week</h2>
                <p className="mt-1 text-sm text-stone-500">
                  {weekDays[0]} – {weekDays[6]}
                </p>
              </div>
              <button className="btn btn-secondary-outline min-h-9 px-3 text-xs" onClick={() => setPlanOpen(true)} type="button">
                Edit plan
              </button>
            </div>
            <div className="mt-4 grid gap-2 text-sm">
              <CompactMetric label="Moderate-equivalent min" value={`${Math.round(weekSummary.moderateEquivalent)} / ${preferences.weeklyMinutesTarget ?? "—"}`} />
              <CompactMetric label="Strength days" value={`${weekSummary.strengthDays} / ${preferences.weeklyStrengthDaysTarget ?? "—"}`} />
              <CompactMetric label="Actual activity" value={`${Math.round(weekSummary.totalMinutes)} min · ${weekSummary.activeDays} active ${weekSummary.activeDays === 1 ? "day" : "days"}`} />
              <CompactMetric label="Estimated active energy" value={formatEnergy(weekSummary.activeCalories)} />
            </div>
            <WeekChart entries={weekEntries} days={weekDays} />
            <div className="mt-3 flex flex-wrap gap-2">
              <button className="btn btn-secondary-outline min-h-9 px-3 text-xs" onClick={() => setWeekAnchor(addDays(weekDays[0], -7))} type="button">
                Previous week
              </button>
              <button className="btn btn-secondary-outline min-h-9 px-3 text-xs" onClick={() => setWeekAnchor(todayKey)} type="button">
                This week
              </button>
              <button className="btn btn-secondary-outline min-h-9 px-3 text-xs" disabled={!hasFutureActivity} onClick={() => setWeekAnchor(addDays(weekDays[0], 7))} type="button">
                Next week
              </button>
            </div>
          </div>
          <div className="border-t border-stone-100 pt-4 lg:order-1 lg:border-r lg:border-t-0 lg:pr-5 lg:pt-0">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-stone-950">Recent activity</h2>
              {entries.length > 5 && (
                <button className="btn btn-tertiary-text min-h-9 px-2 text-xs" onClick={() => setHistoryOpen(true)} type="button">
                  View all activity
                </button>
              )}
            </div>
            <div className="mt-3 grid gap-2">
              {sortedEntries.length === 0 ? (
                <p className="text-sm text-stone-500">No activity logged yet.</p>
              ) : (
                sortedEntries.slice(0, 5).map((entry) => (
                  <RecentActivityRow
                    entry={entry}
                    key={entry.id}
                    onInfo={() => setDetailEntry(entry)}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="wc-section wc-section-padded">
        <h2 className="text-lg font-semibold text-stone-950">Quick activity choices</h2>
        <div className="mt-3 grid grid-cols-2 gap-[var(--wc-grid-gap)] sm:grid-cols-3 lg:grid-cols-5">
          {quickTypes.map((activityType) => (
            <button
              className="btn btn-secondary-outline min-h-11 px-3 text-sm"
              key={activityType}
              onClick={() => openDraft(activityType)}
              type="button"
            >
              {activityTypeLabels[activityType]}
            </button>
          ))}
        </div>
      </section>

      <section className="wc-section wc-section-padded">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-stone-950">Saved workouts</h2>
          <button className="btn btn-secondary-outline min-h-9 px-3 text-xs" onClick={() => setTemplateEditor(blankTemplate())} type="button">
            + Create workout
          </button>
        </div>
        <div className="mt-3 grid gap-[var(--wc-grid-gap)] sm:grid-cols-2 lg:grid-cols-3">
          {activeTemplates.length === 0 ? (
            <p className="text-sm text-stone-500">No saved workouts yet.</p>
          ) : (
            activeTemplates.slice(0, 6).map((template) => (
              <WorkoutCard
                key={template.id}
                onInfo={() => setTemplateDetail(template)}
                onLog={() => reuseTemplate(template)}
                template={template}
              />
            ))
          )}
        </div>
      </section>

      <section className="wc-section wc-section-padded">
        <h2 className="text-lg font-semibold text-stone-950">Workout library</h2>
        <div className="mt-3 grid gap-[var(--wc-grid-gap)] sm:grid-cols-3">
          {starterWorkoutTemplates.map((template) => (
            <WorkoutCard
              key={template.id}
              onInfo={() => setStarterDetail(template)}
              onLog={() => copyStarter(template)}
              template={template}
              logLabel="Copy"
            />
          ))}
        </div>
      </section>

      {draft && (
        <DialogFrame onClose={() => setDraft(null)} title={draft.id ? "Edit activity" : "Log activity"}>
          <ActivityEditor
            draft={draft}
            error={error}
            onCancel={() => setDraft(null)}
            onDraftChange={setDraft}
            onAddToday={() => saveDraft("add")}
            onAddTodayAndSave={() => saveDraft("add-and-save")}
            onSaveTemplate={() => saveDraft("save-template")}
            actionStates={actionStates}
          />
        </DialogFrame>
      )}
      {planOpen && (
        <DialogFrame onClose={() => setPlanOpen(false)} title="Weekly activity plan">
          <ActivityPlanEditor
            onCancel={() => setPlanOpen(false)}
            onSave={savePreferencePatch}
            preferences={preferences}
          />
        </DialogFrame>
      )}
      {detailEntry && (
        <DialogFrame onClose={() => setDetailEntry(null)} title={detailEntry.displayName}>
          <ActivityDetails
            entry={detailEntry}
            onDuplicate={() => {
              setDraft(draftFromEntry({ ...detailEntry, id: makeId("activity"), date: todayKey, startTime: currentLocalTime() }));
              setDetailEntry(null);
            }}
            onEdit={() => {
              setDraft(draftFromEntry(detailEntry));
              setDetailEntry(null);
            }}
            onRemove={() => {
              remove(detailEntry);
              setDetailEntry(null);
            }}
            onTemplate={() => {
              const nextTemplates = [templateFromEntry(detailEntry), ...templates];
              saveActivityTemplates(nextTemplates);
              setTemplates(nextTemplates);
              setConfirmation("Workout saved.");
              setDetailEntry(null);
            }}
          />
        </DialogFrame>
      )}
      {historyOpen && (
        <DialogFrame onClose={() => setHistoryOpen(false)} title="Activity history">
          <ActivityHistory
            entries={entries}
            onInfo={(entry) => {
              setDetailEntry(entry);
              setHistoryOpen(false);
            }}
          />
        </DialogFrame>
      )}
      {templateEditor && (
        <DialogFrame onClose={() => setTemplateEditor(null)} title="Workout editor">
          <WorkoutEditor
            onCancel={() => setTemplateEditor(null)}
            onSave={saveTemplate}
            template={templateEditor}
          />
        </DialogFrame>
      )}
      {(templateDetail || starterDetail) && (
        <DialogFrame
          onClose={() => {
            setTemplateDetail(null);
            setStarterDetail(null);
          }}
          title={(templateDetail ?? starterDetail)!.templateName}
        >
          <WorkoutDetails
            isStarter={Boolean(starterDetail)}
            onArchive={() => templateDetail && archiveTemplate(templateDetail)}
            onCopy={() => starterDetail && copyStarter(starterDetail)}
            onDelete={() => templateDetail && deleteTemplate(templateDetail)}
            onDuplicate={() => templateDetail && saveTemplate({ ...templateDetail, id: makeId("activity-template"), templateName: `${templateDetail.templateName} copy`, source: "copied", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })}
            onEdit={() => {
              if (!templateDetail) return;
              setTemplateEditor(templateDetail);
              setTemplateDetail(null);
            }}
            onLog={() => templateDetail && reuseTemplate(templateDetail)}
            template={(templateDetail ?? starterDetail)!}
          />
        </DialogFrame>
      )}
    </div>
  );
}

function DialogFrame({
  children,
  onClose,
  title,
}: {
  children: ReactNode;
  onClose: () => void;
  title: string;
}) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      aria-labelledby="activity-dialog-title"
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-end bg-stone-950/35 p-0 sm:place-items-center sm:p-4"
      role="dialog"
    >
      <div className="max-h-[92vh] w-full max-w-[calc(100vw-1rem)] overflow-y-auto rounded-t-[var(--wc-section-radius)] bg-white p-[var(--wc-section-padding)] shadow-xl sm:max-w-3xl sm:rounded-[var(--wc-section-radius)]">
        <div className="flex items-start justify-between gap-4 border-b border-stone-200 pb-3">
          <h2 className="text-lg font-semibold text-stone-950" id="activity-dialog-title">
            {title}
          </h2>
          <button className="btn btn-secondary-outline" onClick={onClose} type="button">
            Close
          </button>
        </div>
        <div className="pt-4">{children}</div>
      </div>
    </div>
  );
}

function CompactMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-stone-100 pb-1 last:border-b-0">
      <span className="text-stone-500">{label}</span>
      <span className="font-semibold text-stone-950">{value}</span>
    </div>
  );
}

function RecentActivityRow({
  entry,
  onInfo,
}: {
  entry: ActivityEntry;
  onInfo: () => void;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-md bg-stone-50 p-2 text-sm">
      <div className="min-w-0">
        <p className="truncate font-semibold text-stone-950">{entry.displayName}</p>
        <p className="mt-0.5 truncate text-stone-500">
          {entry.date} · {entry.durationMinutes} min · {intensityLabels[entry.intensity]} ·{" "}
          {formatEnergy(entry.estimatedActiveCaloriesKcal)}
        </p>
      </div>
      <button
        aria-label={`View ${entry.displayName} details`}
        className="grid h-8 w-8 place-items-center rounded-full border border-stone-300 bg-white text-xs font-semibold text-stone-700"
        onClick={onInfo}
        type="button"
      >
        i
      </button>
    </div>
  );
}

function WorkoutCard({
  logLabel = "Log now",
  onInfo,
  onLog,
  template,
}: {
  logLabel?: string;
  onInfo: () => void;
  onLog: () => void;
  template: ActivityTemplate;
}) {
  const stepCount = template.steps.length;
  const durationLabel = template.estimatedDurationMinutes ?? template.durationMinutes;
  return (
    <article className="rounded-md border border-stone-200 bg-stone-50 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-stone-950">
            {template.templateName}
          </h3>
          <p className="mt-1 text-xs text-stone-500">
            {activityTypeLabels[template.activityType]} ·{" "}
            {durationLabel || "—"} min
            {stepCount > 0 ? ` · ${stepCount} steps` : ""}
          </p>
        </div>
        <button
          aria-label={`View ${template.templateName}`}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-stone-300 bg-white text-xs font-semibold text-stone-700"
          onClick={onInfo}
          type="button"
        >
          i
        </button>
      </div>
      <button className="btn btn-primary-accent mt-3 min-h-9 w-full px-3 text-xs" onClick={onLog} type="button">
        {logLabel}
      </button>
    </article>
  );
}

function ActivityPlanEditor({
  onCancel,
  onSave,
  preferences,
}: {
  onCancel: () => void;
  onSave: (patch: Partial<ActivityPreferences>) => void;
  preferences: ActivityPreferences;
}) {
  const [minutes, setMinutes] = useState(String(preferences.weeklyMinutesTarget ?? ""));
  const [strengthDays, setStrengthDays] = useState(String(preferences.weeklyStrengthDaysTarget ?? ""));
  const [showInsights, setShowInsights] = useState(preferences.showActivityInsights);

  return (
    <div className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <NumberInput
          label="Planned moderate-equivalent minutes"
          onChange={setMinutes}
          value={minutes}
        />
        <NumberInput
          label="Planned strength days"
          onChange={setStrengthDays}
          value={strengthDays}
        />
      </div>
      <label className="flex min-h-10 items-center gap-2 text-sm font-medium text-stone-700">
        <input
          checked={showInsights}
          onChange={(event) => setShowInsights(event.target.checked)}
          type="checkbox"
        />
        Show activity insights
      </label>
      <div className="flex flex-wrap gap-2">
        <button
          className="btn btn-primary-dark"
          onClick={() =>
            onSave({
              weeklyMinutesTarget: parseOptional(minutes),
              weeklyStrengthDaysTarget: parseOptional(strengthDays),
              showActivityInsights: showInsights,
            })
          }
          type="button"
        >
          Save plan
        </button>
        <button className="btn btn-tertiary-text" onClick={onCancel} type="button">
          Cancel
        </button>
      </div>
    </div>
  );
}

function ActivityDetails({
  entry,
  onDuplicate,
  onEdit,
  onRemove,
  onTemplate,
}: {
  entry: ActivityEntry;
  onDuplicate: () => void;
  onEdit: () => void;
  onRemove: () => void;
  onTemplate: () => void;
}) {
  return (
    <div className="grid gap-3 text-sm text-stone-600">
      <div className="grid gap-2 rounded-md bg-stone-50 p-3 sm:grid-cols-2">
        <p>Date: {entry.date}</p>
        <p>Start: {entry.startTime}</p>
        <p>Duration: {entry.durationMinutes} min</p>
        <p>Intensity: {intensityLabels[entry.intensity]}</p>
        <p>MET used: {formatNumber(entry.metValue, 1)}</p>
        <p>Weight snapshot: {formatNumber(entry.weightUsedKg, 1)} kg</p>
        <p>Method: {entry.calorieSource.replace("-", " ")}</p>
        <p>Energy: {formatEnergy(entry.estimatedActiveCaloriesKcal)}</p>
        {entry.speedKmh !== null && <p>Speed: {formatNumber(entry.speedKmh, 1)} km/h</p>}
        {entry.distanceKm !== null && <p>Distance: {formatNumber(entry.distanceKm, 2)} km</p>}
        {entry.totalSets !== null && <p>Sets: {entry.totalSets}</p>}
        {entry.workoutSnapshot && (
          <div className="sm:col-span-2">
            <p className="font-semibold text-stone-800">Workout snapshot</p>
            <StepList steps={entry.workoutSnapshot.steps} />
          </div>
        )}
        {entry.notes && <p className="sm:col-span-2">Notes: {entry.notes}</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-secondary-outline" onClick={onEdit} type="button">
          Edit
        </button>
        <button className="btn btn-secondary-outline" onClick={onTemplate} type="button">
          Save as workout
        </button>
        <button className="btn btn-tertiary-text" onClick={onDuplicate} type="button">
          Duplicate and log again
        </button>
        <button className="btn btn-destructive" onClick={onRemove} type="button">
          Remove
        </button>
      </div>
    </div>
  );
}

function ActivityHistory({
  entries,
  onInfo,
}: {
  entries: ActivityEntry[];
  onInfo: (entry: ActivityEntry) => void;
}) {
  const [typeFilter, setTypeFilter] = useState<"all" | ActivityType>("all");
  const filtered = typeFilter === "all"
    ? entries
    : entries.filter((entry) => entry.activityType === typeFilter);

  return (
    <div>
      <div className="mb-3 max-w-xs">
        <SelectInput
          label="Activity type"
          onChange={(value) => setTypeFilter(value)}
          options={[
            { label: "All", value: "all" },
            ...quickTypes.map((type) => ({ label: activityTypeLabels[type], value: type })),
          ]}
          value={typeFilter}
        />
      </div>
      <div className="grid gap-2">
        {filtered.length === 0 ? (
          <p className="rounded-md bg-stone-50 p-3 text-sm text-stone-500">
            No matching activity.
          </p>
        ) : (
          filtered.slice(0, 80).map((entry) => (
            <RecentActivityRow entry={entry} key={entry.id} onInfo={() => onInfo(entry)} />
          ))
        )}
      </div>
    </div>
  );
}

function blankTemplate(): ActivityTemplate {
  const now = new Date().toISOString();
  return {
    id: makeId("activity-template"),
    templateName: "",
    activityType: "strength",
    displayName: "Workout",
    durationMinutes: 40,
    intensity: "moderate",
    speedKmh: null,
    distanceKm: null,
    inclinePercent: null,
    strengthMode: "quick",
    totalSets: null,
    averageRepetitions: null,
    exercises: [],
    metValue: 5,
    calorieEstimateUncertaintyPercent: 35,
    calorieSource: "met-estimate",
    perceivedEffort: null,
    notes: "",
    deviceOrManualCaloriesKcal: null,
    deviceSourceNote: "",
    workoutTemplateId: null,
    workoutSnapshot: null,
    templateKind: "structured",
    estimatedDurationMinutes: 40,
    source: "user-created",
    steps: [],
    isArchived: false,
    createdAt: now,
    updatedAt: now,
  };
}

function stepText(step: WorkoutStep) {
  const pieces = [step.name];
  if (step.durationMinutes !== null) pieces.push(`${step.durationMinutes} min`);
  if (step.sets !== null) {
    pieces.push(`${step.sets} sets${step.repetitions !== null ? ` x ${step.repetitions}` : ""}`);
  }
  if (step.distanceKm !== null) pieces.push(`${step.distanceKm} km`);
  return pieces.join(" · ");
}

function StepList({ steps }: { steps: WorkoutStep[] }) {
  return steps.length === 0 ? (
    <p className="mt-1 text-sm text-stone-500">No structured steps.</p>
  ) : (
    <ol className="mt-2 list-inside list-decimal text-sm text-stone-600">
      {steps
        .toSorted((a, b) => a.order - b.order)
        .map((step) => (
          <li key={step.id}>{stepText(step)}</li>
        ))}
    </ol>
  );
}

function WorkoutDetails({
  isStarter,
  onArchive,
  onCopy,
  onDelete,
  onDuplicate,
  onEdit,
  onLog,
  template,
}: {
  isStarter: boolean;
  onArchive: () => void;
  onCopy: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onEdit: () => void;
  onLog: () => void;
  template: ActivityTemplate;
}) {
  return (
    <div className="grid gap-4">
      <div className="rounded-md bg-stone-50 p-3 text-sm text-stone-600">
        <p className="font-semibold text-stone-950">{template.templateName}</p>
        <p className="mt-1">
          {activityTypeLabels[template.activityType]} · {template.estimatedDurationMinutes ?? template.durationMinutes} min · {intensityLabels[template.intensity]}
        </p>
        {isStarter && (
          <p className="mt-2">General example. Copy it before editing or logging.</p>
        )}
        <StepList steps={template.steps} />
      </div>
      <div className="flex flex-wrap gap-2">
        {isStarter ? (
          <button className="btn btn-primary-accent" onClick={onCopy} type="button">
            Copy to my workouts
          </button>
        ) : (
          <>
            <button className="btn btn-primary-accent" onClick={onLog} type="button">
              Log now
            </button>
            <button className="btn btn-secondary-outline" onClick={onEdit} type="button">
              Edit
            </button>
            <button className="btn btn-tertiary-text" onClick={onDuplicate} type="button">
              Duplicate
            </button>
            <button className="btn btn-secondary-outline" onClick={onArchive} type="button">
              Archive
            </button>
            <button className="btn btn-destructive" onClick={onDelete} type="button">
              Delete
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function WorkoutEditor({
  onCancel,
  onSave,
  template,
}: {
  onCancel: () => void;
  onSave: (template: ActivityTemplate) => void;
  template: ActivityTemplate;
}) {
  const [draft, setDraft] = useState<ActivityTemplate>(template);

  function updateStep(index: number, patch: Partial<WorkoutStep>) {
    setDraft((current) => ({
      ...current,
      steps: current.steps.map((step, stepIndex) =>
        stepIndex === index ? { ...step, ...patch } : step,
      ),
    }));
  }

  function moveStep(index: number, direction: -1 | 1) {
    const next = [...draft.steps].sort((a, b) => a.order - b.order);
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= next.length) return;
    const [item] = next.splice(index, 1);
    next.splice(targetIndex, 0, item);
    setDraft({
      ...draft,
      steps: next.map((step, order) => ({ ...step, order: order + 1 })),
    });
  }

  function addStep() {
    setDraft((current) => ({
      ...current,
      steps: [
        ...current.steps,
        {
          id: makeId("workout-step"),
          type: "exercise",
          name: "Exercise",
          durationMinutes: null,
          sets: 3,
          repetitions: 10,
          loadKg: null,
          distanceKm: null,
          notes: "",
          order: current.steps.length + 1,
        },
      ],
    }));
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <TextInput label="Name" onChange={(templateName) => setDraft({ ...draft, templateName, displayName: templateName })} value={draft.templateName} />
        <SelectInput
          label="Activity type"
          onChange={(activityType) => setDraft({ ...draft, activityType })}
          options={quickTypes.map((type) => ({ label: activityTypeLabels[type], value: type }))}
          value={draft.activityType}
        />
        <SelectInput
          label="Workout type"
          onChange={(templateKind) => setDraft({ ...draft, templateKind })}
          options={[
            { label: "Simple", value: "simple" },
            { label: "Structured", value: "structured" },
          ]}
          value={draft.templateKind}
        />
        <SelectInput
          label="Default intensity"
          onChange={(intensity) => setDraft({ ...draft, intensity })}
          options={[
            { label: "Light", value: "light" },
            { label: "Moderate", value: "moderate" },
            { label: "Vigorous", value: "vigorous" },
          ]}
          value={draft.intensity}
        />
        <NumberInput
          label="Estimated duration"
          onChange={(value) => setDraft({ ...draft, estimatedDurationMinutes: parseOptional(value), durationMinutes: parseOptional(value) ?? draft.durationMinutes })}
          value={draft.estimatedDurationMinutes ?? ""}
        />
        <TextInput label="Notes" onChange={(notes) => setDraft({ ...draft, notes })} value={draft.notes} />
      </div>

      {draft.templateKind === "structured" && (
        <div className="grid gap-2">
          {draft.steps
            .toSorted((a, b) => a.order - b.order)
            .map((step, index) => (
              <div className="grid gap-2 rounded-md bg-stone-50 p-3 sm:grid-cols-6" key={step.id}>
                <SelectInput
                  label="Type"
                  onChange={(type) => updateStep(index, { type })}
                  options={[
                    { label: "Warm-up", value: "warmup" },
                    { label: "Exercise", value: "exercise" },
                    { label: "Cardio", value: "cardio" },
                    { label: "Rest", value: "rest" },
                    { label: "Cooldown", value: "cooldown" },
                    { label: "Note", value: "note" },
                  ]}
                  value={step.type}
                />
                <TextInput label="Name" onChange={(name) => updateStep(index, { name })} value={step.name} />
                <NumberInput label="Minutes" onChange={(value) => updateStep(index, { durationMinutes: parseOptional(value) })} value={step.durationMinutes ?? ""} />
                <NumberInput label="Sets" onChange={(value) => updateStep(index, { sets: parseOptional(value) })} value={step.sets ?? ""} />
                <NumberInput label="Reps" onChange={(value) => updateStep(index, { repetitions: parseOptional(value) })} value={step.repetitions ?? ""} />
                <div className="flex items-end gap-1">
                  <button className="btn btn-secondary-outline min-h-9 px-2 text-xs" onClick={() => moveStep(index, -1)} type="button">Up</button>
                  <button className="btn btn-secondary-outline min-h-9 px-2 text-xs" onClick={() => moveStep(index, 1)} type="button">Down</button>
                  <button className="btn btn-tertiary-text min-h-9 px-2 text-xs" onClick={() => setDraft({ ...draft, steps: draft.steps.filter((current) => current.id !== step.id).map((current, order) => ({ ...current, order: order + 1 })) })} type="button">Remove</button>
                </div>
              </div>
            ))}
          <button className="btn btn-secondary-outline justify-self-start" onClick={addStep} type="button">
            Add step
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button className="btn btn-primary-dark" onClick={() => onSave(draft)} type="button">
          Save workout
        </button>
        <button className="btn btn-tertiary-text" onClick={onCancel} type="button">
          Cancel
        </button>
      </div>
    </div>
  );
}

function TextInput({
  label,
  onChange,
  type = "text",
  value,
}: {
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
        min={type === "number" ? "0" : undefined}
        onChange={(event) => onChange(event.target.value)}
        step={type === "number" ? "0.1" : undefined}
        type={type}
        value={value}
      />
    </label>
  );
}

function NumberInput({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  value: number | string;
}) {
  return (
    <TextInput label={label} onChange={onChange} type="number" value={String(value)} />
  );
}

function SelectInput<T extends string>({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: T) => void;
  options: Array<{ label: string; value: T }>;
  value: T;
}) {
  return (
    <label>
      <span className="text-sm font-medium text-stone-700">{label}</span>
      <select
        className="mt-2 min-h-11 w-full rounded-md border border-stone-300 bg-white px-3 text-sm"
        onChange={(event) => onChange(event.target.value as T)}
        value={value}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ActivityEditor({
  actionStates,
  draft,
  error,
  onAddToday,
  onAddTodayAndSave,
  onCancel,
  onDraftChange,
  onSaveTemplate,
}: {
  actionStates: Record<ActivityDraftAction, ActivityDraftActionState>;
  draft: Draft;
  error: string;
  onAddToday: () => void;
  onAddTodayAndSave: () => void;
  onCancel: () => void;
  onDraftChange: (draft: Draft) => void;
  onSaveTemplate: () => void;
}) {
  const metValue = metForDraft(draft);
  const weight = weightForActivity(draft.date);
  const duration = parsePositive(draft.durationMinutes);
  const previewEnergy =
    draft.calorieMode === "device" || draft.calorieMode === "manual"
      ? parseOptional(draft.activeCalories)
      : duration
        ? estimateActiveCalories({ durationMinutes: duration, metValue, weightKg: weight })
        : null;

  function update(patch: Partial<Draft>) {
    onDraftChange({ ...draft, ...patch });
  }

  return (
    <div className="mt-5 rounded-md border border-stone-200 bg-stone-50 p-4">
      <h3 className="text-lg font-semibold text-stone-950">
        {draft.id ? "Edit activity" : `Log ${activityTypeLabels[draft.activityType]}`}
      </h3>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <TextInput label="Date" onChange={(date) => update({ date })} type="date" value={draft.date} />
        <TextInput label="Start time" onChange={(startTime) => update({ startTime })} type="time" value={draft.startTime} />
        <NumberInput label="Duration in minutes" onChange={(durationMinutes) => update({ durationMinutes })} value={draft.durationMinutes} />
        <SelectInput
          label="Intensity"
          onChange={(intensity) => update({ intensity })}
          options={[
            { label: "Light", value: "light" },
            { label: "Moderate", value: "moderate" },
            { label: "Vigorous", value: "vigorous" },
          ]}
          value={draft.intensity}
        />
        <SelectInput
          label="Perceived effort"
          onChange={(perceivedEffort) => update({ perceivedEffort })}
          options={[
            { label: "Not recorded", value: "" },
            { label: "1", value: "1" },
            { label: "2", value: "2" },
            { label: "3", value: "3" },
            { label: "4", value: "4" },
            { label: "5", value: "5" },
          ]}
          value={draft.perceivedEffort}
        />
        {draft.activityType === "other" && (
          <TextInput label="Activity name" onChange={(displayName) => update({ displayName })} value={draft.displayName} />
        )}
      </div>

      {draft.activityType === "walking" && (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <SelectInput
            label="Walking entry mode"
            onChange={(walkingMode) => update({ walkingMode })}
            options={[
              { label: "Simple", value: "simple" },
              { label: "Speed or distance", value: "speed" },
            ]}
            value={draft.walkingMode}
          />
          {draft.walkingMode === "simple" ? (
            <SelectInput
              label="Walking pace"
              onChange={(walkingPace) =>
                update({
                  walkingPace,
                  intensity: walkingPaceMet[walkingPace].intensity,
                })
              }
              options={Object.entries(walkingPaceMet).map(([value, item]) => ({
                label: item.label,
                value: value as Draft["walkingPace"],
              }))}
              value={draft.walkingPace}
            />
          ) : (
            <>
              <NumberInput label="Speed" onChange={(speedKmh) => update({ speedKmh })} value={draft.speedKmh} />
              <NumberInput label="Distance" onChange={(distanceKm) => update({ distanceKm })} value={draft.distanceKm} />
            </>
          )}
        </div>
      )}

      {(draft.activityType === "jogging" || draft.activityType === "running") && (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <SelectInput
            label="Simple pace"
            onChange={(runningPace) => update({ runningPace })}
            options={(draft.activityType === "jogging"
              ? Object.entries(joggingPaceMet)
              : Object.entries(runningPaceMet)
            ).map(([value, item]) => ({ label: item.label, value }))}
            value={draft.runningPace}
          />
          <NumberInput label="Speed km/h" onChange={(speedKmh) => update({ speedKmh })} value={draft.speedKmh} />
          <NumberInput label="Distance km" onChange={(distanceKm) => update({ distanceKm })} value={draft.distanceKm} />
        </div>
      )}

      {draft.activityType === "treadmill" && (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <SelectInput
            label="Treadmill mode"
            onChange={(treadmillMode) => update({ treadmillMode })}
            options={[
              { label: "Walking", value: "walking" },
              { label: "Jogging", value: "jogging" },
              { label: "Running", value: "running" },
            ]}
            value={draft.treadmillMode}
          />
          <NumberInput label="Speed km/h" onChange={(speedKmh) => update({ speedKmh })} value={draft.speedKmh} />
          <NumberInput label="Distance km" onChange={(distanceKm) => update({ distanceKm })} value={draft.distanceKm} />
          <NumberInput label="Incline percent" onChange={(inclinePercent) => update({ inclinePercent })} value={draft.inclinePercent} />
        </div>
      )}

      {draft.activityType === "cycling" && (
        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <SelectInput
            label="Cycling type"
            onChange={(cyclingPlace) => update({ cyclingPlace })}
            options={[
              { label: "Indoor", value: "indoor" },
              { label: "Outdoor", value: "outdoor" },
            ]}
            value={draft.cyclingPlace}
          />
          <SelectInput
            label="Effort"
            onChange={(cyclingEffort) => update({ cyclingEffort, intensity: cyclingEffort })}
            options={[
              { label: "Easy", value: "light" },
              { label: "Moderate", value: "moderate" },
              { label: "Vigorous", value: "vigorous" },
            ]}
            value={draft.cyclingEffort}
          />
          <NumberInput label="Speed km/h" onChange={(speedKmh) => update({ speedKmh })} value={draft.speedKmh} />
          <NumberInput label="Distance km" onChange={(distanceKm) => update({ distanceKm })} value={draft.distanceKm} />
        </div>
      )}

      {(draft.activityType === "table-tennis" || draft.activityType === "tennis") && (
        <div className="mt-4">
          <SelectInput
            label="Play type"
            onChange={(racquetMode) =>
              update({
                racquetMode,
                intensity: racquetMet[racquetMode as keyof typeof racquetMet].intensity,
              })
            }
            options={Object.entries(racquetMet)
              .filter(([key]) => key.startsWith(draft.activityType === "tennis" ? "tennis" : "table"))
              .map(([value, item]) => ({ label: item.label, value }))}
            value={draft.racquetMode}
          />
        </div>
      )}

      {draft.activityType === "strength" && (
        <StrengthFields draft={draft} onDraftChange={onDraftChange} />
      )}

      {draft.activityType === "other" && (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <NumberInput label="Optional MET value" onChange={(customMet) => update({ customMet })} value={draft.customMet} />
        </div>
      )}

      {(draft.activityType === "treadmill" || draft.activityType === "cycling" || draft.activityType === "other") && (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <SelectInput
            label="Active-energy source"
            onChange={(calorieMode) => update({ calorieMode })}
            options={[
              { label: "Use app estimate", value: "estimate" },
              { label: "Use device estimate", value: "device" },
              { label: "Manual value", value: "manual" },
              { label: "No estimate", value: "none" },
            ]}
            value={draft.calorieMode}
          />
          {(draft.calorieMode === "device" || draft.calorieMode === "manual") && (
            <>
              <NumberInput label="Active calories" onChange={(activeCalories) => update({ activeCalories })} value={draft.activeCalories} />
              <TextInput label="Source note" onChange={(deviceSourceNote) => update({ deviceSourceNote })} value={draft.deviceSourceNote} />
            </>
          )}
        </div>
      )}

      <label className="mt-4 block">
        <span className="text-sm font-medium text-stone-700">Notes</span>
        <textarea
          className="mt-2 min-h-24 w-full rounded-md border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-900"
          onChange={(event) => update({ notes: event.target.value })}
          value={draft.notes}
        />
      </label>

      <div className="mt-4 rounded-md bg-white p-3 text-sm text-stone-600">
        <p className="font-semibold text-stone-900">
          Estimated active energy: {formatEnergy(previewEnergy)}
        </p>
        <p className="mt-1">
          MET used: {formatNumber(metValue, 1)} · Weight snapshot: {formatNumber(weight, 1)} kg
        </p>
        {!weight && <p className="mt-1">Weight needed for energy estimate.</p>}
        {Number(draft.inclinePercent) > 0 && (
          <p className="mt-1">
            Incline is recorded, but the current energy estimate is primarily speed-based.
          </p>
        )}
      </div>
      {error && <p className="mt-3 text-sm font-medium text-red-700">{error}</p>}
      <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_1.3fr_0.8fr]">
        <ActivityDraftButton
          idleLabel="Add today"
          onClick={onAddToday}
          processingLabel="Adding…"
          state={actionStates.add}
          successLabel="✓ Added"
        />
        <ActivityDraftButton
          idleLabel="Add today & save"
          onClick={onAddTodayAndSave}
          processingLabel="Adding and saving…"
          state={actionStates["add-and-save"]}
          successLabel="✓ Added and saved"
        />
        <ActivityDraftButton
          idleLabel="Save"
          onClick={onSaveTemplate}
          processingLabel="Saving…"
          state={actionStates["save-template"]}
          successLabel="✓ Saved"
          variant="secondary"
        />
        <button className="btn btn-tertiary-text sm:col-span-2 lg:col-span-3" onClick={onCancel} type="button">
          Cancel
        </button>
      </div>
    </div>
  );
}

function ActivityDraftButton({
  idleLabel,
  onClick,
  processingLabel,
  state,
  successLabel,
  variant = "primary",
}: {
  idleLabel: string;
  onClick: () => void;
  processingLabel: string;
  state: ActivityDraftActionState;
  successLabel: string;
  variant?: "primary" | "secondary";
}) {
  const isProcessing = state === "processing";
  return (
    <button
      aria-live="polite"
      className={`btn min-w-[9rem] ${
        variant === "primary" ? "btn-primary-accent" : "btn-secondary-outline"
      }`}
      disabled={isProcessing}
      onClick={onClick}
      type="button"
    >
      <span className="inline-flex items-center justify-center gap-2">
        {isProcessing && (
          <span
            aria-hidden="true"
            className="inline-block h-4 w-4 rounded-full border-2 border-current border-r-transparent motion-safe:animate-spin"
          />
        )}
        {state === "processing"
          ? processingLabel
          : state === "success"
            ? successLabel
            : idleLabel}
      </span>
    </button>
  );
}

function StrengthFields({
  draft,
  onDraftChange,
}: {
  draft: Draft;
  onDraftChange: (draft: Draft) => void;
}) {
  function update(patch: Partial<Draft>) {
    onDraftChange({ ...draft, ...patch });
  }
  function updateExercise(index: number, exercise: StrengthExercise) {
    update({
      exercises: draft.exercises.map((item, itemIndex) =>
        itemIndex === index ? exercise : item,
      ),
    });
  }

  return (
    <div className="mt-4 grid gap-3">
      <SelectInput
        label="Strength mode"
        onChange={(strengthMode) => update({ strengthMode })}
        options={[
          { label: "Quick log", value: "quick" },
          { label: "Detailed workout", value: "detailed" },
        ]}
        value={draft.strengthMode}
      />
      <div className="rounded-md bg-white p-3 text-sm text-stone-600">
        <p>
          Light: Long rests or easy session. Moderate: Normal multi-exercise session.
          Vigorous: Demanding lifting or powerlifting session.
        </p>
        <p className="mt-1">
          Energy is estimated from duration and intensity, not lifted kilograms.
        </p>
      </div>
      {draft.strengthMode === "quick" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <NumberInput label="Total working sets" onChange={(totalSets) => update({ totalSets })} value={draft.totalSets} />
          <NumberInput label="Usual repetitions per set" onChange={(averageRepetitions) => update({ averageRepetitions })} value={draft.averageRepetitions} />
        </div>
      ) : (
        <div className="grid gap-3">
          {draft.exercises.length > 1 && (
            <button
              className="w-fit text-sm font-semibold text-stone-600 underline underline-offset-4"
              onClick={() => {
                const first = draft.exercises[0];
                update({
                  exercises: draft.exercises.map((exercise) => ({
                    ...exercise,
                    sets: first.sets,
                    repetitions: first.repetitions,
                    loadKg: first.loadKg,
                  })),
                });
              }}
              type="button"
            >
              Apply to all sets
            </button>
          )}
          {draft.exercises.map((exercise, index) => (
            <div className="wc-card grid gap-2 border border-stone-200 bg-white sm:grid-cols-5" key={exercise.id}>
              <label>
                <span className="text-sm font-medium text-stone-700">Exercise</span>
                <input
                  className="mt-2 min-h-11 w-full rounded-md border border-stone-300 px-3 text-sm"
                  list="strength-exercises"
                  onChange={(event) =>
                    updateExercise(index, { ...exercise, name: event.target.value })
                  }
                  value={exercise.name}
                />
              </label>
              <NumberInput label="Sets" onChange={(value) => updateExercise(index, { ...exercise, sets: Number(value) || 0 })} value={exercise.sets} />
              <NumberInput label="Reps" onChange={(value) => updateExercise(index, { ...exercise, repetitions: parseOptional(value) })} value={exercise.repetitions ?? ""} />
              <NumberInput label="Load kg" onChange={(value) => updateExercise(index, { ...exercise, loadKg: parseOptional(value) })} value={exercise.loadKg ?? ""} />
              <button
                className="min-h-11 self-end rounded-md border border-red-200 px-3 text-sm font-semibold text-red-700"
                onClick={() => update({ exercises: draft.exercises.filter((_, itemIndex) => itemIndex !== index) })}
                type="button"
              >
                Remove
              </button>
              <label className="sm:col-span-5">
                <span className="text-sm font-medium text-stone-700">Note</span>
                <input
                  className="mt-2 min-h-11 w-full rounded-md border border-stone-300 px-3 text-sm"
                  onChange={(event) =>
                    updateExercise(index, { ...exercise, notes: event.target.value })
                  }
                  value={exercise.notes}
                />
              </label>
            </div>
          ))}
          <datalist id="strength-exercises">
            {exerciseSuggestions.map((exercise) => (
              <option key={exercise} value={exercise} />
            ))}
          </datalist>
          <button
            className="min-h-11 rounded-md border border-stone-300 px-4 text-sm font-semibold text-stone-800"
            onClick={() =>
              update({
                exercises: [
                  ...draft.exercises,
                  {
                    id: makeId("strength-exercise"),
                    name: "",
                    sets: 3,
                    repetitions: 10,
                    loadKg: null,
                    notes: "",
                  },
                ],
              })
            }
            type="button"
          >
            Add exercise
          </button>
        </div>
      )}
    </div>
  );
}

function WeekChart({
  days,
  entries,
}: {
  days: string[];
  entries: ActivityEntry[];
}) {
  const minutesByDay = Object.fromEntries(
    days.map((day) => [
      day,
      entries
        .filter((entry) => entry.date === day)
        .reduce((total, entry) => total + entry.durationMinutes, 0),
    ]),
  );
  const maxMinutes = Math.max(30, ...Object.values(minutesByDay));

  return (
    <div className="mt-5 grid grid-cols-7 gap-2">
      {days.map((day) => {
        const minutes = minutesByDay[day];
        return (
          <div className="grid gap-2 text-center" key={day}>
            <div className="flex h-24 items-end rounded-md bg-stone-100 p-1">
              <div
                className="w-full rounded bg-[var(--accent)]"
                style={{ height: `${Math.max(4, (minutes / maxMinutes) * 100)}%` }}
              />
            </div>
            <p className="text-xs font-medium text-stone-500">{day.slice(5)}</p>
            <p className="text-xs text-stone-600">{Math.round(minutes)} min</p>
          </div>
        );
      })}
    </div>
  );
}
