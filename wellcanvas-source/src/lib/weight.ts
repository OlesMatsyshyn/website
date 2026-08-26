import { currentLocalTime, localDateKey, makeId } from "@/lib/food-log";

export type WeightMeasurementSlot = {
  id: string;
  name: string;
  defaultTime: string | null;
  colourKey: "amber" | "blue" | "green" | "violet";
  markerShape: "circle" | "square" | "triangle" | "diamond";
  isPrimary: boolean;
  isEnabled: boolean;
  order: number;
};

export type WeightReading = {
  id: string;
  date: string;
  time: string;
  weightKg: number;
  slotId: string;
  note: string;
  createdAt: string;
  updatedAt: string;
};

type OldWeightEntry = {
  date: string;
  morning?: { weightKg: number; time: string };
  evening?: { weightKg: number; time: string };
};

export const OLD_WEIGHT_ENTRIES_STORAGE_KEY =
  "health-tracker-pwa.weight-entries.v1";
export const WEIGHT_SLOTS_STORAGE_KEY =
  "health-tracker-pwa.weight-measurement-slots.v1";
export const WEIGHT_READINGS_STORAGE_KEY = "health-tracker-pwa.weight-readings.v2";
export const WEIGHT_MIGRATION_STORAGE_KEY =
  "health-tracker-pwa.weight-v2-migration.v1";

export const defaultWeightSlots: WeightMeasurementSlot[] = [
  {
    id: "morning",
    name: "Morning",
    defaultTime: "08:00",
    colourKey: "amber",
    markerShape: "circle",
    isPrimary: true,
    isEnabled: true,
    order: 1,
  },
  {
    id: "evening",
    name: "Evening",
    defaultTime: "22:00",
    colourKey: "blue",
    markerShape: "square",
    isPrimary: false,
    isEnabled: true,
    order: 2,
  },
];

export const slotColours: Record<WeightMeasurementSlot["colourKey"], string> = {
  amber: "#d97706",
  blue: "#0284c7",
  green: "#16a34a",
  violet: "#7c3aed",
};

export type MeasurementVariable = {
  id: string;
  name: string;
  unit: string;
  defaultTime: string | null;
  colourKey: "amber" | "blue" | "green" | "violet" | "neutral";
  markerShape: "circle" | "square" | "triangle" | "diamond";
  isPrimary: boolean;
  isEnabled: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
};

export type MeasurementReading = {
  id: string;
  variableId: string;
  date: string;
  time: string;
  value: number;
  note: string;
  createdAt: string;
  updatedAt: string;
};

export const MEASUREMENT_VARIABLES_STORAGE_KEY =
  "health-tracker-pwa.measurement-variables.v1";
export const MEASUREMENT_READINGS_STORAGE_KEY =
  "health-tracker-pwa.measurement-readings.v1";
export const MEASUREMENTS_MIGRATION_STORAGE_KEY =
  "health-tracker-pwa.measurements-migration.v1";

export const measurementColours: Record<MeasurementVariable["colourKey"], string> = {
  ...slotColours,
  neutral: "#57534e",
};

export const defaultMeasurementVariable: MeasurementVariable = {
  id: "measurement-weight",
  name: "Weight",
  unit: "kg",
  defaultTime: "08:00",
  colourKey: "amber",
  markerShape: "circle",
  isPrimary: true,
  isEnabled: true,
  order: 1,
  createdAt: "",
  updatedAt: "",
};

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
  }
}

export function dateFromKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

const DISPLAY_LOCALE = "en-SG";

export function formatShortDate(dateKey: string) {
  return new Intl.DateTimeFormat(DISPLAY_LOCALE, {
    month: "short",
    day: "numeric",
  }).format(dateFromKey(dateKey));
}

