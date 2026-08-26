import {
  calculateMealNutrition,
  type FoodItem,
  type MealTemplate,
  type NutritionStatus,
  type NutritionValues,
} from "@/lib/food-library";

export type LoggedNutrition = NutritionValues;

export type FoodLogEntry = {
  id: string;
  date: string;
  time: string;
  mealType: "breakfast" | "lunch" | "dinner" | "snack";
  sourceType: "food" | "meal" | "custom-one-off";
  sourceId: string | null;
  name: string;
  servingLabel: string;
  quantity: number;
  nutritionSnapshot: LoggedNutrition;
  nutritionStatus: NutritionStatus;
  componentSnapshots?: Array<{
    foodItemId: string;
    name: string;
    quantity: number;
    nutrition: LoggedNutrition;
    nutritionStatus: NutritionStatus;
  }>;
  quickEstimate?: {
    uncertaintyPercent: number;
    calorieRange: {
      min: number;
      max: number;
    };
    assumptions: string[];
    venueType: string;
    amountConsumedPercent: number;
    fullnessNote: string;
  };
  createdAt: string;
  updatedAt: string;
};

export const FOOD_LOG_STORAGE_KEY = "health-tracker-pwa.food-log-entries.v1";
export const FOOD_LOG_CHANGED_EVENT = "health-tracker:food-log-changed";

export const nutrientKeys = [
  "caloriesKcal",
  "proteinG",
  "carbohydratesG",
  "totalFatG",
  "saturatedFatG",
  "fibreG",
  "sodiumMg",
] as const;

export const emptyLoggedNutrition: LoggedNutrition = {
  caloriesKcal: null,
  proteinG: null,
  carbohydratesG: null,
  totalFatG: null,
  saturatedFatG: null,
  fibreG: null,
  sodiumMg: null,
};

function canUseStorage() {
  return typeof window !== "undefined";
}