export function formatFullDate(dateKey: string) {
  return new Intl.DateTimeFormat(DISPLAY_LOCALE, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(dateFromKey(dateKey));
}

export function dayDifference(laterDateKey: string, earlierDateKey: string) {
  const later = dateFromKey(laterDateKey).getTime();
  const earlier = dateFromKey(earlierDateKey).getTime();
  return Math.round((later - earlier) / 86_400_000);
}

function normalizeSlot(slot: Partial<WeightMeasurementSlot>): WeightMeasurementSlot | null {
  if (!slot.id || !slot.name) return null;

  const colourKey =
    slot.colourKey === "blue" ||
    slot.colourKey === "green" ||
    slot.colourKey === "violet"
      ? slot.colourKey
      : "amber";
  const markerShape =
    slot.markerShape === "square" ||
    slot.markerShape === "triangle" ||
    slot.markerShape === "diamond"
      ? slot.markerShape
      : "circle";

  return {
    id: slot.id,
    name: slot.name,
    defaultTime: slot.defaultTime || null,
    colourKey,
    markerShape,
    isPrimary: Boolean(slot.isPrimary),
    isEnabled: slot.isEnabled !== false,
    order: finiteNumber(slot.order) ? slot.order : 99,
  };
}

function normalizeReading(reading: Partial<WeightReading>): WeightReading | null {
  if (
    !reading.id ||
    !reading.date ||
    !reading.time ||
    !reading.slotId ||
    !finiteNumber(reading.weightKg)
  ) {
    return null;
  }

  return {
    id: reading.id,
    date: reading.date,
    time: reading.time,
    weightKg: reading.weightKg,
    slotId: reading.slotId,
    note: reading.note || "",
    createdAt: reading.createdAt || new Date().toISOString(),
    updatedAt: reading.updatedAt || new Date().toISOString(),
  };
}

export function normalizeSlots(slots: WeightMeasurementSlot[]) {
  const nextSlots = slots.length > 0 ? slots : defaultWeightSlots;
  const enabled = nextSlots.filter((slot) => slot.isEnabled);
  const primaryEnabled = enabled.find((slot) => slot.isPrimary);

  return nextSlots
    .map((slot) => ({
      ...slot,
      isPrimary: primaryEnabled
        ? slot.id === primaryEnabled.id
        : slot.id === enabled[0]?.id,
    }))
    .sort((a, b) => a.order - b.order);
}

export function readWeightSlots() {
  const saved = readJson<Partial<WeightMeasurementSlot>[]>(
    WEIGHT_SLOTS_STORAGE_KEY,
    [],
  )
    .map(normalizeSlot)
    .filter((slot): slot is WeightMeasurementSlot => Boolean(slot));

  const merged = [...defaultWeightSlots];
  for (const slot of saved) {
    const existingIndex = merged.findIndex((current) => current.id === slot.id);
    if (existingIndex >= 0) {
      merged[existingIndex] = { ...merged[existingIndex], ...slot };
    } else {
      merged.push(slot);
    }
  }

  return normalizeSlots(merged);
}

export function saveWeightSlots(slots: WeightMeasurementSlot[]) {
  saveJson(WEIGHT_SLOTS_STORAGE_KEY, normalizeSlots(slots));
}

export function readWeightReadings() {
  return readJson<Partial<WeightReading>[]>(WEIGHT_READINGS_STORAGE_KEY, [])
    .map(normalizeReading)
    .filter((reading): reading is WeightReading => Boolean(reading))
    .sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`));
}

export function saveWeightReadings(readings: WeightReading[]) {
  saveJson(WEIGHT_READINGS_STORAGE_KEY, readings);
}

function normalizeVariable(
  variable: Partial<MeasurementVariable>,
): MeasurementVariable | null {
  if (!variable.id || !variable.name) return null;
  const now = new Date().toISOString();
  const colourKey =
    variable.colourKey === "blue" ||
    variable.colourKey === "green" ||
    variable.colourKey === "violet" ||
    variable.colourKey === "neutral"
      ? variable.colourKey
      : "amber";
  const markerShape =
    variable.markerShape === "square" ||
    variable.markerShape === "triangle" ||
    variable.markerShape === "diamond"
      ? variable.markerShape
      : "circle";

  return {
    id: variable.id,
    name:
      variable.id === "measurement-morning" && variable.name === "Morning weight"
        ? "Weight"
        : variable.name,
    unit: variable.unit || "kg",
    defaultTime: variable.defaultTime || null,
    colourKey,
    markerShape,
    isPrimary: Boolean(variable.isPrimary),
    isEnabled: variable.isEnabled !== false,
    order: finiteNumber(variable.order) ? variable.order : 99,
    createdAt: variable.createdAt || now,
    updatedAt: variable.updatedAt || now,
  };
}

function normalizeMeasurementReading(
  reading: Partial<MeasurementReading>,
): MeasurementReading | null {
  if (
    !reading.id ||
    !reading.variableId ||
    !reading.date ||
    !reading.time ||
    !finiteNumber(reading.value)
  ) {
    return null;
  }

  const now = new Date().toISOString();
  return {
    id: reading.id,
    variableId: reading.variableId,
    date: reading.date,
    time: reading.time,
    value: reading.value,
    note: reading.note || "",
    createdAt: reading.createdAt || now,
    updatedAt: reading.updatedAt || now,
  };
}

export function normalizeMeasurementVariables(variables: MeasurementVariable[]) {
  const nextVariables = variables.length > 0 ? variables : [defaultMeasurementVariable];
  const enabled = nextVariables.filter((variable) => variable.isEnabled);
  const primaryEnabled = enabled.find((variable) => variable.isPrimary);

  return nextVariables
    .map((variable) => ({
      ...variable,
      isPrimary: primaryEnabled
        ? variable.id === primaryEnabled.id
        : variable.id === enabled[0]?.id,
    }))
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
}

export function readMeasurementVariables() {
  const variables = readJson<Partial<MeasurementVariable>[]>(
    MEASUREMENT_VARIABLES_STORAGE_KEY,
    [],
  )
    .map(normalizeVariable)
    .filter((variable): variable is MeasurementVariable => Boolean(variable));

  return normalizeMeasurementVariables(variables);
}

export function saveMeasurementVariables(variables: MeasurementVariable[]) {
  saveJson(
    MEASUREMENT_VARIABLES_STORAGE_KEY,
    normalizeMeasurementVariables(variables),
  );
}

export function readMeasurementReadings() {
  return readJson<Partial<MeasurementReading>[]>(
    MEASUREMENT_READINGS_STORAGE_KEY,
    [],
  )
    .map(normalizeMeasurementReading)
    .filter((reading): reading is MeasurementReading => Boolean(reading))
    .sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`));
}