export function makeId(prefix = "log") {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function currentLocalTime(date = new Date()) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function inferMealType(date = new Date()): FoodLogEntry["mealType"] {
  const hour = date.getHours();
  if (hour >= 4 && hour <= 10) return "breakfast";
  if (hour >= 11 && hour <= 14) return "lunch";
  if (hour >= 15 && hour <= 20) return "dinner";
  return "snack";
}

export function mealTypeLabel(mealType: FoodLogEntry["mealType"]) {
  if (mealType === "breakfast") return "Breakfast";
  if (mealType === "lunch") return "Lunch";
  if (mealType === "dinner") return "Dinner";
  return "Snack";
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

function notifyFoodLogChanged() {
  if (canUseStorage()) {
    window.dispatchEvent(new CustomEvent(FOOD_LOG_CHANGED_EVENT));
  }
}

export function readFoodLogEntries() {
  return readJson<FoodLogEntry[]>(FOOD_LOG_STORAGE_KEY, []);
}

export function saveFoodLogEntries(entries: FoodLogEntry[]) {
  saveJson(FOOD_LOG_STORAGE_KEY, entries);
  notifyFoodLogChanged();
}

export function entriesForDate(date: string) {
  return readFoodLogEntries().filter((entry) => entry.date === date);
}

export function addFoodLogEntry(entry: FoodLogEntry) {
  const entries = readFoodLogEntries();
  const nextEntries = [...entries, entry];
  saveFoodLogEntries(nextEntries);
  return nextEntries;
}

export function updateFoodLogEntry(entry: FoodLogEntry) {
  const now = new Date().toISOString();
  const entries = readFoodLogEntries().map((current) =>
    current.id === entry.id ? { ...entry, updatedAt: now } : current,
  );
  saveFoodLogEntries(entries);
  return entries;
}

export function deleteFoodLogEntry(id: string) {
  const entries = readFoodLogEntries().filter((entry) => entry.id !== id);
  saveFoodLogEntries(entries);
  return entries;
}

export function scaleNutrition(nutrition: LoggedNutrition, factor: number) {
  return Object.fromEntries(
    nutrientKeys.map((key) => [
      key,
      nutrition[key] === null ? null : Math.round(nutrition[key] * factor * 10) / 10,
    ]),
  ) as LoggedNutrition;
}

export function createLogEntryFromFood({
  date = localDateKey(),
  food,
  mealType = inferMealType(),
  quantity = 1,
  time = currentLocalTime(),
  sourceType = "food",
}: {
  date?: string;
  food: FoodItem;
  mealType?: FoodLogEntry["mealType"];
  quantity?: number;
  time?: string;
  sourceType?: "food" | "custom-one-off";
}): FoodLogEntry {
  const now = new Date().toISOString();
  return {
    id: makeId("food-log"),
    date,
    time,
    mealType,
    sourceType,
    sourceId: sourceType === "food" ? food.id : null,
    name: food.name,
    servingLabel: food.servingLabel,
    quantity,
    nutritionSnapshot: scaleNutrition(food.nutrition ?? emptyLoggedNutrition, quantity),
    nutritionStatus: food.nutritionStatus,
    createdAt: now,
    updatedAt: now,
  };
}

export function createLogEntryFromMeal({
  date = localDateKey(),
  foods,
  meal,
  quantity = 1,
  time = currentLocalTime(),
}: {
  date?: string;
  foods: FoodItem[];
  meal: MealTemplate;
  quantity?: number;
  time?: string;
}): FoodLogEntry {
  const now = new Date().toISOString();
  const foodById = new Map(foods.map((food) => [food.id, food]));
  const mealNutrition = calculateMealNutrition(meal, foods);
  const componentSnapshots = meal.items.map((component) => {
    const food = foodById.get(component.foodItemId);
    const componentQuantity = component.quantity * quantity;
    return {
      foodItemId: component.foodItemId,
      name: food?.name ?? component.foodItemId,
      quantity: componentQuantity,
      nutrition: scaleNutrition(food?.nutrition ?? emptyLoggedNutrition, componentQuantity),
      nutritionStatus: food?.nutritionStatus ?? "missing",
    };
  });
  const knownMealNutrition = Object.fromEntries(
    nutrientKeys.map((key) => {
      const values = componentSnapshots.map((component) => component.nutrition[key]);
      return [
        key,
        values.length === 0 || values.some((value) => value === null)
          ? null
          : (values as number[]).reduce((total, value) => total + value, 0),
      ];
    }),
  ) as LoggedNutrition;

  return {
    id: makeId("food-log"),
    date,
    time,
    mealType: meal.mealType,
    sourceType: "meal",
    sourceId: meal.id,
    name: meal.name,
    servingLabel: "1 meal",
    quantity,
    nutritionSnapshot: mealNutrition.nutrition
      ? scaleNutrition(mealNutrition.nutrition, quantity)
      : knownMealNutrition,
    nutritionStatus: mealNutrition.status,
    componentSnapshots,
    createdAt: now,
    updatedAt: now,
  };
}

export function rescaleLogEntry(entry: FoodLogEntry, nextQuantity: number) {
  const factor = nextQuantity / entry.quantity;
  return {
    ...entry,
    quantity: nextQuantity,
    nutritionSnapshot: scaleNutrition(entry.nutritionSnapshot, factor),
    componentSnapshots: entry.componentSnapshots?.map((component) => ({
      ...component,
      quantity: component.quantity * factor,
      nutrition: scaleNutrition(component.nutrition, factor),
    })),
  };
}

export function sumKnownNutrition(entries: FoodLogEntry[]) {
  const totals = { ...emptyLoggedNutrition };
  const incomplete = Object.fromEntries(nutrientKeys.map((key) => [key, false])) as Record<
    keyof LoggedNutrition,
    boolean
  >;
  let hasEstimated = false;

  for (const entry of entries) {
    if (
      entry.nutritionStatus === "estimated" ||
      entry.componentSnapshots?.some(
        (component) => component.nutritionStatus === "estimated",
      )
    ) {
      hasEstimated = true;
    }

    for (const key of nutrientKeys) {
      const value = entry.nutritionSnapshot[key];
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

export function recentLogSources(entries: FoodLogEntry[]) {
  const seen = new Set<string>();
  return [...entries]
    .sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`))
    .filter((entry) => {
      const key = `${entry.sourceType}:${entry.sourceId ?? entry.name}`;
      if (entry.sourceType === "custom-one-off" || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 8);
}