export function saveMeasurementReadings(readings: MeasurementReading[]) {
  saveJson(MEASUREMENT_READINGS_STORAGE_KEY, readings);
}

function hasSavedWeightSlots() {
  if (!canUseStorage()) return false;
  return Boolean(window.localStorage.getItem(WEIGHT_SLOTS_STORAGE_KEY));
}

function variableFromWeightSlot(slot: WeightMeasurementSlot, now: string) {
  const name =
    slot.id === "morning"
      ? "Weight"
      : slot.id === "evening"
        ? "Evening weight"
        : slot.name;

  return {
    id: `measurement-${slot.id}`,
    name,
    unit: "kg",
    defaultTime: slot.defaultTime,
    colourKey: slot.colourKey,
    markerShape: slot.markerShape,
    isPrimary: slot.isPrimary,
    isEnabled: slot.isEnabled,
    order: slot.order,
    createdAt: now,
    updatedAt: now,
  } satisfies MeasurementVariable;
}

export function migrateMeasurementsV1() {
  if (!canUseStorage()) {
    return {
      variables: [defaultMeasurementVariable],
      readings: [] as MeasurementReading[],
      migrated: false,
    };
  }

  let variables = readMeasurementVariables();
  let readings = readMeasurementReadings();
  const wasMigrated = window.localStorage.getItem(
    MEASUREMENTS_MIGRATION_STORAGE_KEY,
  );

  if (!wasMigrated) {
    const now = new Date().toISOString();
    const weightMigration = migrateWeightEntriesV2();
    const hasWeightHistory = weightMigration.readings.length > 0;
    const shouldMigrateSlots = hasWeightHistory || hasSavedWeightSlots();

    variables = shouldMigrateSlots
      ? weightMigration.slots.map((slot) => variableFromWeightSlot(slot, now))
      : [{ ...defaultMeasurementVariable, createdAt: now, updatedAt: now }];

    const existingReadingIds = new Set(readings.map((reading) => reading.id));
    const migratedReadings = shouldMigrateSlots
      ? weightMigration.readings
          .map((reading) => ({
            id: `measurement-${reading.id}`,
            variableId: `measurement-${reading.slotId}`,
            date: reading.date,
            time: reading.time,
            value: reading.weightKg,
            note: reading.note,
            createdAt: reading.createdAt || now,
            updatedAt: reading.updatedAt || now,
          }))
          .filter((reading) => !existingReadingIds.has(reading.id))
      : [];

    saveMeasurementVariables(variables);
    if (migratedReadings.length > 0) {
      readings = [...migratedReadings, ...readings].sort((a, b) =>
        `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`),
      );
      saveMeasurementReadings(readings);
    }
    window.localStorage.setItem(
      MEASUREMENTS_MIGRATION_STORAGE_KEY,
      JSON.stringify({ migratedAt: now, revision: 1 }),
    );
    variables = readMeasurementVariables();
    readings = readMeasurementReadings();
  }

  const renamedVariables = variables.map((variable) =>
    variable.id === "measurement-morning" && variable.name === "Morning weight"
      ? { ...variable, name: "Weight" }
      : variable,
  );
  if (renamedVariables.some((variable, index) => variable !== variables[index])) {
    variables = renamedVariables;
    saveMeasurementVariables(variables);
  }

  return { variables, readings, migrated: !wasMigrated };
}

export function enabledMeasurementVariables(variables: MeasurementVariable[]) {
  return normalizeMeasurementVariables(variables).filter(
    (variable) => variable.isEnabled,
  );
}

export function primaryMeasurementVariable(variables: MeasurementVariable[]) {
  const enabled = enabledMeasurementVariables(variables);
  return enabled.find((variable) => variable.isPrimary) ?? enabled[0] ?? null;
}

export function readingsForVariable(
  readings: MeasurementReading[],
  variableId: string,
) {
  return [...readings]
    .filter((reading) => reading.variableId === variableId)
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
}

export function upsertMeasurementReading(reading: MeasurementReading) {
  const now = new Date().toISOString();
  const readings = readMeasurementReadings();
  const existing = readings.find(
    (current) =>
      current.variableId === reading.variableId &&
      current.date === reading.date &&
      current.time === reading.time,
  );
  const nextReading = existing
    ? { ...reading, id: existing.id, createdAt: existing.createdAt, updatedAt: now }
    : { ...reading, updatedAt: now };
  const nextReadings = [
    nextReading,
    ...readings.filter((current) => current.id !== nextReading.id),
  ].sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`));
  saveMeasurementReadings(nextReadings);
  return nextReadings;
}

export function makeMeasurementReading({
  date = localDateKey(),
  note = "",
  time = currentLocalTime(),
  value,
  variableId,
}: {
  date?: string;
  note?: string;
  time?: string;
  value: number;
  variableId: string;
}) {
  const now = new Date().toISOString();
  return {
    id: makeId("measurement-reading"),
    variableId,
    date,
    time,
    value,
    note,
    createdAt: now,
    updatedAt: now,
  } satisfies MeasurementReading;
}

export function deleteMeasurementReading(id: string) {
  const readings = readMeasurementReadings().filter((reading) => reading.id !== id);
  saveMeasurementReadings(readings);
  return readings;
}

function oldEntries() {
  return readJson<OldWeightEntry[]>(OLD_WEIGHT_ENTRIES_STORAGE_KEY, []);
}

export function migrateWeightEntriesV2() {
  if (!canUseStorage()) {
    return {
      slots: defaultWeightSlots,
      readings: [] as WeightReading[],
      migrated: false,
    };
  }

  let slots = readWeightSlots();
  let readings = readWeightReadings();
  const wasMigrated = window.localStorage.getItem(WEIGHT_MIGRATION_STORAGE_KEY);

  if (!wasMigrated) {
    const now = new Date().toISOString();
    const existingKeys = new Set(
      readings.map((reading) => `${reading.date}:${reading.slotId}`),
    );
    const migratedReadings: WeightReading[] = [];

    for (const entry of oldEntries()) {
      if (!entry.date) continue;

      if (
        finiteNumber(entry.morning?.weightKg) &&
        entry.morning?.time &&
        !existingKeys.has(`${entry.date}:morning`)
      ) {
        migratedReadings.push({
          id: `weight-reading-morning-${entry.date}`,
          date: entry.date,
          time: entry.morning.time,
          weightKg: entry.morning.weightKg,
          slotId: "morning",
          note: "",
          createdAt: now,
          updatedAt: now,
        });
        existingKeys.add(`${entry.date}:morning`);
      }

      if (
        finiteNumber(entry.evening?.weightKg) &&
        entry.evening?.time &&
        !existingKeys.has(`${entry.date}:evening`)
      ) {
        migratedReadings.push({
          id: `weight-reading-evening-${entry.date}`,
          date: entry.date,
          time: entry.evening.time,
          weightKg: entry.evening.weightKg,
          slotId: "evening",
          note: "",
          createdAt: now,
          updatedAt: now,
        });
        existingKeys.add(`${entry.date}:evening`);
      }
    }

    if (migratedReadings.length > 0) {
      readings = [...migratedReadings, ...readings].sort((a, b) =>
        `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`),
      );
      saveWeightReadings(readings);
    }
    saveWeightSlots(slots);
    window.localStorage.setItem(
      WEIGHT_MIGRATION_STORAGE_KEY,
      JSON.stringify({ migratedAt: now, revision: 2 }),
    );
    slots = readWeightSlots();
  }

  return { slots, readings, migrated: !wasMigrated };
}

export function upsertWeightReading(reading: WeightReading) {
  const now = new Date().toISOString();
  const readings = readWeightReadings();
  const existing = readings.find(
    (current) =>
      current.date === reading.date && current.slotId === reading.slotId,
  );
  const nextReading = existing
    ? { ...reading, id: existing.id, createdAt: existing.createdAt, updatedAt: now }
    : { ...reading, updatedAt: now };
  const nextReadings = [
    nextReading,
    ...readings.filter((current) => current.id !== nextReading.id),
  ].sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`));
  saveWeightReadings(nextReadings);
  return nextReadings;
}

export function deleteWeightReading(id: string) {
  const readings = readWeightReadings().filter((reading) => reading.id !== id);
  saveWeightReadings(readings);
  return readings;
}

export function makeWeightReading({
  date = localDateKey(),
  note = "",
  slotId,
  time = currentLocalTime(),
  weightKg,
}: {
  date?: string;
  note?: string;
  slotId: string;
  time?: string;
  weightKg: number;
}) {
  const now = new Date().toISOString();
  return {
    id: makeId("weight-reading"),
    date,
    time,
    weightKg,
    slotId,
    note,
    createdAt: now,
    updatedAt: now,
  } satisfies WeightReading;
}

export function enabledWeightSlots(slots: WeightMeasurementSlot[]) {
  return normalizeSlots(slots).filter((slot) => slot.isEnabled).slice(0, 4);
}

export function primaryWeightSlot(slots: WeightMeasurementSlot[]) {
  const enabled = enabledWeightSlots(slots);
  return enabled.find((slot) => slot.isPrimary) ?? enabled[0] ?? null;
}

export function readingsForSlot(readings: WeightReading[], slotId: string) {
  return [...readings]
    .filter((reading) => reading.slotId === slotId)
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
}

export function primaryWeightRecords(
  readings: WeightReading[],
  slots: WeightMeasurementSlot[],
) {
  const primary = primaryWeightSlot(slots);
  return primary ? readingsForSlot(readings, primary.id) : [];
}

export function latestPrimaryWeightOnOrBefore(dateKey: string) {
  const measurementState = migrateMeasurementsV1();
  const primaryMeasurement = primaryMeasurementVariable(measurementState.variables);
  if (primaryMeasurement?.unit.toLowerCase() === "kg") {
    const measurementWeight = measurementState.readings
      .filter(
        (reading) =>
          reading.variableId === primaryMeasurement.id && reading.date <= dateKey,
      )
      .sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`))[0]
      ?.value ?? null;
    if (measurementWeight !== null) return measurementWeight;
  }

  const { readings, slots } = migrateWeightEntriesV2();
  const primary = primaryWeightSlot(slots);
  if (!primary) return null;

  return readings
    .filter((reading) => reading.slotId === primary.id && reading.date <= dateKey)
    .sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`))[0]
    ?.weightKg ?? null;
}

export function latestMorningWeightOnOrBeforeV2(dateKey: string) {
  const { readings } = migrateWeightEntriesV2();
  return readings
    .filter((reading) => reading.slotId === "morning" && reading.date <= dateKey)
    .sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`))[0]
    ?.weightKg ?? null;
}
