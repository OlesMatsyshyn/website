"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ActionButton, type ActionButtonState } from "@/components/action-button";
import { BuildPlateForm, QuickEstimateForm, QuickSnackForm } from "@/components/meal-composers";
import { PageHeader } from "@/components/page-header";
import { ToastBridge } from "@/components/toast";
import {
  addFoodLogEntry,
  createLogEntryFromFood,
  createLogEntryFromMeal,
  currentLocalTime,
  deleteFoodLogEntry,
  inferMealType,
  localDateKey,
  mealTypeLabel,
  makeId,
  readFoodLogEntries,
  type FoodLogEntry,
} from "@/lib/food-log";
import {
  applyFoodAiUpdates,
  buildFoodAiPrompt,
  calculateMealNutrition,
  collectionForFood,
  collectionForMeal,
  categoryForFood,
  beverageTypeForFood,
  duplicateFoodItem,
  duplicateMealTemplate,
  STARTER_FOOD_LIBRARY_PACK_ID,
  STARTER_FOOD_LIBRARY_PACK_VERSION,
  importStarterFoodLibrarySeedPack,
  isStarterFoodLibraryInstalled,
  logDestinationForFood,
  nutritionStatusLabel,
  readLibraryVisibilityPreferences,
  readFoodItems,
  readMealTemplates,
  readSeedPacks,
  saveFoodItems,
  saveLibraryVisibilityPreferences,
  saveMealTemplates,
  sortCollectionNames,
  starterLibrarySeedFoods,
  starterSeedMeals,
  syncInstalledSeedPack,
  validateFoodAiResult,
  type FoodMetadataEntry,
  type FoodItem,
  type FoodCategory,
  type FoodReferencePhotoMetadata,
  type LibraryBeverageType,
  type MealTemplate,
  type MealTemplateItem,
  type NutritionStatus,
  type PersonalFoodRating,
  type ValidatedFoodAiUpdate,
  type NutritionValues,
} from "@/lib/food-library";
import {
  addHydrationEntry,
  deleteHydrationEntry,
  readHydrationEntries,
  type BeverageType,
  type HydrationEntry,
} from "@/lib/hydration";
import { nutritionSignals } from "@/lib/nutrition-signals";
import {
  deleteReferencePhoto,
  markReferencePhotoReviewed,
  readReferencePhotoUrl,
  saveReferencePhoto,
} from "@/lib/reference-photos";
import { dateStamp, downloadBlob, jsonZipFile } from "@/lib/portability";
import { createZip, decodeZipJson, readZip } from "@/lib/zip";

type PrimaryFilter =
  | "all"
  | "beverages"
  | "home"
  | "restaurants"
  | "fruit"
  | "vegetables"
  | "nuts"
  | "snacks"
  | "ingredients"
  | "other"
  | "review";
type BeverageFilter =
  | "all-drinks"
  | "water"
  | "coffee-tea"
  | "soft-drinks"
  | "juice"
  | "milk-dairy"
  | "other-drinks";
type SecondaryFilter =
  | "all"
  | "complete"
  | "needs"
  | "official"
  | "estimated"
  | "confirmed";
type FoodLibraryLayout = "one-column" | "two-column";
type AddCardState = "idle" | "adding" | "added";
type ContextualItemType = "food" | "meal" | "drink";
type FoodDialogMode = "details" | "edit";
type EditorEntitySelection = {
  kind: "food" | "meal" | "drink";
  id: string;
} | null;
type QuickCreateModalState =
  | {
      kind: "food";
      initialCategory: FoodCategory;
      initialCollectionName: string;
      initialLocationName: string;
    }
  | {
      kind: "drink";
      initialBeverageType: LibraryBeverageType;
      initialCollectionName: string;
      initialLocationName: string;
    };
type GroupAddContext = {
  allowFood: boolean;
  allowMeal: boolean;
  category: FoodCategory;
  collectionName: string | null;
  defaultType: ContextualItemType;
  groupName: string;
  locationName: string | null;
};
type EmptyCategoryDescriptor = {
  body: string;
  groupName: string;
  title: string;
};

const FOOD_LIBRARY_LAYOUT_STORAGE_KEY =
  "health-tracker-pwa.food-library-layout.v1";
const DEFAULT_FOOD_LIBRARY_LAYOUT: FoodLibraryLayout = "one-column";

function normalizeFoodLibraryLayout(value: unknown): FoodLibraryLayout {
  return value === "two-column" ? "two-column" : DEFAULT_FOOD_LIBRARY_LAYOUT;
}

function readFoodLibraryLayout(): FoodLibraryLayout {
  if (typeof window === "undefined") return DEFAULT_FOOD_LIBRARY_LAYOUT;
  try {
    return normalizeFoodLibraryLayout(
      window.localStorage.getItem(FOOD_LIBRARY_LAYOUT_STORAGE_KEY),
    );
  } catch {
    return DEFAULT_FOOD_LIBRARY_LAYOUT;
  }
}

function saveFoodLibraryLayout(value: FoodLibraryLayout) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    FOOD_LIBRARY_LAYOUT_STORAGE_KEY,
    normalizeFoodLibraryLayout(value),
  );
}
type FoodPackManifest = {
  format: "wellcanvas-food-pack";
  schemaVersion: 1;
  name: string;
  region: string;
  creator: { displayName?: string };
  exportedAt: string;
  itemCount: number;
};
type FoodPackPayload = {
  foods: FoodItem[];
  meals: MealTemplate[];
};

const primaryFilters: Array<{ value: PrimaryFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "home", label: "Home" },
  { value: "restaurants", label: "Restaurants" },
  { value: "fruit", label: "Fruit" },
  { value: "vegetables", label: "Vegetables" },
  { value: "nuts", label: "Nuts" },
  { value: "snacks", label: "Snacks" },
  { value: "ingredients", label: "Ingredients" },
  { value: "other", label: "Other" },
  { value: "review", label: "Needs review" },
];

const beverageFilters: Array<{ value: BeverageFilter; label: string }> = [
  { value: "all-drinks", label: "All drinks" },
  { value: "water", label: "Water" },
  { value: "coffee-tea", label: "Coffee / tea" },
  { value: "soft-drinks", label: "Soft drinks" },
  { value: "juice", label: "Juice" },
  { value: "milk-dairy", label: "Milk / dairy" },
  { value: "other-drinks", label: "Other drinks" },
];

const secondaryFilters: Array<{ value: SecondaryFilter; label: string }> = [
  { value: "all", label: "All nutrition" },
  { value: "complete", label: "Complete nutrition" },
  { value: "needs", label: "Needs nutrition" },
  { value: "official", label: "Official" },
  { value: "estimated", label: "Estimated" },
  { value: "confirmed", label: "User-confirmed" },
];

const primaryEmptyCategories: Partial<Record<PrimaryFilter, EmptyCategoryDescriptor>> = {
  home: {
    body: "Add your first home food or meal.",
    groupName: "Home food",
    title: "No items yet.",
  },
  restaurants: {
    body: "Add your first restaurant food or meal.",
    groupName: "Restaurants",
    title: "No items yet.",
  },
  fruit: {
    body: "Add your first fruit.",
    groupName: "Fruit",
    title: "No items yet.",
  },
  vegetables: {
    body: "Add your first vegetable.",
    groupName: "Vegetables",
    title: "No items yet.",
  },
  nuts: {
    body: "Add your first nut or seed.",
    groupName: "Nuts and seeds",
    title: "No items yet.",
  },
  snacks: {
    body: "Add your first snack.",
    groupName: "Processed snacks",
    title: "No items yet.",
  },
  ingredients: {
    body: "Add your first ingredient.",
    groupName: "Ingredients",
    title: "No items yet.",
  },
  other: {
    body: "Add your first item.",
    groupName: "Other",
    title: "No items yet.",
  },
};

const beverageEmptyCategories: Partial<Record<BeverageFilter, EmptyCategoryDescriptor>> = {
  water: {
    body: "Add your first water.",
    groupName: "Water",
    title: "No drinks yet.",
  },
  "coffee-tea": {
    body: "Add your first coffee or tea.",
    groupName: "Coffee / tea",
    title: "No drinks yet.",
  },
  "soft-drinks": {
    body: "Add your first soft drink.",
    groupName: "Soft drinks",
    title: "No drinks yet.",
  },
  juice: {
    body: "Add your first juice.",
    groupName: "Juice",
    title: "No drinks yet.",
  },
  "milk-dairy": {
    body: "Add your first milk or dairy drink.",
    groupName: "Milk / dairy",
    title: "No drinks yet.",
  },
  "other-drinks": {
    body: "Add your first drink.",
    groupName: "Other drinks",
    title: "No drinks yet.",
  },
};

const foodCategoryOptions: Array<{ value: FoodCategory; label: string }> = [
  { value: "breakfast", label: "Breakfast" },
  { value: "restaurant-meal", label: "Restaurant meal" },
  { value: "fruit", label: "Fruit" },
  { value: "vegetable", label: "Vegetable" },
  { value: "nuts-seeds", label: "Nuts and seeds" },
  { value: "grain-starch", label: "Grain or starch" },
  { value: "protein", label: "Protein" },
  { value: "dairy", label: "Dairy" },
  { value: "processed-snack", label: "Processed snack" },
  { value: "drink", label: "Drink" },
  { value: "meal-component", label: "Meal component" },
  { value: "other", label: "Other" },
];

const nutritionKeys: Array<{
  key: keyof NutritionValues;
  label: string;
  unit: string;
}> = [
  { key: "caloriesKcal", label: "Calories", unit: "kcal" },
  { key: "proteinG", label: "Protein", unit: "g" },
  { key: "carbohydratesG", label: "Carbohydrates", unit: "g" },
  { key: "totalFatG", label: "Total fat", unit: "g" },
  { key: "saturatedFatG", label: "Saturated fat", unit: "g" },
  { key: "sugarsG", label: "Sugars", unit: "g" },
  { key: "fibreG", label: "Fibre", unit: "g" },
  { key: "sodiumMg", label: "Sodium", unit: "mg" },
];

const emptyNutrition: NutritionValues = {
  caloriesKcal: null,
  proteinG: null,
  carbohydratesG: null,
  totalFatG: null,
  saturatedFatG: null,
  sugarsG: null,
  fibreG: null,
  sodiumMg: null,
};

function formatNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value)
    ? value.toLocaleString(undefined, { maximumFractionDigits: 1 })
    : "—";
}

function formatCalories(
  value: number | null | undefined,
  status: NutritionStatus,
) {
  const formatted = formatNumber(value);
  return formatted === "—"
    ? formatted
    : `${status === "estimated" ? "≈ " : ""}${formatted} kcal`;
}

function formatRating(rating: PersonalFoodRating | null | undefined) {
  return rating ? `${"★".repeat(rating)}${"☆".repeat(5 - rating)}` : "";
}

function RatingPicker({
  label = "My rating",
  onChange,
  rating,
}: {
  label?: string;
  onChange: (rating: PersonalFoodRating | null) => void;
  rating: PersonalFoodRating | null | undefined;
}) {
  return (
    <div className="rounded-md bg-stone-50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-stone-950">{label}</p>
        {rating ? (
          <button
            className="text-xs font-semibold text-stone-600 underline underline-offset-4"
            onClick={() => onChange(null)}
            type="button"
          >
            Clear rating
          </button>
        ) : null}
      </div>
      <div className="mt-2 flex gap-1" role="group" aria-label={label}>
        {([1, 2, 3, 4, 5] as const).map((value) => (
          <button
            aria-label={`Rate ${value} out of 5`}
            className="min-h-9 min-w-9 rounded-md text-xl leading-none text-amber-500 hover:bg-amber-50 focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
            key={value}
            onClick={() => onChange(value)}
            type="button"
          >
            {rating && value <= rating ? "★" : "☆"}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-stone-500">
        Personal preference only, not a nutrition or health score.
      </p>
    </div>
  );
}

function statusClasses(status: NutritionStatus) {
  if (status === "official") return "bg-emerald-50 text-emerald-800";
  if (status === "user-confirmed") return "bg-sky-50 text-sky-800";
  if (status === "estimated") return "bg-amber-50 text-amber-800";
  return "bg-stone-100 text-stone-700";
}

function primaryAddClasses(extra = "") {
  return `btn btn-primary-accent min-h-10 px-3 text-sm ${extra}`;
}

function primarySaveClasses(extra = "") {
  return `btn btn-primary-dark min-h-10 px-3 text-sm ${extra}`;
}

function secondaryClasses(extra = "") {
  return `btn btn-secondary-outline min-h-10 px-3 text-sm ${extra}`;
}

function tertiaryClasses(extra = "") {
  return `btn btn-tertiary-text min-h-10 px-1 text-sm ${extra}`;
}

function isCompleteNutrition(nutrition: NutritionValues | null) {
  return Boolean(
    nutrition &&
      nutritionKeys.every(({ key }) => typeof nutrition[key] === "number"),
  );
}

function suggestedCollectionName({
  brand,
  locationName,
}: {
  brand?: string;
  locationName?: string;
}) {
  return locationName?.trim() || brand?.trim() || "";
}

function fieldIdForFood(field: string) {
  return `food-editor-${field}`;
}

function parseOptionalNumber(value: string) {
  return value.trim() === "" ? null : Number(value);
}

function normalizeSearch(value: string) {
  return value.trim().toLowerCase();
}

type LibraryEntry =
  | {
      id: string;
      entryType: "meal";
      item: MealTemplate;
      name: string;
      groupName: string;
      searchText: string;
      isComplete: boolean;
      nutritionStatus: NutritionStatus;
      isIngredient: false;
      needsReview: boolean;
      isHidden: boolean;
    }
  | {
      id: string;
      entryType: "food";
      item: FoodItem;
      name: string;
      groupName: string;
      searchText: string;
      isComplete: boolean;
      nutritionStatus: NutritionStatus;
      isIngredient: boolean;
      needsReview: boolean;
      isHidden: boolean;
    };

const preferredLibraryGroups = [
  "Home food",
  "Restaurants",
  "Fruit",
  "Nuts and seeds",
  "Vegetables",
  "Ingredients",
  "Processed snacks",
  "Water",
  "Coffee / tea",
  "Soft drinks",
  "Juice",
  "Milk / dairy",
  "Other drinks",
  "Other restaurants",
  "Other",
];

function beverageGroupForFood(food: FoodItem) {
  const type = food.beverageType;
  const text = `${food.name} ${food.collectionName ?? ""} ${food.brand ?? ""}`.toLowerCase();
  if (type === "tap-water" || type === "still-water" || type === "sparkling-water") {
    return "Water";
  }
  if (type === "coffee" || type === "tea" || text.includes("coffee") || text.includes("tea")) {
    return "Coffee / tea";
  }
  if (type === "sweet-soda" || type === "zero-soda" || text.includes("soda")) {
    return "Soft drinks";
  }
  if (type === "juice" || text.includes("juice")) return "Juice";
  if (type === "milk-dairy" || text.includes("milk") || text.includes("latte")) {
    return "Milk / dairy";
  }
  return "Other drinks";
}

function beverageTypeForGroup(groupName: string): LibraryBeverageType {
  if (groupName === "Water") return "still-water";
  if (groupName === "Coffee / tea") return "coffee";
  if (groupName === "Soft drinks") return "sweet-soda";
  if (groupName === "Juice") return "juice";
  if (groupName === "Milk / dairy") return "milk-dairy";
  return "other";
}

function normalizeLibraryName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeDisplayGroup(value: string) {
  const normalized = value.trim().toLowerCase().replace(/[’']/g, "'");
  if (!normalized || normalized === "general") return "Other";
  if (normalized === "home" || normalized === "home meals") return "Home food";
  if (normalized === "fruits") return "Fruit";
  if (normalized === "snacks") return "Processed snacks";
  if (normalized === "home meal components") return "Ingredients";
  return value.trim();
}

function groupForFood(food: FoodItem) {
  const category = categoryForFood(food);
  const collection = normalizeDisplayGroup(collectionForFood(food));

  if (category === "fruit") return "Fruit";
  if (category === "vegetable") return "Vegetables";
  if (category === "nuts-seeds") return "Nuts and seeds";
  if (category === "processed-snack") return "Processed snacks";
  if (category === "drink") return beverageGroupForFood(food);
  if (category === "meal-component" && collection === "Ingredients") {
    return "Ingredients";
  }
  if (category === "restaurant-meal") return collection === "Other" ? "Other restaurants" : collection;
  return collection;
}

function groupForMeal(meal: MealTemplate) {
  return normalizeDisplayGroup(collectionForMeal(meal));
}

function isIngredientFood(food: FoodItem) {
  const category = categoryForFood(food);
  if (!food.isSeedItem) return false;
  if (logDestinationForFood(food) === "hydration") return false;
  return (
    category === "breakfast" ||
    category === "meal-component" ||
    category === "protein" ||
    category === "grain-starch" ||
    category === "drink"
  );
}

function isReusableDrink(food: FoodItem) {
  return logDestinationForFood(food) === "hydration";
}

function groupSortValue(groupName: string) {
  const index = preferredLibraryGroups.indexOf(groupName);
  return index === -1 ? 1000 : index;
}

function sortLibraryGroups(groupNames: string[]) {
  return [...groupNames].sort((a, b) => {
    const order = groupSortValue(a) - groupSortValue(b);
    return order === 0 ? a.localeCompare(b) : order;
  });
}

function groupDestination(groupName: string): Pick<
  GroupAddContext,
  "category" | "collectionName" | "locationName"
> {
  if (groupName === "Home food") {
    return {
      category: "breakfast",
      collectionName: "Home",
      locationName: "Home",
    };
  }
  if (groupName === "Fruit") {
    return { category: "fruit", collectionName: null, locationName: null };
  }
  if (groupName === "Vegetables") {
    return { category: "vegetable", collectionName: null, locationName: null };
  }
  if (groupName === "Nuts and seeds") {
    return { category: "nuts-seeds", collectionName: null, locationName: null };
  }
  if (groupName === "Processed snacks") {
    return { category: "processed-snack", collectionName: null, locationName: null };
  }
  if (beverageFilters.some((filter) => filter.label === groupName)) {
    return { category: "drink", collectionName: groupName, locationName: null };
  }
  if (groupName === "Ingredients") {
    return {
      category: "meal-component",
      collectionName: "Ingredients",
      locationName: null,
    };
  }
  if (groupName === "Restaurants" || groupName === "Other restaurants") {
    return {
      category: "restaurant-meal",
      collectionName: groupName === "Restaurants" ? "Restaurants" : null,
      locationName: null,
    };
  }
  if (groupName === "Other") {
    return { category: "other", collectionName: null, locationName: null };
  }
  return {
    category: "other",
    collectionName: groupName,
    locationName: groupName,
  };
}

function contextualTypeForGroup(groupName: string, entries: LibraryEntry[]) {
  if (beverageFilters.some((filter) => filter.label === groupName)) return "drink";
  if (
    [
      "Fruit",
      "Vegetables",
      "Nuts and seeds",
      "Processed snacks",
      "Ingredients",
    ].includes(groupName)
  ) {
    return "food";
  }
  if (groupName === "Home food") return "meal";

  const mealCount = entries.filter((entry) => entry.entryType === "meal").length;
  const foodCount = entries.length - mealCount;
  return mealCount > foodCount ? "meal" : "food";
}

function createGroupAddContext(
  groupName: string,
  entries: LibraryEntry[],
): GroupAddContext {
  const destination = groupDestination(groupName);
  const defaultType = contextualTypeForGroup(groupName, entries);
  const unambiguousFoodGroup = [
    "Fruit",
    "Vegetables",
    "Nuts and seeds",
    "Processed snacks",
    "Home meal components",
  ].includes(groupName);

  return {
    ...destination,
    allowFood: defaultType !== "drink",
    allowMeal: !unambiguousFoodGroup && defaultType !== "drink",
    defaultType,
    groupName,
  };
}

function matchesPrimaryFilter(entry: LibraryEntry, filter: PrimaryFilter) {
  if (filter === "all") return true;
  if (filter === "beverages") return true;
  if (filter === "review") return entry.needsReview;
  if (filter === "ingredients") return entry.entryType === "food" && entry.isIngredient;
  if (filter === "home") return entry.groupName === "Home food";
  if (filter === "restaurants") {
    return (
      entry.groupName === "Other restaurants" ||
      (entry.entryType === "food" && categoryForFood(entry.item) === "restaurant-meal")
    );
  }

  if (entry.entryType !== "food") return false;
  const category = categoryForFood(entry.item);
  if (filter === "fruit") return category === "fruit";
  if (filter === "vegetables") return category === "vegetable";
  if (filter === "nuts") return category === "nuts-seeds";
  if (filter === "snacks") return category === "processed-snack";
  if (filter === "other") return entry.groupName === "Other";
  return true;
}

function matchesBeverageFilter(entry: LibraryEntry, filter: BeverageFilter) {
  if (filter === "all-drinks") return entry.entryType === "food" && categoryForFood(entry.item) === "drink";
  if (entry.entryType !== "food" || categoryForFood(entry.item) !== "drink") return false;
  const group = beverageGroupForFood(entry.item);
  if (filter === "water") return group === "Water";
  if (filter === "coffee-tea") return group === "Coffee / tea";
  if (filter === "soft-drinks") return group === "Soft drinks";
  if (filter === "juice") return group === "Juice";
  if (filter === "milk-dairy") return group === "Milk / dairy";
  return group === "Other drinks";
}

function matchesSecondaryFilter(entry: LibraryEntry, filter: SecondaryFilter) {
  if (filter === "complete") return entry.isComplete;
  if (filter === "needs") return !entry.isComplete;
  if (filter === "official") return entry.nutritionStatus === "official";
  if (filter === "estimated") return entry.nutritionStatus === "estimated";
  if (filter === "confirmed") return entry.nutritionStatus === "user-confirmed";
  return true;
}

function librarySearchRank(entry: LibraryEntry, query: string) {
  let rank = 100;
  const name = entry.name.toLowerCase();

  if (query && name === query) rank -= 60;
  else if (query && name.startsWith(query)) rank -= 40;
  else if (query && name.includes(query)) rank -= 25;
  if (entry.entryType === "food" && !entry.item.isSeedItem) rank -= 12;
  return rank;
}

function groupEntries<T extends { name: string }>(
  entries: T[],
  getCollectionName: (entry: T) => string,
) {
  const grouped = new Map<string, T[]>();

  for (const entry of entries) {
    const collectionName = getCollectionName(entry);
    grouped.set(collectionName, [...(grouped.get(collectionName) ?? []), entry]);
  }

  return sortLibraryGroups([...grouped.keys()]).map((collectionName) => ({
    collectionName,
    entries: [...(grouped.get(collectionName) ?? [])].sort((a, b) => {
      return a.name.localeCompare(b.name);
    }),
  }));
}

function StatusBadge({ status }: { status: NutritionStatus }) {
  return (
    <span
      className={`rounded-md px-2 py-1 text-xs font-semibold ${statusClasses(status)}`}
    >
      {nutritionStatusLabel(status)}
    </span>
  );
}

function SignalRow({
  signals,
}: {
  signals: Array<{ label: string; tone: "amber" | "blue" | "emerald" | "stone" }>;
}) {
  const classes = {
    amber: "bg-amber-50 text-amber-800",
    blue: "bg-sky-50 text-sky-800",
    emerald: "bg-emerald-50 text-emerald-800",
    stone: "bg-stone-100 text-stone-700",
  };

  return (
    <div className="mt-2 flex flex-wrap gap-1">
      {signals.map((signal) => (
        <span
          className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${classes[signal.tone]}`}
          key={signal.label}
        >
          {signal.label}
        </span>
      ))}
    </div>
  );
}

function SmallButton({
  ariaLabel,
  children,
  onClick,
}: {
  ariaLabel?: string;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={ariaLabel}
      className={secondaryClasses()}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function CheckboxInput({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex min-h-10 items-center gap-2 text-sm font-medium text-stone-700">
      <input
        checked={checked}
        className="h-4 w-4"
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
      {label}
    </label>
  );
}

const libraryImportSchemaVersion = "health-tracker-library-import-v1";
const foodCategories: FoodCategory[] = [
  "breakfast",
  "restaurant-meal",
  "fruit",
  "vegetable",
  "nuts-seeds",
  "grain-starch",
  "protein",
  "dairy",
  "processed-snack",
  "drink",
  "meal-component",
  "other",
];

type LibraryImportFoodPreview = {
  approved: boolean;
  duplicateAction: "keep" | "import" | "update" | "duplicate";
  errors: string[];
  existingMatch: FoodItem | null;
  food: Omit<FoodItem, "id" | "countryCode" | "isSeedItem" | "clonedFromId" | "createdAt" | "updatedAt">;
  temporaryId: string;
};

type LibraryImportMealPreview = {
  approved: boolean;
  errors: string[];
  meal: Omit<
    MealTemplate,
    "id" | "items" | "isSeedItem" | "clonedFromId" | "createdAt" | "updatedAt"
  > & {
    items: Array<{ temporaryFoodId: string; quantity: number }>;
  };
  temporaryId: string;
};

type LibraryImportPreview = {
  errors: string[];
  foods: LibraryImportFoodPreview[];
  meals: LibraryImportMealPreview[];
};

function buildLibraryImportPrompt() {
  return `You are helping populate a private nutrition-tracking library.

I will describe a dish or attach a photograph.

Estimate the consumed serving rather than 100 g unless I explicitly ask for a per-100-g entry.

Return one JSON object only. Do not use Markdown.

When using a photo, I will attach it manually in this ChatGPT conversation. The app cannot attach photos automatically.

Use this schema:

{
  "schemaVersion": "health-tracker-library-import-v1",
  "foods": [
    {
      "temporaryId": "food-1",
      "name": "Display name",
      "description": "Short factual description",
      "collectionName": "Restaurant, store, or generic group",
      "category": "restaurant-meal",
      "servingLabel": "One serving, approximately 400 g",
      "servingWeightG": 400,
      "nutrition": {
        "caloriesKcal": 610,
        "proteinG": 42,
        "carbohydratesG": 77,
        "totalFatG": 16,
        "saturatedFatG": 4,
        "fibreG": 10,
        "sodiumMg": 1350
      },
      "nutritionStatus": "estimated",
      "uncertaintyPercent": 25,
      "assumptions": ["Assumption one"],
      "sourceLabel": "Estimated from user description or photograph",
      "metadataEntries": [
        { "label": "Location", "value": "Maxwell Food Centre" }
      ]
    }
  ],
  "meals": [
    {
      "temporaryId": "meal-1",
      "name": "Chicken rice lunch",
      "description": "One complete saved meal",
      "collectionName": "Food court",
      "mealType": "lunch",
      "metadataEntries": [
        { "label": "Notes", "value": "Optional context" }
      ],
      "items": [
        { "temporaryFoodId": "food-1", "quantity": 1 }
      ]
    }
  ]
}

Rules:
- return valid JSON only
- use null for genuinely unknown nutrients, never zero
- do not imply false precision
- use estimated status for photograph- or description-based values
- provide uncertainty from 10 to 50 percent
- list assumptions
- do not include dieting advice
- do not label food good or bad
- keep restaurant names factual
- include an approximate serving weight when possible
- when the photo contains multiple separately reusable items, return several foods
- when the items form one reusable meal, also include an optional meal record referencing temporaryId values`;
}

function stripOuterCodeFence(value: string) {
  const trimmed = value.trim();
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match ? match[1].trim() : trimmed;
}

function finiteOrNull(value: unknown, errors: string[], label: string) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    errors.push(`${label} must be a non-negative finite number or null.`);
    return null;
  }
  return value;
}

function normalizeDuplicateKey({
  collectionName,
  name,
  servingLabel,
}: {
  collectionName: string | null;
  name: string;
  servingLabel: string;
}) {
  return [name, collectionName ?? "", servingLabel]
    .join("|")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function validateLibraryImportResult(raw: string, existingFoods: FoodItem[]): LibraryImportPreview {
  const errors: string[] = [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripOuterCodeFence(raw));
  } catch {
    return { errors: ["Paste valid JSON. Markdown code fences may wrap the JSON, but prose cannot be parsed."], foods: [], meals: [] };
  }

  if (!parsed || typeof parsed !== "object") {
    return { errors: ["Result must be one JSON object."], foods: [], meals: [] };
  }

  const record = parsed as Record<string, unknown>;
  if (record.schemaVersion !== libraryImportSchemaVersion) {
    errors.push(`schemaVersion must be ${libraryImportSchemaVersion}.`);
  }

  const rawFoods = Array.isArray(record.foods) ? record.foods : [];
  const rawMeals = Array.isArray(record.meals) ? record.meals : [];
  const seenFoodIds = new Set<string>();
  const duplicateKeys = new Map(
    existingFoods.map((food) => [
      normalizeDuplicateKey(food),
      food,
    ]),
  );

  const foods = rawFoods.map((rawFood, index): LibraryImportFoodPreview => {
    const itemErrors: string[] = [];
    const food = (rawFood && typeof rawFood === "object" ? rawFood : {}) as Record<string, unknown>;
    const temporaryId = typeof food.temporaryId === "string" && food.temporaryId.trim()
      ? food.temporaryId.trim()
      : `food-${index + 1}`;
    if (seenFoodIds.has(temporaryId)) itemErrors.push(`Duplicate temporaryId: ${temporaryId}.`);
    seenFoodIds.add(temporaryId);

    const name = typeof food.name === "string" ? food.name.trim() : "";
    const servingLabel = typeof food.servingLabel === "string" ? food.servingLabel.trim() : "";
    if (!name) itemErrors.push("Name is required.");

    const category = foodCategories.includes(food.category as FoodCategory)
      ? (food.category as FoodCategory)
      : "other";
    if (food.category && category === "other" && food.category !== "other") {
      itemErrors.push("Category is not recognized.");
    }

    const servingWeightG = finiteOrNull(food.servingWeightG, itemErrors, "Serving weight");
    if (servingWeightG !== null && servingWeightG <= 0) {
      itemErrors.push("Serving weight must be positive when supplied.");
    }

    const nutritionRecord =
      food.nutrition && typeof food.nutrition === "object"
        ? (food.nutrition as Record<string, unknown>)
        : null;
    const nutrition = nutritionRecord
      ? {
          caloriesKcal: finiteOrNull(nutritionRecord.caloriesKcal, itemErrors, "Calories"),
          proteinG: finiteOrNull(nutritionRecord.proteinG, itemErrors, "Protein"),
          carbohydratesG: finiteOrNull(nutritionRecord.carbohydratesG, itemErrors, "Carbohydrates"),
          totalFatG: finiteOrNull(nutritionRecord.totalFatG, itemErrors, "Total fat"),
          saturatedFatG: finiteOrNull(nutritionRecord.saturatedFatG, itemErrors, "Saturated fat"),
          fibreG: finiteOrNull(nutritionRecord.fibreG, itemErrors, "Fibre"),
          sodiumMg: finiteOrNull(nutritionRecord.sodiumMg, itemErrors, "Sodium"),
        }
      : null;
    const nutritionStatus =
      food.nutritionStatus === "estimated" ||
      food.nutritionStatus === "user-confirmed" ||
      food.nutritionStatus === "missing"
        ? food.nutritionStatus
        : "estimated";
    const uncertaintyPercent = finiteOrNull(
      food.uncertaintyPercent,
      itemErrors,
      "Uncertainty",
    );
    if (
      uncertaintyPercent !== null &&
      (uncertaintyPercent < 0 || uncertaintyPercent > 100)
    ) {
      itemErrors.push("Uncertainty must be between 0 and 100.");
    }
    const assumptions = Array.isArray(food.assumptions)
      ? food.assumptions
          .filter(
            (entry): entry is string =>
              typeof entry === "string" && entry.trim().length > 0,
          )
          .map((entry) => entry.trim())
      : [];
    if (assumptions.length === 0 && nutritionStatus === "estimated") {
      itemErrors.push("Estimated foods need assumptions.");
    }
    const metadataEntries = cleanMetadataEntries(
      Array.isArray(food.metadataEntries)
        ? food.metadataEntries.map((entry, entryIndex) => {
            const record =
              entry && typeof entry === "object"
                ? (entry as Record<string, unknown>)
                : {};
            return {
              id:
                typeof record.id === "string" && record.id.trim()
                  ? record.id.trim()
                  : `detail-${index + 1}-${entryIndex + 1}`,
              label: typeof record.label === "string" ? record.label : "",
              value: typeof record.value === "string" ? record.value : "",
            };
          })
        : [],
    );
    const collectionName =
      typeof food.collectionName === "string" && food.collectionName.trim()
        ? food.collectionName.trim()
        : null;
    const existingMatch = duplicateKeys.get(
      normalizeDuplicateKey({ name, collectionName, servingLabel }),
    ) ?? null;

    return {
      approved: itemErrors.length === 0 && !existingMatch,
      duplicateAction: existingMatch ? "keep" : "import",
      errors: itemErrors,
      existingMatch,
      temporaryId,
      food: {
        name,
        description: typeof food.description === "string" && food.description.trim() ? food.description.trim() : name,
        brand: null,
        servingLabel: servingLabel || "Serving not specified",
        servingWeightG,
        locationName: collectionName,
        collectionName,
        category,
        nutrition,
        nutritionStatus: nutrition ? nutritionStatus : "missing",
        uncertaintyPercent: nutritionStatus === "estimated" ? uncertaintyPercent ?? 25 : null,
        sourceLabel: typeof food.sourceLabel === "string" && food.sourceLabel.trim() ? food.sourceLabel.trim() : "Estimated from user description or photograph",
        sourceUrl: null,
        lastVerifiedAt: null,
        assumptions,
        usualStore: null,
        pricePaidSgd: null,
        packageOrPurchaseWeight: null,
        purchaseDate: null,
        metadataEntries,
        photoPending: false,
        exactNamePending: false,
        portionVerificationPending: false,
        needsNutritionReview: false,
        reviewReason: null,
        reviewNote: null,
        referencePhoto: null,
      },
    };
  });

  const validFoodIds = new Set(foods.map((food) => food.temporaryId));
  const seenMealIds = new Set<string>();
  const meals = rawMeals.map((rawMeal, index): LibraryImportMealPreview => {
    const itemErrors: string[] = [];
    const meal = (rawMeal && typeof rawMeal === "object" ? rawMeal : {}) as Record<string, unknown>;
    const temporaryId = typeof meal.temporaryId === "string" && meal.temporaryId.trim()
      ? meal.temporaryId.trim()
      : `meal-${index + 1}`;
    if (seenMealIds.has(temporaryId)) itemErrors.push(`Duplicate meal temporaryId: ${temporaryId}.`);
    seenMealIds.add(temporaryId);
    const name = typeof meal.name === "string" ? meal.name.trim() : "";
    if (!name) itemErrors.push("Meal name is required.");
    const mealType =
      meal.mealType === "breakfast" ||
      meal.mealType === "lunch" ||
      meal.mealType === "dinner" ||
      meal.mealType === "snack"
        ? meal.mealType
        : "lunch";
    const rawItems = Array.isArray(meal.items) ? meal.items : [];
    const componentIds = new Set<string>();
    const items = rawItems.map((rawItem) => {
      const component = (rawItem && typeof rawItem === "object" ? rawItem : {}) as Record<string, unknown>;
      const temporaryFoodId = typeof component.temporaryFoodId === "string" ? component.temporaryFoodId.trim() : "";
      const quantity = typeof component.quantity === "number" ? component.quantity : Number.NaN;
      if (!validFoodIds.has(temporaryFoodId)) itemErrors.push(`Meal references unknown food ${temporaryFoodId || "—"}.`);
      if (componentIds.has(temporaryFoodId)) itemErrors.push(`Meal repeats ${temporaryFoodId}; combine quantities first.`);
      componentIds.add(temporaryFoodId);
      if (!Number.isFinite(quantity) || quantity <= 0) itemErrors.push("Meal quantities must be positive.");
      return { temporaryFoodId, quantity };
    });
    const metadataEntries = cleanMetadataEntries(
      Array.isArray(meal.metadataEntries)
        ? meal.metadataEntries.map((entry, entryIndex) => {
            const record =
              entry && typeof entry === "object"
                ? (entry as Record<string, unknown>)
                : {};
            return {
              id:
                typeof record.id === "string" && record.id.trim()
                  ? record.id.trim()
                  : `meal-detail-${index + 1}-${entryIndex + 1}`,
              label: typeof record.label === "string" ? record.label : "",
              value: typeof record.value === "string" ? record.value : "",
            };
          })
        : [],
    );

    return {
      approved: itemErrors.length === 0,
      errors: itemErrors,
      temporaryId,
      meal: {
        name,
        description: typeof meal.description === "string" && meal.description.trim() ? meal.description.trim() : name,
        mealType,
        locationName: typeof meal.collectionName === "string" ? meal.collectionName.trim() || null : null,
        collectionName: typeof meal.collectionName === "string" ? meal.collectionName.trim() || null : null,
        estimatedPriceSgd: null,
        metadataEntries,
        items,
        needsNutritionReview: false,
        reviewReason: null,
        reviewNote: null,
        referencePhoto: null,
        manualNutritionOverride: null,
      },
    };
  });

  return { errors, foods, meals };
}

export default function FoodsPage() {
  const [loaded, setLoaded] = useState(false);
  const [foods, setFoods] = useState<FoodItem[]>([]);
  const [meals, setMeals] = useState<MealTemplate[]>([]);
  const [search, setSearch] = useState("");
  const [primaryFilter, setPrimaryFilter] = useState<PrimaryFilter>("all");
  const [beverageFilter, setBeverageFilter] = useState<BeverageFilter>("all-drinks");
  const [secondaryFilter, setSecondaryFilter] = useState<SecondaryFilter>("all");
  const [showSecondaryFilters, setShowSecondaryFilters] = useState(false);
  const [foodLibraryLayout, setFoodLibraryLayout] =
    useState<FoodLibraryLayout>(DEFAULT_FOOD_LIBRARY_LAYOUT);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>(
    {},
  );
  const [toolPanel, setToolPanel] = useState<
    | null
    | "ai-import"
    | "plate"
    | "estimate"
    | "snack"
    | "new"
    | "drink"
    | "packs"
    | "food-pack-export"
    | "food-pack-import"
    | "duplicates"
    | "hidden"
    | "library-management"
  >(null);
  const [corePreviewOpen, setCorePreviewOpen] = useState(false);
  const [starterPackInstalled, setStarterPackInstalled] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [selectedEditorEntity, setSelectedEditorEntity] =
    useState<EditorEntitySelection>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<FoodDialogMode>("details");
  const [foodEditorDirty, setFoodEditorDirty] = useState(false);
  const [mealEditorDirty, setMealEditorDirty] = useState(false);
  const [aiItems, setAiItems] = useState<FoodItem[]>([]);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiPaste, setAiPaste] = useState("");
  const [aiError, setAiError] = useState("");
  const [aiUpdates, setAiUpdates] = useState<ValidatedFoodAiUpdate[]>([]);
  const [aiReferencePhotoIds, setAiReferencePhotoIds] = useState<string[]>([]);
  const [clipboardMessage, setClipboardMessage] = useState("");
  const [addingFood, setAddingFood] = useState<FoodItem | null>(null);
  const [addingDrink, setAddingDrink] = useState<FoodItem | null>(null);
  const addingFoodMode: "servings" | "grams" = "servings";
  const [addingMeal, setAddingMeal] = useState<MealTemplate | null>(null);
  const [quickLogEditorReturn, setQuickLogEditorReturn] =
    useState<EditorEntitySelection>(null);
  const [showNewFood, setShowNewFood] = useState(false);
  const [showNewDrink, setShowNewDrink] = useState(false);
  const [showPlateBuilder, setShowPlateBuilder] = useState(false);
  const [showQuickEstimate, setShowQuickEstimate] = useState(false);
  const [showQuickSnack, setShowQuickSnack] = useState(false);
  const [quickCreateModal, setQuickCreateModal] =
    useState<QuickCreateModalState | null>(null);
  const [aiImportPaste, setAiImportPaste] = useState("");
  const [aiImportMessage, setAiImportMessage] = useState("");
  const [aiImportError, setAiImportError] = useState("");
  const [aiImportPreview, setAiImportPreview] = useState<LibraryImportPreview | null>(null);
  const [lastAddedEntry, setLastAddedEntry] = useState<FoodLogEntry | null>(null);
  const [lastAddedDrink, setLastAddedDrink] = useState<HydrationEntry | null>(null);
  const [lastHiddenEntityKey, setLastHiddenEntityKey] = useState<string | null>(null);
  const [lastCreatedEntity, setLastCreatedEntity] = useState<
    null | { key: string; type: "food" | "meal" }
  >(null);
  const [highlightedEntityKey, setHighlightedEntityKey] = useState<string | null>(null);
  const [groupAddContext, setGroupAddContext] = useState<GroupAddContext | null>(
    null,
  );
  const [hiddenEntityKeys, setHiddenEntityKeys] = useState<string[]>([]);
  const [addCardStates, setAddCardStates] = useState<Record<string, AddCardState>>(
    {},
  );
  const [addCardErrors, setAddCardErrors] = useState<Record<string, string>>({});
  const [packName, setPackName] = useState("My WellCanvas Food Pack");
  const [packCreator, setPackCreator] = useState("");
  const [selectedPackKeys, setSelectedPackKeys] = useState<string[]>([]);
  const [foodPackImportPreview, setFoodPackImportPreview] = useState<{
    duplicates: number;
    manifest: FoodPackManifest;
    payload: FoodPackPayload;
  } | null>(null);
  const foodPackImportPreviewRef = useRef<HTMLElement | null>(null);
  const foodPackImportActionRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    queueMicrotask(() => {
      syncInstalledSeedPack();
      setFoods(readFoodItems());
      setMeals(readMealTemplates());
      setHiddenEntityKeys(readLibraryVisibilityPreferences().hiddenEntityKeys);
      setFoodLibraryLayout(readFoodLibraryLayout());
      setStarterPackInstalled(isStarterFoodLibraryInstalled());
      setLoaded(true);
      if (window.location.search.includes("tool=drink")) {
        openPagePanel("drink");
      }
    });
  }, []);

  useEffect(() => {
    if (toolPanel !== "food-pack-import" || !foodPackImportPreview) return;
    const frame = window.requestAnimationFrame(() => {
      foodPackImportPreviewRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      foodPackImportActionRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [foodPackImportPreview, toolPanel]);

  useEffect(() => {
    if (loaded) {
      saveFoodItems(foods);
    }
  }, [foods, loaded]);

  useEffect(() => {
    if (loaded) {
      saveMealTemplates(meals);
    }
  }, [loaded, meals]);

  useEffect(() => {
    if (loaded) {
      saveFoodLibraryLayout(foodLibraryLayout);
    }
  }, [foodLibraryLayout, loaded]);

  const foodById = useMemo(
    () => new Map(foods.map((food) => [food.id, food])),
    [foods],
  );
  const selectedFood = useMemo(() => {
    if (!dialogOpen || !selectedEditorEntity || selectedEditorEntity.kind === "meal") {
      return null;
    }
    return foods.find((food) => food.id === selectedEditorEntity.id) ?? null;
  }, [dialogOpen, foods, selectedEditorEntity]);
  const selectedMeal = useMemo(() => {
    if (!dialogOpen || selectedEditorEntity?.kind !== "meal") return null;
    return meals.find((meal) => meal.id === selectedEditorEntity.id) ?? null;
  }, [dialogOpen, meals, selectedEditorEntity]);
  const editingFood = dialogMode === "edit" ? selectedFood : null;
  const editingMeal = dialogMode === "edit" ? selectedMeal : null;
  const query = normalizeSearch(search);
  const hiddenEntityKeySet = useMemo(
    () => new Set(hiddenEntityKeys),
    [hiddenEntityKeys],
  );
  const libraryEntries = useMemo<LibraryEntry[]>(() => {
    const mealEntries: LibraryEntry[] = meals.map((meal) => {
      const nutrition = calculateMealNutrition(meal, foods);
      const groupName = groupForMeal(meal);
      const isHidden = hiddenEntityKeySet.has(`meal:${meal.id}`);
      return {
        id: `meal:${meal.id}`,
        entryType: "meal",
        item: meal,
        name: meal.name,
        groupName,
        searchText: [
          meal.name,
          meal.description,
          meal.locationName,
          meal.collectionName,
          groupName,
          ...(meal.metadataEntries ?? []).flatMap((entry) => [
            entry.label,
            entry.value,
          ]),
          "meal",
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase(),
        isComplete: nutrition.isComplete,
        nutritionStatus: nutrition.status,
        isIngredient: false,
        needsReview: Boolean(meal.needsNutritionReview),
        isHidden,
      };
    });

    const foodEntries: LibraryEntry[] = foods.map((food) => {
      const groupName = groupForFood(food);
      const category = categoryForFood(food);
      const isHidden = hiddenEntityKeySet.has(`food:${food.id}`);
      return {
        id: `food:${food.id}`,
        entryType: "food",
        item: food,
        name: food.name,
        groupName,
        searchText: [
          food.name,
          food.description,
          food.brand,
          food.locationName,
          food.collectionName,
          groupName,
          category,
          food.logDestination,
          food.beverageType,
          food.servingLabel,
          ...(food.metadataEntries ?? []).flatMap((entry) => [
            entry.label,
            entry.value,
          ]),
          "food",
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase(),
        isComplete: isCompleteNutrition(food.nutrition),
        nutritionStatus: food.nutritionStatus,
        isIngredient: isIngredientFood(food),
        needsReview: Boolean(food.needsNutritionReview),
        isHidden,
      };
    });

    return [...mealEntries, ...foodEntries]
      .filter((entry) => {
        const matchesQuery = entry.searchText.includes(query);
        const shouldHideIngredient =
          entry.entryType === "food" &&
          entry.isIngredient &&
          !query &&
          primaryFilter !== "ingredients";
        const shouldHideFromBrowsing = entry.isHidden && !query;

        return (
          matchesQuery &&
          !shouldHideIngredient &&
          !shouldHideFromBrowsing &&
          matchesPrimaryFilter(entry, primaryFilter) &&
          (primaryFilter !== "beverages" ||
            matchesBeverageFilter(entry, beverageFilter)) &&
          matchesSecondaryFilter(entry, secondaryFilter)
        );
      })
      .sort((a, b) => {
        const rank = librarySearchRank(a, query) - librarySearchRank(b, query);
        return rank === 0 ? a.name.localeCompare(b.name) : rank;
      });
  }, [beverageFilter, foods, hiddenEntityKeySet, meals, primaryFilter, query, secondaryFilter]);
  const groupedLibraryEntries = useMemo(
    () => groupEntries(libraryEntries, (entry) => entry.groupName),
    [libraryEntries],
  );
  const selectedEmptyCategory = useMemo(() => {
    if (query || secondaryFilter !== "all") return null;
    if (primaryFilter === "beverages") {
      return beverageEmptyCategories[beverageFilter] ?? null;
    }
    return primaryEmptyCategories[primaryFilter] ?? null;
  }, [beverageFilter, primaryFilter, query, secondaryFilter]);
  const catalogueGroups = useMemo(() => {
    if (groupedLibraryEntries.length > 0) return groupedLibraryEntries;
    if (!selectedEmptyCategory) return [];
    return [
      {
        collectionName: selectedEmptyCategory.groupName,
        entries: [] as LibraryEntry[],
      },
    ];
  }, [groupedLibraryEntries, selectedEmptyCategory]);
  const emptyCategoryMessages = useMemo(() => {
    if (!selectedEmptyCategory) return {};
    return {
      [selectedEmptyCategory.groupName]: {
        body: selectedEmptyCategory.body,
        title: selectedEmptyCategory.title,
      },
    };
  }, [selectedEmptyCategory]);
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
  const incompleteFoods = foods.filter(
    (food) =>
      food.nutritionStatus !== "official" &&
      food.nutritionStatus !== "user-confirmed" &&
      !isCompleteNutrition(food.nutrition),
  );

  function refreshData() {
    setFoods(readFoodItems());
    setMeals(readMealTemplates());
    setHiddenEntityKeys(readLibraryVisibilityPreferences().hiddenEntityKeys);
    setStarterPackInstalled(isStarterFoodLibraryInstalled());
  }

  function importStarterPack() {
    const result = importStarterFoodLibrarySeedPack();
    refreshData();
    setLastAddedEntry(null);
    setConfirmation(
      result.addedFoodCount + result.addedMealCount === 0
        ? "Starter foods installed."
        : `Starter foods installed: ${result.addedFoodCount} foods added.`,
    );
  }

  function saveHiddenKeys(nextKeys: string[]) {
    const uniqueKeys = [...new Set(nextKeys)];
    setHiddenEntityKeys(uniqueKeys);
    saveLibraryVisibilityPreferences({
      hiddenEntityKeys: uniqueKeys,
      updatedAt: new Date().toISOString(),
    });
  }

  function hideEntity(entityKey: string) {
    saveHiddenKeys([...hiddenEntityKeys, entityKey]);
    setLastAddedEntry(null);
    setLastAddedDrink(null);
    setLastHiddenEntityKey(entityKey);
    setConfirmation("Item hidden from browsing.");
  }

  function unhideEntity(entityKey: string) {
    saveHiddenKeys(hiddenEntityKeys.filter((key) => key !== entityKey));
    if (lastHiddenEntityKey === entityKey) setLastHiddenEntityKey(null);
    setConfirmation("Item restored to browsing.");
  }

  function undoHiddenEntity() {
    if (!lastHiddenEntityKey) return;
    unhideEntity(lastHiddenEntityKey);
  }

  function scrollToLibraryEntry(entityKey: string) {
    setHighlightedEntityKey(entityKey);
    window.setTimeout(() => {
      document
        .querySelector(`[data-library-entry-key="${entityKey}"]`)
        ?.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 50);
    window.setTimeout(() => {
      setHighlightedEntityKey((current) => (current === entityKey ? null : current));
    }, 1800);
  }

  function undoCreatedEntity() {
    if (!lastCreatedEntity) return;
    if (lastCreatedEntity.type === "food") {
      setFoods((current) =>
        current.filter((food) => `food:${food.id}` !== lastCreatedEntity.key),
      );
    } else {
      setMeals((current) =>
        current.filter((meal) => `meal:${meal.id}` !== lastCreatedEntity.key),
      );
    }
    setHighlightedEntityKey(null);
    setConfirmation("Library item removed.");
    setLastCreatedEntity(null);
  }

  function openPagePanel(panel: "plate" | "estimate" | "snack" | "new" | "drink") {
    setToolPanel(panel);
    setShowPlateBuilder(panel === "plate");
    setShowQuickEstimate(panel === "estimate");
    setShowQuickSnack(panel === "snack");
    setShowNewFood(panel === "new");
    setShowNewDrink(panel === "drink");
  }

  function closeInlineCreateSurfaces() {
    setToolPanel(null);
    setShowPlateBuilder(false);
    setShowQuickEstimate(false);
    setShowQuickSnack(false);
    setShowNewFood(false);
    setShowNewDrink(false);
    setGroupAddContext(null);
  }

  function selectedFoodCreateDestination() {
    const emptyCategory =
      !query && secondaryFilter === "all" ? primaryEmptyCategories[primaryFilter] : null;
    return emptyCategory
      ? groupDestination(emptyCategory.groupName)
      : { category: "other" as FoodCategory, collectionName: null, locationName: null };
  }

  function openManualFoodCreate() {
    const destination = selectedFoodCreateDestination();
    closeInlineCreateSurfaces();
    setQuickCreateModal({
      kind: "food",
      initialCategory: destination.category,
      initialCollectionName: destination.collectionName ?? "",
      initialLocationName: destination.locationName ?? "",
    });
  }

  function openManualDrinkCreate() {
    const emptyCategory =
      primaryFilter === "beverages" && !query && secondaryFilter === "all"
        ? beverageEmptyCategories[beverageFilter]
        : null;
    const destination = emptyCategory
      ? groupDestination(emptyCategory.groupName)
      : { collectionName: "Drinks", locationName: null };
    closeInlineCreateSurfaces();
    setQuickCreateModal({
      kind: "drink",
      initialBeverageType: emptyCategory
        ? beverageTypeForGroup(emptyCategory.groupName)
        : "other",
      initialCollectionName: destination.collectionName ?? "Drinks",
      initialLocationName: destination.locationName ?? "",
    });
  }

  function openFoodDetails(food: FoodItem) {
    setSelectedEditorEntity({
      kind: isReusableDrink(food) ? "drink" : "food",
      id: food.id,
    });
    setDialogMode("details");
    setDialogOpen(true);
    setFoodEditorDirty(false);
    setMealEditorDirty(false);
  }

  function openFoodEditorFromQuickLog(food: FoodItem) {
    const kind = isReusableDrink(food) ? "drink" : "food";
    setQuickLogEditorReturn({ kind, id: food.id });
    setSelectedEditorEntity({ kind, id: food.id });
    setDialogMode("edit");
    setDialogOpen(true);
    setFoodEditorDirty(false);
    setMealEditorDirty(false);
  }

  function openMealDetails(meal: MealTemplate) {
    setSelectedEditorEntity({ kind: "meal", id: meal.id });
    setDialogMode("details");
    setDialogOpen(true);
    setFoodEditorDirty(false);
    setMealEditorDirty(false);
  }

  function openMealEditorFromQuickLog(meal: MealTemplate) {
    setQuickLogEditorReturn({ kind: "meal", id: meal.id });
    setSelectedEditorEntity({ kind: "meal", id: meal.id });
    setDialogMode("edit");
    setDialogOpen(true);
    setFoodEditorDirty(false);
    setMealEditorDirty(false);
  }

  function closeDialog() {
    if (
      dialogMode === "edit" &&
      ((editingFood && foodEditorDirty) || (editingMeal && mealEditorDirty)) &&
      !window.confirm("Discard unsaved changes?")
    ) {
      return;
    }
    setDialogOpen(false);
    setSelectedEditorEntity(null);
    setDialogMode("details");
    setFoodEditorDirty(false);
    setMealEditorDirty(false);
    setQuickLogEditorReturn(null);
  }

  function cancelEditorToDetails() {
    if (
      ((editingFood && foodEditorDirty) || (editingMeal && mealEditorDirty)) &&
      !window.confirm("Discard unsaved changes?")
    ) {
      return;
    }
    setDialogMode("details");
    setFoodEditorDirty(false);
    setMealEditorDirty(false);
  }

  function duplicateAndEditFood(food: FoodItem) {
    const copy = duplicateFoodItem(food, foods);
    setFoods((current) => [...current, copy]);
    setSelectedEditorEntity({
      kind: isReusableDrink(copy) ? "drink" : "food",
      id: copy.id,
    });
    setDialogMode("edit");
    setDialogOpen(true);
    setLastAddedEntry(null);
    setConfirmation("Food duplicated. Edit the copy below.");
  }

  function duplicateAndEditMeal(meal: MealTemplate) {
    const copy = duplicateMealTemplate(meal, meals);
    setMeals((current) => [...current, copy]);
    setSelectedEditorEntity({ kind: "meal", id: copy.id });
    setDialogMode("edit");
    setDialogOpen(true);
    setLastAddedEntry(null);
    setConfirmation("Meal duplicated. Edit the copy below.");
  }

  function saveFood(food: FoodItem) {
    const nextFood = { ...food, updatedAt: new Date().toISOString() };
    setFoods((current) =>
      current.map((item) => (item.id === food.id ? nextFood : item)),
    );
    setAddingFood((current) => (current?.id === food.id ? nextFood : current));
    setAddingDrink((current) => (current?.id === food.id ? nextFood : current));
    if (quickLogEditorReturn?.id === food.id) {
      setDialogOpen(false);
      setSelectedEditorEntity(null);
      setDialogMode("details");
      setFoodEditorDirty(false);
      setQuickLogEditorReturn(null);
    } else {
      setDialogMode("details");
    }
    setLastAddedEntry(null);
    setConfirmation(isReusableDrink(food) ? "Drink updated." : "Food updated.");
  }

  function saveFoodAsCopy(food: FoodItem) {
    const copy = duplicateFoodItem(
      { ...food, id: food.id, name: food.name },
      foods.filter((item) => item.id !== food.id),
    );
    const nextFood: FoodItem = {
      ...food,
      id: copy.id,
      name: foods.some((item) => item.name.trim().toLowerCase() === food.name.trim().toLowerCase())
        ? copy.name
        : food.name,
      clonedFromId: food.clonedFromId ?? food.id,
      isSeedItem: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setFoods((current) => [...current, nextFood]);
    closeDialog();
    setLastCreatedEntity({ key: `food:${nextFood.id}`, type: "food" });
    setConfirmation("Food copy saved.");
    window.setTimeout(() => scrollToLibraryEntry(`food:${nextFood.id}`), 50);
  }

  function saveMeal(meal: MealTemplate) {
    const nextMeal = { ...meal, updatedAt: new Date().toISOString() };
    setMeals((current) =>
      current.map((item) => (item.id === meal.id ? nextMeal : item)),
    );
    setAddingMeal((current) => (current?.id === meal.id ? nextMeal : current));
    if (quickLogEditorReturn?.id === meal.id) {
      setDialogOpen(false);
      setSelectedEditorEntity(null);
      setDialogMode("details");
      setMealEditorDirty(false);
      setQuickLogEditorReturn(null);
    } else {
      setDialogMode("details");
    }
    setLastAddedEntry(null);
    setConfirmation("Meal updated.");
  }

  function saveMealAsCopy(meal: MealTemplate) {
    const copy = duplicateMealTemplate(
      { ...meal, id: meal.id, name: meal.name },
      meals.filter((item) => item.id !== meal.id),
    );
    const nextMeal = {
      ...meal,
      id: copy.id,
      name: meals.some((item) => item.name.trim().toLowerCase() === meal.name.trim().toLowerCase())
        ? copy.name
        : meal.name,
      clonedFromId: meal.clonedFromId ?? meal.id,
      isSeedItem: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setMeals((current) => [...current, nextMeal]);
    closeDialog();
    setLastCreatedEntity({ key: `meal:${nextMeal.id}`, type: "meal" });
    setConfirmation("Meal copy saved.");
    window.setTimeout(() => scrollToLibraryEntry(`meal:${nextMeal.id}`), 50);
  }

  function saveFoodReview(food: FoodItem) {
    setFoods((current) =>
      current.map((item) =>
        item.id === food.id ? { ...food, updatedAt: new Date().toISOString() } : item,
      ),
    );
    setLastAddedEntry(null);
    setConfirmation(
      food.needsNutritionReview ? "Marked for later review." : "Nutrition correction saved.",
    );
  }

  function saveMealReview(meal: MealTemplate) {
    setMeals((current) =>
      current.map((item) =>
        item.id === meal.id ? { ...meal, updatedAt: new Date().toISOString() } : item,
      ),
    );
    setLastAddedEntry(null);
    setConfirmation("Marked for later review.");
  }

  function updateFoodRating(food: FoodItem, rating: PersonalFoodRating | null) {
    const nextFood = {
      ...food,
      userRating: rating,
      updatedAt: new Date().toISOString(),
    };
    setFoods((current) => current.map((item) => (item.id === food.id ? nextFood : item)));
    setConfirmation(rating ? "Rating saved." : "Rating cleared.");
  }

  function updateMealRating(meal: MealTemplate, rating: PersonalFoodRating | null) {
    const nextMeal = {
      ...meal,
      userRating: rating,
      updatedAt: new Date().toISOString(),
    };
    setMeals((current) => current.map((item) => (item.id === meal.id ? nextMeal : item)));
    setConfirmation(rating ? "Rating saved." : "Rating cleared.");
  }

  function openFoodPackExport() {
    setSelectedPackKeys(
      libraryEntries
        .filter((entry) => !entry.isHidden)
        .map((entry) => entry.id),
    );
    setToolPanel("food-pack-export");
  }

  function packPayloadForSelection() {
    const selected = new Set(selectedPackKeys);
    const dependencyFoodIds = new Set<string>();
    const selectedMeals = meals.filter((meal) => selected.has(`meal:${meal.id}`));
    selectedMeals.forEach((meal) => {
      meal.items.forEach((item) => dependencyFoodIds.add(item.foodItemId));
    });
    const selectedFoods = foods.filter(
      (food) => selected.has(`food:${food.id}`) || dependencyFoodIds.has(food.id),
    );
    return {
      foods: selectedFoods.map((food) => ({
        ...food,
        creatorRating: food.userRating ?? food.creatorRating ?? null,
        userRating: null,
        importedFromPack: null,
      })),
      meals: selectedMeals.map((meal) => ({
        ...meal,
        creatorRating: meal.userRating ?? meal.creatorRating ?? null,
        userRating: null,
        importedFromPack: null,
      })),
    } satisfies FoodPackPayload;
  }

  function exportFoodPack() {
    const payload = packPayloadForSelection();
    const itemCount = payload.foods.length + payload.meals.length;
    const manifest: FoodPackManifest = {
      format: "wellcanvas-food-pack",
      schemaVersion: 1,
      name: packName.trim() || "WellCanvas Food Pack",
      region: "",
      creator: { displayName: packCreator.trim() || undefined },
      exportedAt: new Date().toISOString(),
      itemCount,
    };
    const slug = manifest.name
      .trim()
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 50) || "Food-Pack";
    const zip = createZip([
      jsonZipFile("manifest.json", manifest),
      jsonZipFile("food-pack.json", payload),
    ]);
    downloadBlob(zip, `WellCanvas-${slug}-${dateStamp()}.zip`);
    setConfirmation(`Food pack ready: ${itemCount} reusable items.`);
  }

  async function previewFoodPackImport(file: File | null) {
    if (!file) return;
    try {
      const zip = await readZip(file);
      const manifest = decodeZipJson<FoodPackManifest>(zip, "manifest.json");
      const payload = decodeZipJson<FoodPackPayload>(zip, "food-pack.json");
      if (manifest.format !== "wellcanvas-food-pack" || manifest.schemaVersion !== 1) {
        throw new Error("Unsupported food-pack format.");
      }
      const localFoodIds = new Set(foods.map((food) => food.id));
      const localMealIds = new Set(meals.map((meal) => meal.id));
      const localFoodNames = new Set(foods.map((food) => normalizeLibraryName(food.name)));
      const localMealNames = new Set(meals.map((meal) => normalizeLibraryName(meal.name)));
      const duplicateFoods = (payload.foods ?? []).filter(
        (food) => localFoodIds.has(food.id) || localFoodNames.has(normalizeLibraryName(food.name)),
      ).length;
      const duplicateMeals = (payload.meals ?? []).filter(
        (meal) => localMealIds.has(meal.id) || localMealNames.has(normalizeLibraryName(meal.name)),
      ).length;
      setFoodPackImportPreview({
        duplicates: duplicateFoods + duplicateMeals,
        manifest,
        payload: {
          foods: Array.isArray(payload.foods) ? payload.foods : [],
          meals: Array.isArray(payload.meals) ? payload.meals : [],
        },
      });
      setToolPanel("food-pack-import");
    } catch (error) {
      setConfirmation(error instanceof Error ? error.message : "Food pack could not be read.");
    }
  }

  function importFoodPack() {
    if (!foodPackImportPreview) return;
    const packNameForProvenance = foodPackImportPreview.manifest.name;
    const localFoodIds = new Set(foods.map((food) => food.id));
    const localMealIds = new Set(meals.map((meal) => meal.id));
    const localFoodNames = new Set(foods.map((food) => normalizeLibraryName(food.name)));
    const localMealNames = new Set(meals.map((meal) => normalizeLibraryName(meal.name)));
    const importedFoods = foodPackImportPreview.payload.foods
      .filter(
        (food) =>
          !localFoodIds.has(food.id) && !localFoodNames.has(normalizeLibraryName(food.name)),
      )
      .map((food) => ({
        ...food,
        creatorRating: food.creatorRating ?? food.userRating ?? null,
        userRating: null,
        importedFromPack: packNameForProvenance,
        isSeedItem: false,
        updatedAt: new Date().toISOString(),
      }));
    const importedMeals = foodPackImportPreview.payload.meals
      .filter(
        (meal) =>
          !localMealIds.has(meal.id) && !localMealNames.has(normalizeLibraryName(meal.name)),
      )
      .map((meal) => ({
        ...meal,
        creatorRating: meal.creatorRating ?? meal.userRating ?? null,
        userRating: null,
        importedFromPack: packNameForProvenance,
        isSeedItem: false,
        updatedAt: new Date().toISOString(),
      }));
    setFoods((current) => [...current, ...importedFoods]);
    setMeals((current) => [...current, ...importedMeals]);
    setFoodPackImportPreview(null);
    setToolPanel(null);
    setConfirmation(
      `Food pack imported: ${importedFoods.length + importedMeals.length} new items. Duplicates kept local.`,
    );
  }

  async function openAiPanel(
    items: FoodItem[],
    context: string,
    referencePhotoIds: string[] = [],
  ) {
    const prompt = buildFoodAiPrompt(
      items,
      context,
      referencePhotoIds.length > 0 || items.some((item) => item.referencePhoto),
    );
    setAiItems(items);
    setAiPrompt(prompt);
    setAiReferencePhotoIds(referencePhotoIds);
    setAiPaste("");
    setAiError("");
    setAiUpdates([]);
    setClipboardMessage("");

    try {
      await navigator.clipboard?.writeText(prompt);
      setClipboardMessage("Prompt copied.");
    } catch {
      setClipboardMessage("Copy unavailable. Select and copy the prompt below.");
    }
  }

  function validateAiPaste() {
    const result = validateFoodAiResult(aiPaste, foods);
    setAiError(result.error ?? "");
    setAiUpdates(result.updates);
  }

  async function applyAiUpdates() {
    const approved = aiUpdates.filter((update) => update.approved);
    const reviewedPhotoIds = [
      ...aiReferencePhotoIds,
      ...approved
        .map((update) => update.current.referencePhoto?.id)
        .filter((id): id is string => Boolean(id)),
    ];
    setFoods((current) => applyFoodAiUpdates(current, approved));
    await Promise.all(reviewedPhotoIds.map(markReferencePhotoReviewed));
    setAiItems([]);
    setAiPrompt("");
    setAiPaste("");
    setAiUpdates([]);
    setAiReferencePhotoIds([]);
    setAiError("");
    setLastAddedEntry(null);
    setConfirmation("Approved food updates saved.");
  }

  function markCardAdded(cardId: string) {
    setAddCardStates((current) => ({ ...current, [cardId]: "added" }));
    window.setTimeout(() => {
      setAddCardStates((current) => {
        const next = { ...current };
        delete next[cardId];
        return next;
      });
    }, 1200);
  }

  function markCardIdle(cardId: string) {
    setAddCardStates((current) => {
      const next = { ...current };
      delete next[cardId];
      return next;
    });
  }

  function persistAndConfirmEntry(entry: FoodLogEntry, cardId?: string) {
    addFoodLogEntry(entry);
    const persisted = readFoodLogEntries().some((current) => current.id === entry.id);
    if (!persisted) {
      throw new Error("Food log entry was not persisted.");
    }

    setLastAddedEntry(entry);
    setLastAddedDrink(null);
    setLastHiddenEntityKey(null);
    setLastCreatedEntity(null);
    setConfirmation(
      entry.nutritionStatus === "missing"
        ? "Added, but nutrition is incomplete"
        : `Added to ${mealTypeLabel(entry.mealType)}`,
    );
    if (cardId) {
      markCardAdded(cardId);
    }
  }

  function hydrationBeverageTypeForFood(food: FoodItem): BeverageType {
    const beverageType = beverageTypeForFood(food);
    if (
      beverageType === "tap-water" ||
      beverageType === "still-water" ||
      beverageType === "sparkling-water" ||
      beverageType === "sweet-soda" ||
      beverageType === "zero-soda"
    ) {
      return beverageType;
    }
    return "other";
  }

  function scaledDrinkNutrition(food: FoodItem, volumeMl: number) {
    const referenceVolume = food.servingVolumeMl && food.servingVolumeMl > 0
      ? food.servingVolumeMl
      : volumeMl;
    const factor = volumeMl / referenceVolume;
    return {
      caloriesKcal:
        food.nutrition?.caloriesKcal === null ||
        food.nutrition?.caloriesKcal === undefined
          ? null
          : Math.round(food.nutrition.caloriesKcal * factor * 10) / 10,
      carbohydratesG:
        food.nutrition?.carbohydratesG === null ||
        food.nutrition?.carbohydratesG === undefined
          ? null
          : Math.round(food.nutrition.carbohydratesG * factor * 10) / 10,
      sodiumMg:
        food.nutrition?.sodiumMg === null || food.nutrition?.sodiumMg === undefined
          ? null
          : Math.round(food.nutrition.sodiumMg * factor),
    };
  }

  function createHydrationEntryFromDrinkFood(food: FoodItem, options?: {
    caloriesKcal?: number | null;
    carbohydratesG?: number | null;
    date?: string;
    notes?: string;
    sodiumMg?: number | null;
    time?: string;
    volumeMl?: number;
  }) {
    const now = new Date().toISOString();
    const volumeMl = options?.volumeMl ?? food.servingVolumeMl ?? 250;
    const nutrition = options &&
      ("caloriesKcal" in options || "carbohydratesG" in options || "sodiumMg" in options)
      ? {
          caloriesKcal: options.caloriesKcal ?? null,
          carbohydratesG: options.carbohydratesG ?? null,
          sodiumMg: options.sodiumMg ?? null,
        }
      : scaledDrinkNutrition(food, volumeMl);

    return {
      id: makeId("hydration"),
      date: options?.date ?? localDateKey(),
      time: options?.time ?? currentLocalTime(),
      beverageType: hydrationBeverageTypeForFood(food),
      displayName: food.name,
      volumeMl,
      caloriesKcal: nutrition.caloriesKcal,
      carbohydratesG: nutrition.carbohydratesG,
      sodiumMg: nutrition.sodiumMg,
      nutritionStatus: food.nutritionStatus,
      uncertaintyPercent: food.uncertaintyPercent,
      notes: options?.notes ?? food.description ?? "",
      createdAt: now,
      updatedAt: now,
    } satisfies HydrationEntry;
  }

  function persistAndConfirmDrink(entry: HydrationEntry, cardId?: string) {
    addHydrationEntry(entry);
    const persisted = readHydrationEntries().some((current) => current.id === entry.id);
    if (!persisted) {
      throw new Error("Hydration entry was not persisted.");
    }

    setLastAddedEntry(null);
    setLastHiddenEntityKey(null);
    setLastAddedDrink(entry);
    setLastCreatedEntity(null);
    setConfirmation(`${Math.round(entry.volumeMl)} ml ${entry.displayName} added`);
    if (cardId) {
      markCardAdded(cardId);
    }
  }

  function addMealToToday(meal: MealTemplate) {
    const cardId = `meal:${meal.id}`;
    if (addCardStates[cardId] === "adding") return;

    setAddCardErrors((current) => ({ ...current, [cardId]: "" }));
    setAddCardStates((current) => ({ ...current, [cardId]: "adding" }));
    try {
      const entry = createLogEntryFromMeal({ foods, meal, quantity: 1 });
      persistAndConfirmEntry(entry, cardId);
    } catch {
      markCardIdle(cardId);
      setAddCardErrors((current) => ({
        ...current,
        [cardId]: "Could not add this meal. Try again.",
      }));
    }
  }

  function addFoodToToday(food: FoodItem) {
    const cardId = `food:${food.id}`;
    if (addCardStates[cardId] === "adding") return;

    setAddCardErrors((current) => ({ ...current, [cardId]: "" }));
    setAddCardStates((current) => ({ ...current, [cardId]: "adding" }));
    try {
      if (isReusableDrink(food)) {
        persistAndConfirmDrink(createHydrationEntryFromDrinkFood(food), cardId);
        return;
      }
      const entry = createLogEntryFromFood({
        food,
        mealType: inferMealType(),
        quantity: 1,
      });
      persistAndConfirmEntry(entry, cardId);
    } catch {
      markCardIdle(cardId);
      setAddCardErrors((current) => ({
        ...current,
        [cardId]: isReusableDrink(food)
          ? "Could not add this drink. Try again."
          : "Could not add this food. Try again.",
      }));
    }
  }

  function addFoodToLog(food: FoodItem, options: {
    date: string;
    mealType: FoodLogEntry["mealType"];
    quantity: number;
    time: string;
  }) {
    const entry = createLogEntryFromFood({ food, ...options });
    persistAndConfirmEntry(entry);
    setAddingFood(null);
  }

  function addDrinkToLog(entry: HydrationEntry) {
    persistAndConfirmDrink(entry);
    setAddingDrink(null);
  }

  function addMealToLog(meal: MealTemplate, options: {
    date: string;
    mealType: FoodLogEntry["mealType"];
    quantity: number;
    time: string;
  }) {
    const entry = createLogEntryFromMeal({
      date: options.date,
      foods,
      meal: { ...meal, mealType: options.mealType },
      quantity: options.quantity,
      time: options.time,
    });
    persistAndConfirmEntry(entry);
    setAddingMeal(null);
  }

  function addEntryFromComposer(entry: FoodLogEntry) {
    persistAndConfirmEntry(entry);
    setShowPlateBuilder(false);
    setShowQuickEstimate(false);
    setShowQuickSnack(false);
  }

  function saveMealFromComposer(meal: MealTemplate) {
    setMeals((current) => [...current, meal]);
    setLastAddedEntry(null);
    setConfirmation("Meal saved.");
  }

  function saveFoodFromComposer(food: FoodItem) {
    setFoods((current) => [...current, food]);
    setLastAddedEntry(null);
    setConfirmation("Food saved to your library.");
  }

  function undoLastAdd() {
    if (!lastAddedEntry) return;

    deleteFoodLogEntry(lastAddedEntry.id);
    setConfirmation("Entry removed.");
    setLastAddedEntry(null);
  }

  function undoLastDrink() {
    if (!lastAddedDrink) return;
    deleteHydrationEntry(lastAddedDrink.id);
    setConfirmation("Drink removed.");
    setLastAddedDrink(null);
  }

  function saveNewFood(food: FoodItem) {
    setFoods((current) => [...current, food]);
    setLastAddedEntry(null);
    setLastAddedDrink(null);
    setLastHiddenEntityKey(null);
    setLastCreatedEntity({ key: `food:${food.id}`, type: "food" });
    setConfirmation("Food saved to your library.");
    setShowNewFood(false);
  }

  function saveNewDrink(food: FoodItem) {
    setFoods((current) => [...current, food]);
    setLastAddedEntry(null);
    setLastAddedDrink(null);
    setLastHiddenEntityKey(null);
    setLastCreatedEntity({ key: `food:${food.id}`, type: "food" });
    setConfirmation("Drink saved to your library.");
    setShowNewFood(false);
    setShowNewDrink(false);
  }

  function saveNewMeal(meal: MealTemplate) {
    setMeals((current) => [...current, meal]);
    setLastAddedEntry(null);
    setLastAddedDrink(null);
    setLastHiddenEntityKey(null);
    setLastCreatedEntity({ key: `meal:${meal.id}`, type: "meal" });
    setConfirmation("Meal saved to your library.");
    setShowNewFood(false);
  }

  function saveAndAddNewMeal(meal: MealTemplate) {
    setMeals((current) => [...current, meal]);
    const entry = createLogEntryFromMeal({ foods, meal, quantity: 1 });
    persistAndConfirmEntry(entry);
    setLastCreatedEntity(null);
    setConfirmation(
      `Meal saved to your library. Added to ${mealTypeLabel(entry.mealType)}${
        !calculateMealNutrition(meal, foods).isComplete
          ? ". Nutrition is incomplete. You can refine this later."
          : ""
      }`,
    );
    setShowNewFood(false);
  }

  function saveAndAddNewDrink(food: FoodItem) {
    setFoods((current) => [...current, food]);
    const entry = createHydrationEntryFromDrinkFood(food);
    persistAndConfirmDrink(entry);
    setLastCreatedEntity(null);
    setConfirmation("Drink saved to your library and added today.");
    setShowNewFood(false);
    setShowNewDrink(false);
  }

  function saveAndAddNewFood(food: FoodItem, saveToLibrary: boolean) {
    if (saveToLibrary) {
      setFoods((current) => [...current, food]);
    }

    const entry = createLogEntryFromFood({
      food,
      mealType: inferMealType(),
      sourceType: saveToLibrary ? "food" : "custom-one-off",
    });
    persistAndConfirmEntry(entry);
    setLastCreatedEntity(null);
    setConfirmation(
      saveToLibrary
        ? `Food saved to your library. Added to ${mealTypeLabel(entry.mealType)}${
            food.nutritionStatus === "missing"
              ? ". Nutrition is incomplete. You can refine this later."
              : ""
          }`
        : `Added to ${mealTypeLabel(entry.mealType)}${
            food.nutritionStatus === "missing"
              ? ". Nutrition is incomplete. You can refine this later."
              : ""
          }`,
    );
    setShowNewFood(false);
  }

  function saveContextualFood(food: FoodItem) {
    const key = `food:${food.id}`;
    setFoods((current) => [...current, food]);
    setGroupAddContext(null);
    setCollapsedGroups((current) => ({
      ...current,
      [groupForFood(food)]: false,
    }));
    setLastAddedEntry(null);
    setLastAddedDrink(null);
    setLastHiddenEntityKey(null);
    setLastCreatedEntity({ key, type: "food" });
    setConfirmation(`Added to ${groupForFood(food)}`);
    scrollToLibraryEntry(key);
  }

  function saveAndLogContextualFood(food: FoodItem) {
    setFoods((current) => [...current, food]);
    if (isReusableDrink(food)) {
      const entry = createHydrationEntryFromDrinkFood(food);
      persistAndConfirmDrink(entry);
      setConfirmation(`Added to ${groupForFood(food)} and logged as a drink.`);
    } else {
      const entry = createLogEntryFromFood({ food, mealType: inferMealType() });
      persistAndConfirmEntry(entry);
      setConfirmation(
        `Added to ${groupForFood(food)} and ${mealTypeLabel(entry.mealType)}.`,
      );
    }
    setLastCreatedEntity(null);
    setGroupAddContext(null);
    setCollapsedGroups((current) => ({
      ...current,
      [groupForFood(food)]: false,
    }));
    scrollToLibraryEntry(`food:${food.id}`);
  }

  function saveContextualMeal(meal: MealTemplate) {
    const key = `meal:${meal.id}`;
    setMeals((current) => [...current, meal]);
    setGroupAddContext(null);
    setCollapsedGroups((current) => ({
      ...current,
      [groupForMeal(meal)]: false,
    }));
    setLastAddedEntry(null);
    setLastAddedDrink(null);
    setLastHiddenEntityKey(null);
    setLastCreatedEntity({ key, type: "meal" });
    setConfirmation(`Added to ${groupForMeal(meal)}`);
    scrollToLibraryEntry(key);
  }

  function saveAndLogContextualMeal(meal: MealTemplate) {
    setMeals((current) => [...current, meal]);
    const entry = createLogEntryFromMeal({ foods, meal, quantity: 1 });
    persistAndConfirmEntry(entry);
    setLastCreatedEntity(null);
    setGroupAddContext(null);
    setCollapsedGroups((current) => ({
      ...current,
      [groupForMeal(meal)]: false,
    }));
    setConfirmation(`Added to ${groupForMeal(meal)} and ${mealTypeLabel(entry.mealType)}.`);
    scrollToLibraryEntry(`meal:${meal.id}`);
  }

  function validateLibraryImportPaste() {
    const preview = validateLibraryImportResult(aiImportPaste, foods);
    setAiImportPreview(preview);
    setAiImportError(preview.errors.join(" ") || "");
    setAiImportMessage(
      preview.foods.length + preview.meals.length > 0
        ? "Import preview ready. Review the items below before importing."
        : "",
    );
  }

  function importLibraryPreview(preview: LibraryImportPreview) {
    const now = new Date().toISOString();
    const tempToFoodId = new Map<string, string>();
    const nextFoods = [...foods];
    const nextMeals = [...meals];

    for (const previewFood of preview.foods) {
      if (previewFood.errors.length > 0 || !previewFood.approved) continue;
      const existing = previewFood.existingMatch;

      if (existing && previewFood.duplicateAction === "keep") {
        tempToFoodId.set(previewFood.temporaryId, existing.id);
        continue;
      }

      if (
        existing &&
        previewFood.duplicateAction === "update" &&
        !existing.isSeedItem &&
        existing.nutritionStatus !== "official" &&
        existing.nutritionStatus !== "user-confirmed"
      ) {
        tempToFoodId.set(previewFood.temporaryId, existing.id);
        const updatedFood: FoodItem = {
          ...existing,
          ...previewFood.food,
          id: existing.id,
          countryCode: "SG",
          isSeedItem: false,
          clonedFromId: existing.clonedFromId,
          createdAt: existing.createdAt,
          updatedAt: now,
        };
        const index = nextFoods.findIndex((food) => food.id === existing.id);
        if (index >= 0) nextFoods[index] = updatedFood;
        continue;
      }

      const foodId = makeId("food");
      tempToFoodId.set(previewFood.temporaryId, foodId);
      nextFoods.push({
        ...previewFood.food,
        id: foodId,
        countryCode: "SG",
        isSeedItem: false,
        clonedFromId:
          existing && previewFood.duplicateAction === "duplicate" ? existing.id : null,
        createdAt: now,
        updatedAt: now,
      });
    }

    for (const previewMeal of preview.meals) {
      if (previewMeal.errors.length > 0 || !previewMeal.approved) continue;
      const items = previewMeal.meal.items
        .map((item) => {
          const foodItemId = tempToFoodId.get(item.temporaryFoodId);
          return foodItemId ? { foodItemId, quantity: item.quantity } : null;
        })
        .filter((item): item is MealTemplateItem => Boolean(item));
      if (items.length !== previewMeal.meal.items.length) continue;

      nextMeals.push({
        ...previewMeal.meal,
        id: makeId("meal"),
        items,
        isSeedItem: false,
        clonedFromId: null,
        createdAt: now,
        updatedAt: now,
      });
    }

    setFoods(nextFoods);
    setMeals(nextMeals);
    setAiImportPreview(null);
    setAiImportPaste("");
    setAiImportError("");
    setAiImportMessage("Approved library imports saved.");
    setConfirmation("Approved library imports saved.");
  }

  return (
    <div className="wc-page mx-auto flex w-full max-w-5xl flex-col">
      <PageHeader
        subtitle="Search meals, restaurant orders, fruit, snacks, and saved ingredients from one catalogue."
        title="Food library"
      />

      <div aria-live="polite" className="sr-only">
        {clipboardMessage || aiError || aiImportMessage || aiImportError}
      </div>
      <ToastBridge
        actionLabel={
          lastAddedEntry || lastAddedDrink || lastHiddenEntityKey || lastCreatedEntity
            ? "Undo"
            : undefined
        }
        message={confirmation}
        onAction={
          lastAddedEntry
            ? undoLastAdd
            : lastAddedDrink
              ? undoLastDrink
              : lastHiddenEntityKey
                ? undoHiddenEntity
                : lastCreatedEntity
                  ? undoCreatedEntity
                  : undefined
        }
        type={confirmation.toLowerCase().includes("could not") ? "error" : "success"}
      />

      <section className="wc-section wc-section-padded shadow-sm">
        <label className="text-sm font-medium text-stone-700" htmlFor="food-search">
          Search
        </label>
        <input
          className="mt-2 min-h-12 w-full rounded-md border border-stone-300 bg-white px-4 text-base outline-none focus:border-stone-900"
          id="food-search"
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search saved meals, foods, brands, or places"
          type="search"
          value={search}
        />
        <div className="mt-3 grid gap-2">
          <div className="grid gap-2">
            <div className="food-filter-heading">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                Food
              </p>
              <button
                aria-label="Add food"
                className="library-category-add-button"
                onClick={openManualFoodCreate}
                title="Add food"
                type="button"
              >
                <span aria-hidden="true">+</span>
                <span>Add</span>
              </button>
            </div>
            <div className="library-filter-row flex gap-2 overflow-x-auto pb-3">
              {primaryFilters.map((option) => (
                <button
                  className={`btn min-h-9 shrink-0 px-3 text-sm ${
                    primaryFilter === option.value
                      ? "btn-primary-accent"
                      : "btn-secondary-outline"
                  }`}
                  key={option.value}
                  onClick={() => setPrimaryFilter(option.value)}
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-2">
            <div className="food-filter-heading">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                Beverages
              </p>
              <button
                aria-label="Add drink"
                className="library-category-add-button"
                onClick={openManualDrinkCreate}
                title="Add drink"
                type="button"
              >
                <span aria-hidden="true">+</span>
                <span>Add</span>
              </button>
            </div>
            <div className="library-filter-row flex gap-2 overflow-x-auto pb-3">
              {beverageFilters.map((option) => (
                <button
                  className={`btn min-h-9 shrink-0 px-3 text-sm ${
                    primaryFilter === "beverages" && beverageFilter === option.value
                      ? "btn-primary-accent"
                      : "btn-secondary-outline"
                  }`}
                  key={option.value}
                  onClick={() => {
                    setPrimaryFilter("beverages");
                    setBeverageFilter(option.value);
                  }}
                  type="button"
                >
                  {option.label}
                </button>
              ))}
              <button
                className={`btn min-h-9 shrink-0 px-3 text-sm ${
                  showSecondaryFilters || secondaryFilter !== "all"
                    ? "btn-primary-accent"
                    : "btn-secondary-outline"
                }`}
                onClick={() => setShowSecondaryFilters((current) => !current)}
                type="button"
              >
                Filter
              </button>
            </div>
          </div>
        </div>
        {showSecondaryFilters && (
          <div className="library-filter-row mt-3 flex gap-2 overflow-x-auto rounded-md bg-stone-50 p-2">
            {secondaryFilters.map((option) => (
            <button
              className={`btn min-h-9 shrink-0 px-3 text-sm ${
                secondaryFilter === option.value
                  ? "btn-primary-accent"
                  : "btn-secondary-outline"
              }`}
              key={option.value}
              onClick={() => setSecondaryFilter(option.value)}
              type="button"
            >
              {option.label}
            </button>
            ))}
          </div>
        )}
        <fieldset className="food-layout-toggle mt-4 flex flex-wrap items-center gap-2">
          <legend className="mr-1 text-xs font-semibold uppercase tracking-wide text-stone-500">
            View
          </legend>
          {[
            { label: "1 column", value: "one-column" },
            { label: "2 columns", value: "two-column" },
          ].map((option) => (
            <label
              className={`flex min-h-9 items-center rounded-md border px-3 text-sm font-semibold ${
                foodLibraryLayout === option.value
                  ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                  : "border-stone-200 bg-white text-stone-700"
              }`}
              key={option.value}
            >
              <input
                checked={foodLibraryLayout === option.value}
                className="sr-only"
                name="food-library-layout"
                onChange={() =>
                  setFoodLibraryLayout(option.value as FoodLibraryLayout)
                }
                type="radio"
                value={option.value}
              />
              {option.label}
            </label>
          ))}
        </fieldset>
      </section>

      <section className="food-catalogue-plaque wc-section shadow-sm">
        {catalogueGroups.length === 0 ? (
          <p className="p-[var(--wc-section-padding)] text-sm text-stone-500">
            {query
              ? `No library items match "${search.trim()}".`
              : "No library items match this search and filter."}
          </p>
        ) : (
          <GroupedSections
            collapsedGroups={collapsedGroups}
            emptyMessages={emptyCategoryMessages}
            groups={catalogueGroups}
            highlightedEntityKey={highlightedEntityKey}
            onAddGroup={(collectionName, groupEntries) =>
              setGroupAddContext(createGroupAddContext(collectionName, groupEntries))
            }
            layout={foodLibraryLayout}
            renderEntry={(entry) =>
              entry.entryType === "meal" ? (
                <MealCard
                  addError={addCardErrors[`meal:${entry.item.id}`]}
                  addState={addCardStates[`meal:${entry.item.id}`] ?? "idle"}
                  foods={foods}
                  isHidden={entry.isHidden}
                  key={entry.id}
                  meal={entry.item}
                  onAdd={() => addMealToToday(entry.item)}
                  onDuplicate={() => duplicateAndEditMeal(entry.item)}
                  onHide={() => hideEntity(`meal:${entry.item.id}`)}
                  onMarkReview={() =>
                    saveMealReview({
                      ...entry.item,
                      needsNutritionReview: true,
                      reviewReason: "Other",
                      reviewNote: null,
                    })
                  }
                  onView={() => {
                    openMealDetails(entry.item);
                  }}
                  onUnhide={() => unhideEntity(`meal:${entry.item.id}`)}
                />
              ) : (
                <FoodCard
                  addError={addCardErrors[`food:${entry.item.id}`]}
                  addState={addCardStates[`food:${entry.item.id}`] ?? "idle"}
                  food={entry.item}
                  isHidden={entry.isHidden}
                  key={entry.id}
                  onAdd={() => addFoodToToday(entry.item)}
                  onDuplicate={() => duplicateAndEditFood(entry.item)}
                  onHide={() => hideEntity(`food:${entry.item.id}`)}
                  onMarkReview={() =>
                    saveFoodReview({
                      ...entry.item,
                      needsNutritionReview: true,
                      reviewReason: "Other",
                      reviewNote: null,
                    })
                  }
                  onRefine={() =>
                    openAiPanel([entry.item], `Single food item: ${entry.item.name}`)
                  }
                  onUnhide={() => unhideEntity(`food:${entry.item.id}`)}
                  onView={() => {
                    openFoodDetails(entry.item);
                  }}
                />
              )
            }
            setCollapsedGroups={setCollapsedGroups}
          />
        )}
      </section>

      {selectedMeal && (
        <DialogFrame
          headerAction={
            dialogMode === "details" ? (
              <button className={secondaryClasses("min-h-9")} onClick={() => setDialogMode("edit")} type="button">
                Edit
              </button>
            ) : undefined
          }
          onClose={closeDialog}
          size={dialogMode === "edit" ? "editor" : "normal"}
          title={dialogMode === "edit" ? `Edit ${selectedMeal.name}` : selectedMeal.name}
        >
          {dialogMode === "edit" ? (
            <MealEditor
              collectionSuggestions={collectionSuggestions}
              foodById={foodById}
              foods={foods}
              key={selectedMeal.id}
              meal={selectedMeal}
              onCancel={cancelEditorToDetails}
              onDirtyChange={setMealEditorDirty}
              onSave={saveMeal}
              onSaveCopy={saveMealAsCopy}
            />
          ) : (
            <MealDetails
              foodById={foodById}
              foods={foods}
              meal={selectedMeal}
              onEditMeal={() => setDialogMode("edit")}
              onRatingChange={(rating) => updateMealRating(selectedMeal, rating)}
              onPrepareAi={() =>
                openAiPanel(
                  selectedMeal.items
                    .map((item) => foodById.get(item.foodItemId))
                    .filter((item): item is FoodItem => Boolean(item)),
                  `Meal template: ${selectedMeal.name}${
                    selectedMeal.referencePhoto
                      ? ". A reference photo exists. Attach it manually when sending this prompt to ChatGPT."
                      : ""
                  }`,
                  selectedMeal.referencePhoto ? [selectedMeal.referencePhoto.id] : [],
                )
              }
              onSaveReview={saveMealReview}
            />
          )}
        </DialogFrame>
      )}

      {selectedFood && (
        <DialogFrame
          headerAction={
            dialogMode === "details" ? (
              <button className={secondaryClasses("min-h-9")} onClick={() => setDialogMode("edit")} type="button">
                Edit
              </button>
            ) : undefined
          }
          onClose={closeDialog}
          size={dialogMode === "edit" ? "editor" : "normal"}
          title={dialogMode === "edit" ? `Edit ${selectedFood.name}` : selectedFood.name}
        >
          {dialogMode === "edit" ? (
            <FoodEditor
              collectionSuggestions={collectionSuggestions}
              food={selectedFood}
              key={selectedFood.id}
              onCancel={cancelEditorToDetails}
              onDirtyChange={setFoodEditorDirty}
              onSave={saveFood}
              onSaveCopy={saveFoodAsCopy}
            />
          ) : (
            <FoodDetails
              food={selectedFood}
              onEditNutrition={() => setDialogMode("edit")}
              onRatingChange={(rating) => updateFoodRating(selectedFood, rating)}
              onPrepareAi={() =>
                openAiPanel([selectedFood], `Single food item: ${selectedFood.name}`)
              }
              onSaveReview={saveFoodReview}
            />
          )}
        </DialogFrame>
      )}

      {quickCreateModal && (
        <DialogFrame
          onClose={() => setQuickCreateModal(null)}
          size="editor"
          title={quickCreateModal.kind === "drink" ? "Add new drink" : "Add new food"}
        >
          {quickCreateModal.kind === "drink" ? (
            <NewFoodForm
              allowedTypes={["drink"]}
              collectionSuggestions={collectionSuggestions}
              foods={foods}
              initialBeverageType={quickCreateModal.initialBeverageType}
              initialCategory="drink"
              initialCollectionName={quickCreateModal.initialCollectionName}
              initialLocationName={quickCreateModal.initialLocationName}
              initialType="drink"
              onAddOnce={(food) => {
                saveAndAddNewFood(food, false);
                setQuickCreateModal(null);
              }}
              onCancel={() => setQuickCreateModal(null)}
              onSave={(food) => {
                saveNewFood(food);
                setQuickCreateModal(null);
              }}
              onSaveAndAdd={(food) => {
                saveAndAddNewFood(food, true);
                setQuickCreateModal(null);
              }}
              onSaveDrink={(food) => {
                saveNewDrink(food);
                setQuickCreateModal(null);
              }}
              onSaveDrinkAndAdd={(food) => {
                saveAndAddNewDrink(food);
                setQuickCreateModal(null);
              }}
              showHeading={false}
            />
          ) : (
            <NewFoodForm
              allowedTypes={["food"]}
              collectionSuggestions={collectionSuggestions}
              foods={foods}
              initialCategory={quickCreateModal.initialCategory}
              initialCollectionName={quickCreateModal.initialCollectionName}
              initialLocationName={quickCreateModal.initialLocationName}
              initialType="food"
              onAddOnce={(food) => {
                saveAndAddNewFood(food, false);
                setQuickCreateModal(null);
              }}
              onCancel={() => setQuickCreateModal(null)}
              onSave={(food) => {
                saveNewFood(food);
                setQuickCreateModal(null);
              }}
              onSaveAndAdd={(food) => {
                saveAndAddNewFood(food, true);
                setQuickCreateModal(null);
              }}
              showHeading={false}
            />
          )}
        </DialogFrame>
      )}

      <section className="wc-section wc-section-padded">
        <h2 className="text-lg font-semibold text-stone-950">Library tools</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
          <button className={primarySaveClasses()} onClick={() => setToolPanel("ai-import")} type="button">
            Add from AI
          </button>
          <button className={secondaryClasses()} onClick={() => openPagePanel("plate")} type="button">
            Build a plate
          </button>
          <button className={secondaryClasses()} onClick={() => openPagePanel("estimate")} type="button">
            Quick meal estimate
          </button>
          <button className={secondaryClasses()} onClick={openFoodPackExport} type="button">
            Export food pack
          </button>
          <label className={`${secondaryClasses()} cursor-pointer text-center`}>
            Import food pack
            <input
              accept=".zip,application/zip"
              className="sr-only"
              onChange={(event) => {
                void previewFoodPackImport(event.target.files?.[0] ?? null);
                event.currentTarget.value = "";
              }}
              type="file"
            />
          </label>
        </div>
        <p className="mt-3 text-xs text-stone-500">
          Food packs contain reusable food-library items only. Daily food history,
          profile data, measurements, hydration history, activity history and trackers
          are not included.
        </p>

        {toolPanel === "food-pack-export" && (
          <section className="mt-4 rounded-md border border-stone-200 bg-stone-50 p-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <TextInput label="Pack name" onChange={setPackName} value={packName} />
              <TextInput label="Creator, optional" onChange={setPackCreator} value={packCreator} />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                className="btn btn-secondary-outline"
                onClick={() =>
                  setSelectedPackKeys(
                    libraryEntries.filter((entry) => !entry.isHidden).map((entry) => entry.id),
                  )
                }
                type="button"
              >
                Select all
              </button>
              <button
                className="btn btn-tertiary-text"
                onClick={() => setSelectedPackKeys([])}
                type="button"
              >
                Select none
              </button>
            </div>
            <div className="mt-4 grid max-h-80 gap-3 overflow-y-auto rounded-md bg-white p-3">
              {groupedLibraryEntries.map((group) => {
                const groupKeys = group.entries.map((entry) => entry.id);
                const selectedCount = groupKeys.filter((key) =>
                  selectedPackKeys.includes(key),
                ).length;
                return (
                  <div className="rounded-md border border-stone-100 p-3" key={group.collectionName}>
                    <label className="flex items-center gap-2 text-sm font-semibold text-stone-950">
                      <input
                        checked={selectedCount === groupKeys.length && groupKeys.length > 0}
                        onChange={(event) => {
                          setSelectedPackKeys((current) => {
                            const next = new Set(current);
                            groupKeys.forEach((key) =>
                              event.target.checked ? next.add(key) : next.delete(key),
                            );
                            return [...next];
                          });
                        }}
                        type="checkbox"
                      />
                      {group.collectionName}
                      <span className="text-xs font-medium text-stone-500">
                        {selectedCount}/{groupKeys.length}
                      </span>
                    </label>
                    <div className="mt-2 grid gap-1">
                      {group.entries.map((entry) => (
                        <label className="flex items-center gap-2 text-sm text-stone-700" key={entry.id}>
                          <input
                            checked={selectedPackKeys.includes(entry.id)}
                            onChange={(event) =>
                              setSelectedPackKeys((current) =>
                                event.target.checked
                                  ? [...new Set([...current, entry.id])]
                                  : current.filter((key) => key !== entry.id),
                              )
                            }
                            type="checkbox"
                          />
                          <span className="min-w-0 truncate">{entry.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                className={primarySaveClasses()}
                disabled={selectedPackKeys.length === 0}
                onClick={exportFoodPack}
                type="button"
              >
                Export food pack
              </button>
              <button
                className="btn btn-tertiary-text"
                onClick={() => setToolPanel(null)}
                type="button"
              >
                Cancel
              </button>
            </div>
          </section>
        )}

        {toolPanel === "food-pack-import" && foodPackImportPreview && (
          <section
            className="mt-4 rounded-md border border-stone-200 bg-stone-50 p-3"
            ref={foodPackImportPreviewRef}
          >
            <h3 className="text-sm font-semibold text-stone-950">
              Import “{foodPackImportPreview.manifest.name}”
            </h3>
            <p className="mt-2 text-sm text-stone-600">
              {foodPackImportPreview.manifest.itemCount} reusable items
              {foodPackImportPreview.manifest.creator.displayName
                ? ` · Created by ${foodPackImportPreview.manifest.creator.displayName}`
                : ""}
            </p>
            <p className="mt-1 text-sm text-stone-600">
              Duplicates detected: {foodPackImportPreview.duplicates}. Merge keeps your
              local item when IDs or names match.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                className={primarySaveClasses()}
                onClick={importFoodPack}
                ref={foodPackImportActionRef}
                type="button"
              >
                Import
              </button>
              <button
                className="btn btn-tertiary-text"
                onClick={() => {
                  setFoodPackImportPreview(null);
                  setToolPanel(null);
                }}
                type="button"
              >
                Cancel
              </button>
            </div>
          </section>
        )}

        {toolPanel === "ai-import" && (
          <LibraryImportPanel
            existingFoods={foods}
            existingMeals={meals}
            message={aiImportMessage}
            error={aiImportError}
            paste={aiImportPaste}
            preview={aiImportPreview}
            onClose={() => setToolPanel(null)}
            onCopyPrompt={async () => {
              const prompt = buildLibraryImportPrompt();
              try {
                await navigator.clipboard?.writeText(prompt);
                setAiImportMessage("Prompt copied. When using a photo, attach it manually in ChatGPT.");
              } catch {
                setAiImportMessage("Copy unavailable. Select and copy the prompt below.");
              }
              setAiImportPaste((current) => current || "");
            }}
            onImport={(preview) => importLibraryPreview(preview)}
            onPasteChange={setAiImportPaste}
            onPreviewChange={setAiImportPreview}
            onValidate={() => validateLibraryImportPaste()}
          />
        )}
        {showPlateBuilder && (
          <BuildPlateForm
            collectionSuggestions={collectionSuggestions}
            foods={foods}
            onAddEntry={addEntryFromComposer}
            onClose={() => {
              setShowPlateBuilder(false);
              setToolPanel(null);
            }}
            onSaveMeal={saveMealFromComposer}
          />
        )}
        {showQuickEstimate && (
          <QuickEstimateForm
            onAddEntry={addEntryFromComposer}
            onClose={() => {
              setShowQuickEstimate(false);
              setToolPanel(null);
            }}
            onSaveFood={saveFoodFromComposer}
          />
        )}
        {showQuickSnack && (
          <QuickSnackForm
            onAddEntry={addEntryFromComposer}
            onClose={() => {
              setShowQuickSnack(false);
              setToolPanel(null);
            }}
            onSaveFood={saveFoodFromComposer}
          />
        )}
        {showNewFood && (
          <NewFoodForm
            collectionSuggestions={collectionSuggestions}
            foods={foods}
            onAddOnce={(food) => saveAndAddNewFood(food, false)}
            onCancel={() => {
              setShowNewFood(false);
              setToolPanel(null);
            }}
            onSave={saveNewFood}
            onSaveAndAdd={(food) => saveAndAddNewFood(food, true)}
            onSaveDrink={saveNewDrink}
            onSaveDrinkAndAdd={saveAndAddNewDrink}
            onSaveMeal={saveNewMeal}
            onSaveMealAndAdd={saveAndAddNewMeal}
          />
        )}
        {showNewDrink && (
          <NewFoodForm
            collectionSuggestions={collectionSuggestions}
            foods={foods}
            initialCategory="drink"
            initialCollectionName="Drinks"
            initialType="drink"
            onCancel={() => {
              setShowNewDrink(false);
              setToolPanel(null);
            }}
            onAddOnce={(food) => saveAndAddNewFood(food, false)}
            onSave={saveNewDrink}
            onSaveAndAdd={saveAndAddNewDrink}
            onSaveDrink={saveNewDrink}
            onSaveDrinkAndAdd={saveAndAddNewDrink}
            onSaveMeal={saveNewMeal}
            onSaveMealAndAdd={saveAndAddNewMeal}
          />
        )}

        <div className="mt-4 grid gap-2">
          <details className="rounded-md border border-stone-200 bg-stone-50 p-3">
            <summary className="cursor-pointer text-sm font-semibold text-stone-950">
              About nutrition labels
            </summary>
            <div className="mt-3 grid gap-2 text-sm text-stone-600 sm:grid-cols-2">
              <p><span className="font-semibold text-stone-800">Official:</span> restaurant or manufacturer source.</p>
              <p><span className="font-semibold text-stone-800">Confirmed:</span> reviewed or corrected by the user.</p>
              <p><span className="font-semibold text-stone-800">Estimated:</span> description, photograph, or generic reference.</p>
              <p><span className="font-semibold text-stone-800">Needs nutrition:</span> missing values are not counted as zero.</p>
            </div>
          </details>
          <details className="rounded-md border border-stone-200 bg-stone-50 p-3" open={toolPanel === "packs"}>
            <summary
              className="cursor-pointer text-sm font-semibold text-stone-950"
              onClick={() => setToolPanel((current) => current === "packs" ? null : "packs")}
            >
              Manage starter packs
            </summary>
            <div className="mt-3 grid gap-3">
              <CoreStarterPackCard
                installed={starterPackInstalled}
                onImport={importStarterPack}
                onPrepareAi={() =>
                  openAiPanel(
                    incompleteFoods,
                    "Incomplete foods from the WellCanvas starter foods.",
                  )
                }
                onTogglePreview={() => setCorePreviewOpen((current) => !current)}
                previewOpen={corePreviewOpen}
              />
            </div>
          </details>
          <details className="rounded-md border border-stone-200 bg-stone-50 p-3" open={toolPanel === "library-management"}>
            <summary
              className="cursor-pointer text-sm font-semibold text-stone-950"
              onClick={() =>
                setToolPanel((current) =>
                  current === "library-management" ? null : "library-management",
                )
              }
            >
              Library management
            </summary>
            <div className="mt-3 grid gap-4">
              <section>
                <h3 className="text-sm font-semibold text-stone-950">
                  Review duplicate copies
                </h3>
                <div className="mt-2">
                  <DuplicateReviewTool
                    foods={foods}
                    meals={meals}
                    onDeleteFood={(id) =>
                      setFoods((current) => current.filter((food) => food.id !== id))
                    }
                    onDeleteMeal={(id) =>
                      setMeals((current) => current.filter((meal) => meal.id !== id))
                    }
                    onRenameFood={(id, name) =>
                      setFoods((current) =>
                        current.map((food) =>
                          food.id === id
                            ? { ...food, name, updatedAt: new Date().toISOString() }
                            : food,
                        ),
                      )
                    }
                    onRenameMeal={(id, name) =>
                      setMeals((current) =>
                        current.map((meal) =>
                          meal.id === id
                            ? { ...meal, name, updatedAt: new Date().toISOString() }
                            : meal,
                        ),
                      )
                    }
                  />
                </div>
              </section>
              <section>
                <h3 className="text-sm font-semibold text-stone-950">
                  Manage hidden items
                </h3>
                <div className="mt-2">
                  <HiddenItemsManager
                    foods={foods}
                    hiddenKeys={hiddenEntityKeys}
                    meals={meals}
                    onUnhide={unhideEntity}
                  />
                </div>
              </section>
            </div>
          </details>
        </div>
      </section>

      {addingFood && (
        <AddFoodSheet
          food={addingFood}
          initialQuantityMode={addingFoodMode}
          onAdd={(options) => addFoodToLog(addingFood, options)}
          onCancel={() => setAddingFood(null)}
          onDetailsEdit={() => openFoodEditorFromQuickLog(addingFood)}
        />
      )}
      {addingDrink && (
        <AddDrinkSheet
          food={addingDrink}
          onAdd={(entry) => addDrinkToLog(entry)}
          onCancel={() => setAddingDrink(null)}
          onDetailsEdit={() => openFoodEditorFromQuickLog(addingDrink)}
          toEntry={createHydrationEntryFromDrinkFood}
        />
      )}
      {addingMeal && (
        <AddMealSheet
          foods={foods}
          meal={addingMeal}
          onAdd={(options) => addMealToLog(addingMeal, options)}
          onCancel={() => setAddingMeal(null)}
          onDetailsEdit={() => openMealEditorFromQuickLog(addingMeal)}
        />
      )}
      {groupAddContext && (
        <ContextualAddDialog
          collectionSuggestions={collectionSuggestions}
          context={groupAddContext}
          foodById={foodById}
          foods={foods}
          onCancel={() => setGroupAddContext(null)}
          onSaveDrink={saveContextualFood}
          onSaveDrinkAndAdd={saveAndLogContextualFood}
          onSaveFood={saveContextualFood}
          onSaveFoodAndAdd={saveAndLogContextualFood}
          onSaveMeal={saveContextualMeal}
          onSaveMealAndAdd={saveAndLogContextualMeal}
        />
      )}
      {aiItems.length > 0 && (
        <AiBridgePanel
          aiError={aiError}
          aiPaste={aiPaste}
          aiPrompt={aiPrompt}
          aiUpdates={aiUpdates}
          clipboardMessage={clipboardMessage}
          onApply={applyAiUpdates}
          onClose={() => {
            setAiItems([]);
            setAiReferencePhotoIds([]);
          }}
          onPasteChange={setAiPaste}
          onToggleApproval={(id) =>
            setAiUpdates((current) =>
              current.map((update) =>
                update.id === id
                  ? { ...update, approved: !update.approved }
                  : update,
              ),
            )
          }
          onValidate={validateAiPaste}
        />
      )}
    </div>
  );
}

function createContextualMealDraft(context: GroupAddContext): MealTemplate {
  const now = new Date().toISOString();
  return {
    id: makeId("meal"),
    name: "",
    description: "",
    mealType: inferMealType(),
    locationName: context.locationName,
    collectionName: context.collectionName,
    estimatedPriceSgd: null,
    metadataEntries: [],
    items: [],
    needsNutritionReview: false,
    reviewReason: null,
    reviewNote: null,
    referencePhoto: null,
    manualNutritionOverride: null,
    isSeedItem: false,
    clonedFromId: null,
    createdAt: now,
    updatedAt: now,
  };
}

function ContextualAddDialog({
  collectionSuggestions,
  context,
  foodById,
  foods,
  onCancel,
  onSaveDrink,
  onSaveDrinkAndAdd,
  onSaveFood,
  onSaveFoodAndAdd,
  onSaveMeal,
  onSaveMealAndAdd,
}: {
  collectionSuggestions: string[];
  context: GroupAddContext;
  foodById: Map<string, FoodItem>;
  foods: FoodItem[];
  onCancel: () => void;
  onSaveDrink: (food: FoodItem) => void;
  onSaveDrinkAndAdd: (food: FoodItem) => void;
  onSaveFood: (food: FoodItem) => void;
  onSaveFoodAndAdd: (food: FoodItem) => void;
  onSaveMeal: (meal: MealTemplate) => void;
  onSaveMealAndAdd: (meal: MealTemplate) => void;
}) {
  const availableTypes: ContextualItemType[] = context.defaultType === "drink"
    ? ["drink"]
    : [
        ...(context.allowFood ? (["food"] as const) : []),
        ...(context.allowMeal ? (["meal"] as const) : []),
      ];
  const [itemType, setItemType] = useState<ContextualItemType>(
    context.defaultType,
  );
  const suggestions = useMemo(
    () =>
      context.collectionName && !collectionSuggestions.includes(context.collectionName)
        ? [context.collectionName, ...collectionSuggestions]
        : collectionSuggestions,
    [collectionSuggestions, context.collectionName],
  );
  const mealDraft = useMemo(() => createContextualMealDraft(context), [context]);

  return (
    <DialogFrame onClose={onCancel} title={`Add to ${context.groupName}`}>
      <div className="grid gap-4">
        {availableTypes.length > 1 && (
          <div>
            <p className="text-sm font-medium text-stone-700">Item type</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {availableTypes.map((type) => (
                <button
                  className={`btn min-h-9 px-3 text-sm ${
                    itemType === type ? "btn-primary-accent" : "btn-secondary-outline"
                  }`}
                  key={type}
                  onClick={() => setItemType(type)}
                  type="button"
                >
                  {type === "meal" ? "Meal" : type === "drink" ? "Drink" : "Food"}
                </button>
              ))}
            </div>
          </div>
        )}

        {itemType === "drink" && (
          <NewFoodForm
            collectionSuggestions={suggestions}
            foods={foods}
            initialCategory="drink"
            initialBeverageType={beverageTypeForGroup(context.groupName)}
            initialCollectionName={context.collectionName ?? "Drinks"}
            initialLocationName={context.locationName ?? ""}
            initialType="drink"
            onCancel={onCancel}
            onAddOnce={onSaveFoodAndAdd}
            onSave={onSaveDrink}
            onSaveAndAdd={onSaveDrinkAndAdd}
            onSaveDrink={onSaveDrink}
            onSaveDrinkAndAdd={onSaveDrinkAndAdd}
            onSaveMeal={onSaveMeal}
            onSaveMealAndAdd={onSaveMealAndAdd}
          />
        )}
        {itemType === "food" && (
          <NewFoodForm
            collectionSuggestions={suggestions}
            initialCategory={context.category}
            initialCollectionName={context.collectionName ?? ""}
            initialLocationName={context.locationName ?? ""}
            onAddOnce={onSaveFoodAndAdd}
            onCancel={onCancel}
            onSave={onSaveFood}
            onSaveAndAdd={onSaveFoodAndAdd}
            showAddOnce={false}
          />
        )}
        {itemType === "meal" && (
          <MealEditor
            collectionSuggestions={suggestions}
            foodById={foodById}
            foods={foods}
            meal={mealDraft}
            onCancel={onCancel}
            onSave={onSaveMeal}
            onSaveAndAdd={onSaveMealAndAdd}
            title="Add meal"
          />
        )}
      </div>
    </DialogFrame>
  );
}

function DialogFrame({
  children,
  headerAction,
  onClose,
  size = "normal",
  title,
}: {
  children: React.ReactNode;
  headerAction?: React.ReactNode;
  onClose: () => void;
  size?: "normal" | "editor";
  title: string;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const titleRef = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => {
    const previousActiveElement =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
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
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previousActiveElement?.focus();
    };
  }, [onClose]);

  const panelClassName =
    size === "editor"
      ? "relative max-h-[96dvh] w-full overflow-hidden rounded-t-xl bg-white shadow-2xl sm:max-h-[calc(100dvh-3rem)] sm:w-[min(960px,calc(100vw-3rem))] sm:rounded-xl"
      : "relative max-h-[calc(100dvh-1rem)] w-full overflow-hidden rounded-t-xl bg-white shadow-2xl sm:max-h-[min(780px,calc(100dvh-2rem))] sm:max-w-3xl sm:rounded-xl";
  const bodyClassName =
    size === "editor"
      ? "max-h-[calc(96dvh-5rem)] overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 sm:max-h-[calc(100dvh-8rem)] sm:px-6 sm:pb-6 sm:pt-5"
      : "max-h-[calc(100dvh-5rem)] overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 sm:max-h-[700px] sm:px-5";

  return (
    <div
      aria-labelledby="foods-dialog-title"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end bg-stone-950/35 p-0 sm:items-center sm:justify-center sm:p-4"
      role="dialog"
    >
      <button
        aria-hidden="true"
        className="absolute inset-0 h-full w-full cursor-default"
        onClick={onClose}
        tabIndex={-1}
        type="button"
      />
      <div
        className={panelClassName}
        ref={panelRef}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-stone-200 bg-white px-4 py-3 sm:px-5">
          <h2
            className="text-lg font-semibold text-stone-950 outline-none"
            id="foods-dialog-title"
            ref={titleRef}
            tabIndex={-1}
          >
            {title}
          </h2>
          <div className="flex shrink-0 items-center gap-2">
            {headerAction}
            <button className={secondaryClasses("min-h-9")} onClick={onClose} type="button">
              Close
            </button>
          </div>
        </div>
        <div className={bodyClassName}>
          {children}
        </div>
      </div>
    </div>
  );
}

function LibraryImportPanel({
  error,
  existingFoods,
  existingMeals,
  message,
  onClose,
  onCopyPrompt,
  onImport,
  onPasteChange,
  onPreviewChange,
  onValidate,
  paste,
  preview,
}: {
  error: string;
  existingFoods: FoodItem[];
  existingMeals: MealTemplate[];
  message: string;
  onClose: () => void;
  onCopyPrompt: () => void;
  onImport: (preview: LibraryImportPreview) => void;
  onPasteChange: (value: string) => void;
  onPreviewChange: (preview: LibraryImportPreview) => void;
  onValidate: () => void;
  paste: string;
  preview: LibraryImportPreview | null;
}) {
  const prompt = buildLibraryImportPrompt();

  function updateFood(index: number, update: Partial<LibraryImportFoodPreview>) {
    if (!preview) return;
    onPreviewChange({
      ...preview,
      foods: preview.foods.map((food, foodIndex) =>
        foodIndex === index ? { ...food, ...update } : food,
      ),
    });
  }

  function updateMeal(index: number, update: Partial<LibraryImportMealPreview>) {
    if (!preview) return;
    onPreviewChange({
      ...preview,
      meals: preview.meals.map((meal, mealIndex) =>
        mealIndex === index ? { ...meal, ...update } : meal,
      ),
    });
  }

  return (
    <section className="wc-section wc-section-padded mt-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-stone-950">Add from AI</h3>
          <p className="mt-1 text-sm text-stone-500">
            Manual copy/paste only. When using a photo, attach it manually in the
            ChatGPT conversation.
          </p>
        </div>
        <SmallButton onClick={onClose}>Close</SmallButton>
      </div>
      <ToastBridge message={message} type="information" />
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <button className={primarySaveClasses()} onClick={onCopyPrompt} type="button">
          Copy prompt for ChatGPT
        </button>
        <SmallButton onClick={onValidate}>Validate</SmallButton>
        <SmallButton onClick={() => onPasteChange("")}>Clear</SmallButton>
      </div>
      <label className="mt-4 block">
        <span className="text-sm font-medium text-stone-700">Prompt preview</span>
        <textarea
          className="mt-2 h-44 w-full rounded-md border border-stone-300 px-3 py-2 font-mono text-xs outline-none focus:border-stone-900"
          readOnly
          value={prompt}
        />
      </label>
      <label className="mt-4 block">
        <span className="text-sm font-medium text-stone-700">Paste JSON</span>
        <textarea
          className="mt-2 h-40 w-full rounded-md border border-stone-300 px-3 py-2 font-mono text-xs outline-none focus:border-stone-900"
          onChange={(event) => onPasteChange(event.target.value)}
          placeholder="Paste one JSON object. Outer Markdown code fences are okay."
          value={paste}
        />
      </label>
      {error && <p className="mt-3 text-sm font-medium text-red-700">{error}</p>}
      {preview && (
        <div className="mt-4 grid gap-3">
          {preview.errors.map((previewError) => (
            <p
              className="rounded-md border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-800"
              key={previewError}
            >
              {previewError}
            </p>
          ))}
          <p className="text-sm text-stone-500">
            Existing library: {existingFoods.length} foods and {existingMeals.length} meals.
          </p>
          {preview.foods.map((foodPreview, index) => (
            <article
              className="rounded-md border border-stone-200 bg-stone-50 p-3"
              key={foodPreview.temporaryId}
            >
              <div className="flex items-start gap-3">
                <input
                  checked={foodPreview.approved}
                  className="mt-1 h-4 w-4"
                  disabled={foodPreview.errors.length > 0}
                  onChange={(event) => updateFood(index, { approved: event.target.checked })}
                  type="checkbox"
                />
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-semibold text-stone-950">{foodPreview.food.name}</p>
                  <p className="mt-1 text-stone-600">{foodPreview.food.servingLabel}</p>
                  <p className="mt-1 text-stone-600">
                    Calories: {formatCalories(foodPreview.food.nutrition?.caloriesKcal, foodPreview.food.nutritionStatus)}
                    {" "}· Protein: {formatNumber(foodPreview.food.nutrition?.proteinG)} g
                  </p>
                  {foodPreview.food.uncertaintyPercent !== null && (
                    <p className="mt-1 text-stone-600">
                      Uncertainty: ±{foodPreview.food.uncertaintyPercent}%
                    </p>
                  )}
                  {foodPreview.food.assumptions.length > 0 && (
                    <p className="mt-1 text-stone-500">
                      Assumptions: {foodPreview.food.assumptions.join("; ")}
                    </p>
                  )}
                  {foodPreview.existingMatch && (
                    <div className="mt-3 rounded-md bg-white p-3">
                      <p className="font-semibold text-stone-800">
                        Possible existing item: {foodPreview.existingMatch.name}
                      </p>
                      <label className="mt-2 block">
                        <span className="text-xs font-medium text-stone-600">Action</span>
                        <select
                          className="mt-1 min-h-10 w-full rounded-md border border-stone-300 bg-white px-2 text-sm"
                          onChange={(event) =>
                            updateFood(index, {
                              duplicateAction: event.target.value as LibraryImportFoodPreview["duplicateAction"],
                              approved: event.target.value !== "keep",
                            })
                          }
                          value={foodPreview.duplicateAction}
                        >
                          <option value="keep">Keep existing</option>
                          <option value="import">Import as a separate item</option>
                          <option
                            disabled={
                              foodPreview.existingMatch.isSeedItem ||
                              foodPreview.existingMatch.nutritionStatus === "official" ||
                              foodPreview.existingMatch.nutritionStatus === "user-confirmed"
                            }
                            value="update"
                          >
                            Update existing personal item
                          </option>
                          <option value="duplicate">Duplicate and edit later</option>
                        </select>
                      </label>
                    </div>
                  )}
                  {foodPreview.errors.length > 0 && (
                    <ul className="mt-2 list-inside list-disc text-red-700">
                      {foodPreview.errors.map((itemError) => (
                        <li key={itemError}>{itemError}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </article>
          ))}
          {preview.meals.map((mealPreview, index) => (
            <article
              className="rounded-md border border-stone-200 bg-stone-50 p-3 text-sm"
              key={mealPreview.temporaryId}
            >
              <label className="flex items-start gap-3">
                <input
                  checked={mealPreview.approved}
                  className="mt-1 h-4 w-4"
                  disabled={mealPreview.errors.length > 0}
                  onChange={(event) => updateMeal(index, { approved: event.target.checked })}
                  type="checkbox"
                />
                <span>
                  <span className="block font-semibold text-stone-950">
                    Meal: {mealPreview.meal.name}
                  </span>
                  <span className="mt-1 block text-stone-600">
                    {mealPreview.meal.items.length} components · {mealTypeLabel(mealPreview.meal.mealType)}
                  </span>
                  {mealPreview.errors.length > 0 && (
                    <span className="mt-2 block text-red-700">
                      {mealPreview.errors.join(" ")}
                    </span>
                  )}
                </span>
              </label>
            </article>
          ))}
          <button
            className={primarySaveClasses("min-h-11")}
            onClick={() => onImport(preview)}
            type="button"
          >
            Import approved
          </button>
        </div>
      )}
    </section>
  );
}

function removeCopySuffix(name: string) {
  return name.replace(/(\s+Copy)+$/i, "").trim();
}

function sameNutrition(a: NutritionValues | null, b: NutritionValues | null) {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

function sameMealItems(a: MealTemplateItem[], b: MealTemplateItem[]) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function DuplicateReviewTool({
  foods,
  meals,
  onDeleteFood,
  onDeleteMeal,
  onRenameFood,
  onRenameMeal,
}: {
  foods: FoodItem[];
  meals: MealTemplate[];
  onDeleteFood: (id: string) => void;
  onDeleteMeal: (id: string) => void;
  onRenameFood: (id: string, name: string) => void;
  onRenameMeal: (id: string, name: string) => void;
}) {
  const [keptIds, setKeptIds] = useState<Set<string>>(() => new Set());
  const logs = readFoodLogEntries();
  const mealComponentIds = new Set(meals.flatMap((meal) => meal.items.map((item) => item.foodItemId)));
  const foodById = new Map(foods.map((food) => [food.id, food]));
  const mealById = new Map(meals.map((meal) => [meal.id, meal]));
  const duplicateFoods = foods.filter((food) => {
    if (keptIds.has(`food:${food.id}`)) return false;
    if (!food.clonedFromId || !/\bCopy\b/i.test(food.name)) return false;
    const original = foodById.get(food.clonedFromId);
    return Boolean(
      original &&
        removeCopySuffix(food.name) === original.name &&
        sameNutrition(food.nutrition, original.nutrition) &&
        !mealComponentIds.has(food.id) &&
        !logs.some((entry) => entry.sourceId === food.id),
    );
  });
  const duplicateMeals = meals.filter((meal) => {
    if (keptIds.has(`meal:${meal.id}`)) return false;
    if (!meal.clonedFromId || !/\bCopy\b/i.test(meal.name)) return false;
    const original = mealById.get(meal.clonedFromId);
    return Boolean(
      original &&
        removeCopySuffix(meal.name) === original.name &&
        sameMealItems(meal.items, original.items) &&
        !logs.some((entry) => entry.sourceId === meal.id),
    );
  });

  if (duplicateFoods.length + duplicateMeals.length === 0) {
    return (
      <p className="mt-3 text-sm text-stone-500">
        No likely accidental duplicate copies found.
      </p>
    );
  }

  return (
    <div className="mt-3 grid gap-3">
      {[...duplicateMeals.map((meal) => ({ type: "meal" as const, entry: meal })), ...duplicateFoods.map((food) => ({ type: "food" as const, entry: food }))].map(({ type, entry }) => {
        const original =
          type === "meal"
            ? mealById.get(entry.clonedFromId ?? "")
            : foodById.get(entry.clonedFromId ?? "");
        if (!original) return null;
        const suggestedName = entry.name.replace(/\s+Copy$/i, " personal");
        return (
          <article className="wc-card border border-stone-200 bg-white text-sm" key={`${type}:${entry.id}`}>
            <p className="font-semibold text-stone-950">Original: {original.name}</p>
            <p className="mt-1 text-stone-600">Possible duplicate: {entry.name}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <SmallButton
                onClick={() =>
                  setKeptIds((current) => new Set(current).add(`${type}:${entry.id}`))
                }
              >
                Keep
              </SmallButton>
              <button
                className={secondaryClasses()}
                onClick={() =>
                  type === "meal"
                    ? onRenameMeal(entry.id, suggestedName)
                    : onRenameFood(entry.id, suggestedName)
                }
                type="button"
              >
                Rename
              </button>
              <button
                className="btn btn-destructive"
                onClick={() =>
                  type === "meal" ? onDeleteMeal(entry.id) : onDeleteFood(entry.id)
                }
                type="button"
              >
                Delete copy
              </button>
            </div>
          </article>
        );
      })}
      <p className="text-xs text-stone-500">
        Deleting a reusable duplicate does not remove historical food-log snapshots.
      </p>
    </div>
  );
}

function GroupedSections<T extends { id: string; name: string }>({
  collapsedGroups,
  emptyMessages,
  groups,
  highlightedEntityKey,
  layout,
  onAddGroup,
  renderEntry,
  setCollapsedGroups,
}: {
  collapsedGroups: Record<string, boolean>;
  emptyMessages?: Record<string, { body: string; title: string }>;
  groups: Array<{ collectionName: string; entries: T[] }>;
  highlightedEntityKey: string | null;
  layout: FoodLibraryLayout;
  onAddGroup: (collectionName: string, entries: T[]) => void;
  renderEntry: (entry: T) => React.ReactNode;
  setCollapsedGroups: React.Dispatch<
    React.SetStateAction<Record<string, boolean>>
  >;
}) {
  return (
    <div className="food-catalogue-body">
      {groups.map(({ collectionName, entries }) => {
        const collapsed = Boolean(collapsedGroups[collectionName]);
        const emptyMessage =
          entries.length === 0 ? emptyMessages?.[collectionName] : null;

        return (
          <section className="food-group" key={collectionName}>
            <div className="food-group-header">
              <h2 className="min-w-0 truncate text-base font-semibold text-stone-950">
                {collectionName}{" "}
                <span className="text-sm font-medium text-stone-500">
                  {entries.length}
                </span>
              </h2>
              <div className="flex shrink-0 items-center gap-2">
                {!collapsed && (
                  <button
                    aria-label={`Add item to ${collectionName}`}
                    className="btn btn-primary-accent min-h-9 px-3 text-sm"
                    onClick={() => onAddGroup(collectionName, entries)}
                    type="button"
                  >
                    + Add
                  </button>
                )}
                <button
                  aria-expanded={!collapsed}
                  aria-label={`${collapsed ? "Expand" : "Collapse"} ${collectionName}`}
                  className="btn btn-secondary-outline min-h-9 px-3 text-sm"
                  onClick={() =>
                    setCollapsedGroups((current) => ({
                      ...current,
                      [collectionName]: !collapsed,
                    }))
                  }
                  type="button"
                >
                  {collapsed ? "Show" : "Hide"}
                </button>
              </div>
            </div>
            {!collapsed && (
              entries.length === 0 ? (
                <div className="px-[var(--wc-section-padding)] py-4 text-sm text-stone-500">
                  <p className="font-semibold text-stone-700">
                    {emptyMessage?.title ?? "No items yet."}
                  </p>
                  <p className="mt-1">
                    {emptyMessage?.body ?? "Add your first item."}
                  </p>
                </div>
              ) : (
                <div
                  className={`food-group-grid grid ${
                    layout === "two-column"
                      ? "food-group-grid-two"
                      : "food-group-grid-one"
                  }`}
                >
                  {entries.map((entry) => (
                    <div
                      className={`h-full rounded-[var(--wc-card-radius)] transition motion-reduce:transition-none ${
                        highlightedEntityKey === entry.id
                          ? "ring-2 ring-[var(--accent)] ring-offset-2"
                          : ""
                      }`}
                      data-library-entry-key={entry.id}
                      key={entry.id}
                    >
                      {renderEntry(entry)}
                    </div>
                  ))}
                </div>
              )
            )}
          </section>
        );
      })}
    </div>
  );
}

function MealCard({
  addError,
  addState,
  foods,
  isHidden,
  meal,
  onAdd,
  onDuplicate,
  onHide,
  onMarkReview,
  onUnhide,
  onView,
}: {
  addError?: string;
  addState: AddCardState;
  foods: FoodItem[];
  isHidden: boolean;
  meal: MealTemplate;
  onAdd: () => void;
  onDuplicate: () => void;
  onHide: () => void;
  onMarkReview: () => void;
  onUnhide: () => void;
  onView: () => void;
}) {
  const nutrition = calculateMealNutrition(meal, foods);
  const actionState: ActionButtonState =
    addState === "adding" ? "pending" : addState === "added" ? "success" : "idle";
  const signals = nutritionSignals({
    nutrition: nutrition.nutrition,
    status: nutrition.status,
  }).slice(0, 2);

  return (
    <article className="wc-card flex h-full flex-col border border-stone-200 bg-white">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-stone-400">
            Meal
          </p>
          <h3 className="overflow-hidden text-sm font-semibold leading-5 text-stone-950 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">
            {meal.name}
          </h3>
        </div>
        <div className="flex flex-col items-end gap-1">
          <StatusBadge status={nutrition.status} />
          {isHidden && (
            <span className="rounded-md bg-stone-100 px-2 py-1 text-xs font-semibold text-stone-700">
              Hidden
            </span>
          )}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 text-sm">
        <p className="font-medium text-stone-800">
          {nutrition.isComplete
            ? formatCalories(nutrition.nutrition?.caloriesKcal, nutrition.status)
            : "Nutrition incomplete"}
        </p>
        <p className="shrink-0 text-stone-500">{meal.items.length} components</p>
      </div>
      {signals.length > 0 && (
        <SignalRow signals={signals} />
      )}
      {meal.userRating ? (
        <p className="mt-2 text-xs font-semibold text-amber-600" aria-label={`Rated ${meal.userRating} out of 5`}>
          {formatRating(meal.userRating)}
        </p>
      ) : null}
      <div className="food-card-actions mt-auto grid grid-cols-[1fr_1fr_auto] items-center gap-2 pt-4">
        <ActionButton
          idleLabel="Add today"
          onClick={onAdd}
          pendingLabel="Adding…"
          state={actionState}
          successLabel="✓ Added"
        />
        <SmallButton ariaLabel={`View or edit ${meal.name}`} onClick={onView}>
          Details / Edit
        </SmallButton>
        <OverflowActions
          actions={[
            { label: "Duplicate", onClick: onDuplicate },
            isHidden
              ? { label: "Unhide", onClick: onUnhide, separatorBefore: true }
              : { label: "Hide from browsing", onClick: onHide, separatorBefore: true },
            { label: "Mark for review", onClick: onMarkReview },
          ]}
        />
      </div>
      {isHidden && (
        <button
          className="mt-2 w-fit text-xs font-semibold text-[var(--accent)] underline underline-offset-4"
          onClick={onUnhide}
          type="button"
        >
          Unhide
        </button>
      )}
      {addError && (
        <p className="mt-2 text-xs font-semibold text-red-700">{addError}</p>
      )}
      {meal.needsNutritionReview && (
        <span className="mt-2 w-fit rounded-md bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">
          Review later
        </span>
      )}
    </article>
  );
}

function FoodCard({
  addError,
  addState,
  food,
  isHidden,
  onAdd,
  onDuplicate,
  onHide,
  onMarkReview,
  onRefine,
  onUnhide,
  onView,
}: {
  addError?: string;
  addState: AddCardState;
  food: FoodItem;
  isHidden: boolean;
  onAdd: () => void;
  onDuplicate: () => void;
  onHide: () => void;
  onMarkReview: () => void;
  onRefine: () => void;
  onUnhide: () => void;
  onView: () => void;
}) {
  const signals = nutritionSignals({
    nutrition: food.nutrition,
    status: food.nutritionStatus,
  }).slice(0, 2);
  const isDrink = isReusableDrink(food);
  const actionState: ActionButtonState =
    addState === "adding" ? "pending" : addState === "added" ? "success" : "idle";
  const typeLabel = isDrink ? "Drink" : isIngredientFood(food) ? "Ingredient" : "Food";
  const hasPending =
    food.photoPending || food.exactNamePending || food.portionVerificationPending;

  return (
    <article className="wc-card flex h-full flex-col border border-stone-200 bg-white">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-stone-400">
            {typeLabel}
          </p>
          <h3 className="overflow-hidden text-sm font-semibold leading-5 text-stone-950 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">
            {food.name}
          </h3>
          <p className="mt-1 truncate text-xs text-stone-500">{food.servingLabel}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <StatusBadge status={food.nutritionStatus} />
          {isHidden && (
            <span className="rounded-md bg-stone-100 px-2 py-1 text-xs font-semibold text-stone-700">
              Hidden
            </span>
          )}
        </div>
      </div>
      <p className="mt-3 text-sm font-medium text-stone-700">
        {food.nutrition?.caloriesKcal !== null &&
        food.nutrition?.caloriesKcal !== undefined
          ? formatCalories(food.nutrition.caloriesKcal, food.nutritionStatus)
          : "Calories missing"}
      </p>
      {signals.length > 0 && <SignalRow signals={signals} />}
      {food.userRating ? (
        <p className="mt-2 text-xs font-semibold text-amber-600" aria-label={`Rated ${food.userRating} out of 5`}>
          {formatRating(food.userRating)}
        </p>
      ) : null}
      {hasPending && (
        <p className="mt-2 text-xs font-medium text-stone-500">
          Pending:{" "}
          {[
            food.photoPending ? "photo" : "",
            food.exactNamePending ? "exact name" : "",
            food.portionVerificationPending ? "portion" : "",
          ]
            .filter(Boolean)
            .join(", ")}
        </p>
      )}
      {food.needsNutritionReview && (
        <span className="mt-2 w-fit rounded-md bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">
          Review later
        </span>
      )}
      <div className="food-card-actions mt-auto grid grid-cols-[1fr_1fr_auto] items-center gap-2 pt-4">
        <ActionButton
          idleLabel={isDrink ? "Add drink" : "Add today"}
          onClick={onAdd}
          pendingLabel="Adding…"
          state={actionState}
          successLabel="✓ Added"
        />
        <SmallButton ariaLabel={`View or edit ${food.name}`} onClick={onView}>
          Details / Edit
        </SmallButton>
        <OverflowActions
          actions={[
            { label: "Duplicate", onClick: onDuplicate },
            isHidden
              ? { label: "Unhide", onClick: onUnhide, separatorBefore: true }
              : { label: "Hide from browsing", onClick: onHide, separatorBefore: true },
            { label: "Mark for review", onClick: onMarkReview },
          ]}
        />
      </div>
      {isHidden && (
        <button
          className="mt-2 w-fit text-xs font-semibold text-[var(--accent)] underline underline-offset-4"
          onClick={onUnhide}
          type="button"
        >
          Unhide
        </button>
      )}
      {addError && (
        <p className="mt-2 text-xs font-semibold text-red-700">{addError}</p>
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          className="text-xs font-semibold text-stone-600 underline decoration-stone-300 underline-offset-4"
          onClick={onRefine}
          type="button"
        >
          Refine with AI
        </button>
      </div>
    </article>
  );
}

function OverflowActions({
  actions,
}: {
  actions: Array<{
    label: string;
    onClick: () => void;
    separatorBefore?: boolean;
    tone?: "default" | "destructive";
  }>;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (
        rootRef.current &&
        event.target instanceof Node &&
        !rootRef.current.contains(event.target)
      ) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        buttonRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="relative" ref={rootRef}>
      <button
        aria-label="More actions"
        aria-expanded={open}
        className="grid min-h-10 w-10 place-items-center rounded-md border border-stone-300 text-sm font-bold text-stone-700"
        onClick={() => setOpen((current) => !current)}
        ref={buttonRef}
        type="button"
      >
        ⋯
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 grid min-w-[13.5rem] max-w-[calc(100vw-2rem)] gap-1 rounded-md border border-stone-200 bg-white p-2 shadow-lg">
          {actions.map((action) => (
            <div
              className={action.separatorBefore ? "border-t border-stone-100 pt-1" : ""}
              key={action.label}
            >
              <button
                className={`min-h-10 w-full whitespace-nowrap rounded-md px-3 py-2.5 text-left text-sm font-medium ${
                  action.tone === "destructive"
                    ? "text-red-700 hover:bg-red-50"
                    : "text-stone-700 hover:bg-stone-100"
                }`}
                onClick={() => {
                  setOpen(false);
                  action.onClick();
                  window.setTimeout(() => buttonRef.current?.focus(), 0);
                }}
                type="button"
              >
                {action.label}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CoreStarterPackCard({
  installed,
  onImport,
  onPrepareAi,
  onTogglePreview,
  previewOpen,
}: {
  installed: boolean;
  onImport: () => void;
  onPrepareAi: () => void;
  onTogglePreview: () => void;
  previewOpen: boolean;
}) {
  const seedPacks = readSeedPacks();
  const installedVersion = seedPacks[STARTER_FOOD_LIBRARY_PACK_ID]?.version;
  const seedFoods = starterLibrarySeedFoods();

  return (
    <article className="wc-section wc-section-padded">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-stone-950">
            WellCanvas starter foods
          </h2>
          <p className="mt-1 text-sm text-stone-500">
            Pack ID: {STARTER_FOOD_LIBRARY_PACK_ID}
          </p>
          <p className="mt-2 text-sm text-stone-600">
            A small neutral catalogue for trying the app before creating your
            own foods, drinks, meals, or imported food packs.
          </p>
        </div>
        <span className="rounded-md bg-stone-100 px-2 py-1 text-xs font-semibold text-stone-700">
          {installed ? `Imported v${installedVersion}` : `v${STARTER_FOOD_LIBRARY_PACK_VERSION}`}
        </span>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <SmallButton onClick={onTogglePreview}>
          {previewOpen ? "Hide preview" : "Preview pack"}
        </SmallButton>
        <button
          className={primarySaveClasses("disabled:bg-stone-200 disabled:text-stone-500")}
          disabled={installed}
          onClick={onImport}
          type="button"
        >
          {installed ? "Starter foods installed" : "Import starter foods"}
        </button>
        <SmallButton onClick={onPrepareAi}>Prepare incomplete foods for AI</SmallButton>
      </div>
      {previewOpen && (
        <div className="mt-4 rounded-md bg-stone-50 p-3">
          <p className="text-sm font-medium text-stone-700">Core categories</p>
          <ul className="mt-2 list-inside list-disc text-sm text-stone-600 sm:columns-2">
            {[
              "Fruits",
              "Ingredients",
              "Drinks",
            ].map((label) => (
              <li key={label}>{label}</li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-stone-600">
            Includes {seedFoods.length} reusable foods and{" "}
            {starterSeedMeals.length} starter meal templates. Existing
            stable IDs are reused.
          </p>
        </div>
      )}
    </article>
  );
}

function HiddenItemsManager({
  foods,
  hiddenKeys,
  meals,
  onUnhide,
}: {
  foods: FoodItem[];
  hiddenKeys: string[];
  meals: MealTemplate[];
  onUnhide: (entityKey: string) => void;
}) {
  const rows = hiddenKeys
    .map((entityKey) => {
      const [type, id] = entityKey.split(":");
      if (type === "food") {
        const food = foods.find((item) => item.id === id);
        return food
          ? {
              collection: collectionForFood(food),
              entityKey,
              name: food.name,
              type: isReusableDrink(food) ? "Drink" : "Food",
            }
          : null;
      }
      if (type === "meal") {
        const meal = meals.find((item) => item.id === id);
        return meal
          ? {
              collection: collectionForMeal(meal),
              entityKey,
              name: meal.name,
              type: "Meal",
            }
          : null;
      }
      return null;
    })
    .filter((row): row is {
      collection: string;
      entityKey: string;
      name: string;
      type: string;
    } => Boolean(row));

  if (rows.length === 0) {
    return (
      <p className="mt-3 rounded-md bg-white p-3 text-sm text-stone-500">
        No items are hidden from browsing.
      </p>
    );
  }

  return (
    <div className="mt-3 grid gap-2">
      {rows.map((row) => (
        <div
          className="grid gap-2 rounded-md bg-white p-3 text-sm sm:grid-cols-[1fr_auto]"
          key={row.entityKey}
        >
          <div>
            <p className="font-semibold text-stone-950">{row.name}</p>
            <p className="mt-1 text-xs text-stone-500">
              {row.type} · {row.collection}
            </p>
          </div>
          <button
            className={secondaryClasses("self-center")}
            onClick={() => onUnhide(row.entityKey)}
            type="button"
          >
            Unhide
          </button>
        </div>
      ))}
    </div>
  );
}

function AddMealSheet({
  foods,
  meal,
  onAdd,
  onCancel,
  onDetailsEdit,
}: {
  foods: FoodItem[];
  meal: MealTemplate;
  onAdd: (options: {
    date: string;
    mealType: FoodLogEntry["mealType"];
    quantity: number;
    time: string;
  }) => void;
  onCancel: () => void;
  onDetailsEdit: () => void;
}) {
  const [date, setDate] = useState(localDateKey());
  const [time, setTime] = useState(currentLocalTime());
  const [mealType, setMealType] = useState<FoodLogEntry["mealType"]>(meal.mealType);
  const [quantity, setQuantity] = useState("1");
  const [error, setError] = useState("");

  function submit() {
    const parsedQuantity = Number(quantity);
    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      setError("Quantity must be greater than zero.");
      return;
    }

    onAdd({ date, mealType, quantity: parsedQuantity, time });
  }
  const parsedQuantity = Number(quantity);
  const mealNutrition = calculateMealNutrition(meal, foods);
  const previewCalories =
    mealNutrition.nutrition?.caloriesKcal !== null &&
    mealNutrition.nutrition?.caloriesKcal !== undefined &&
    Number.isFinite(parsedQuantity) &&
    parsedQuantity > 0
      ? mealNutrition.nutrition.caloriesKcal * parsedQuantity
      : null;

  return (
    <section className="wc-section wc-section-padded shadow-sm">
      <h2 className="text-lg font-semibold text-stone-950">Add meal with options</h2>
      <p className="mt-1 text-sm text-stone-500">{meal.name}</p>
      <p className="mt-2 text-sm font-medium text-stone-700">
        {previewCalories === null
          ? "Nutrition incomplete"
          : `${formatCalories(previewCalories, mealNutrition.status)}`}
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <MealTypeSelect value={mealType} onChange={setMealType} />
        <NumberInput
          label="Quantity"
          onChange={setQuantity}
          step="0.1"
          unit="meals"
          value={quantity}
        />
        <TextInput label="Date" onChange={setDate} type="date" value={date} />
        <TextInput label="Time" onChange={setTime} type="time" value={time} />
      </div>
      {error && <p className="mt-3 text-sm font-medium text-red-700">{error}</p>}
      <div className="mt-5 grid gap-2 sm:grid-cols-[1fr_1fr]">
        <SmallButton onClick={onDetailsEdit}>Details / Edit</SmallButton>
        <SmallButton onClick={onCancel}>Cancel</SmallButton>
        <button className={primaryAddClasses()} onClick={submit} type="button">
          Add meal
        </button>
      </div>
    </section>
  );
}

function AddFoodSheet({
  food,
  initialQuantityMode,
  onAdd,
  onCancel,
  onDetailsEdit,
}: {
  food: FoodItem;
  initialQuantityMode: "servings" | "grams";
  onAdd: (options: {
    date: string;
    mealType: FoodLogEntry["mealType"];
    quantity: number;
    time: string;
  }) => void;
  onCancel: () => void;
  onDetailsEdit: () => void;
}) {
  const [date, setDate] = useState(localDateKey());
  const [time, setTime] = useState(currentLocalTime());
  const [mealType, setMealType] = useState<FoodLogEntry["mealType"]>(inferMealType());
  const [quantity, setQuantity] = useState("1");
  const [quantityMode, setQuantityMode] = useState<"servings" | "grams">(
    food.servingWeightG ? initialQuantityMode : "servings",
  );
  const [error, setError] = useState("");

  function submit() {
    const parsedAmount = Number(quantity);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError("Amount must be greater than zero.");
      return;
    }
    const parsedQuantity =
      quantityMode === "grams" && food.servingWeightG
        ? parsedAmount / food.servingWeightG
        : parsedAmount;

    onAdd({ date, mealType, quantity: parsedQuantity, time });
  }
  const parsedAmount = Number(quantity);
  const previewQuantity =
    Number.isFinite(parsedAmount) && parsedAmount > 0
      ? quantityMode === "grams" && food.servingWeightG
        ? parsedAmount / food.servingWeightG
        : parsedAmount
      : null;
  const previewCalories =
    food.nutrition?.caloriesKcal !== null &&
    food.nutrition?.caloriesKcal !== undefined &&
    previewQuantity !== null
      ? food.nutrition.caloriesKcal * previewQuantity
      : null;

  return (
    <section className="wc-section wc-section-padded shadow-sm">
      <h2 className="text-lg font-semibold text-stone-950">Add food</h2>
      <p className="mt-1 text-sm text-stone-500">{food.name}</p>
      <p className="mt-2 text-sm font-medium text-stone-700">
        {previewCalories === null
          ? "Nutrition incomplete"
          : formatCalories(previewCalories, food.nutritionStatus)}
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <MealTypeSelect value={mealType} onChange={setMealType} />
        {food.servingWeightG && (
          <label>
            <span className="text-sm font-medium text-stone-700">Amount mode</span>
            <select
              className="mt-2 min-h-11 w-full rounded-md border border-stone-300 bg-white px-3 text-sm"
              onChange={(event) =>
                setQuantityMode(event.target.value as "servings" | "grams")
              }
              value={quantityMode}
            >
              <option value="servings">Servings</option>
              <option value="grams">Grams</option>
            </select>
          </label>
        )}
        <NumberInput
          label={quantityMode === "grams" ? "Amount" : "Quantity"}
          onChange={setQuantity}
          step="0.1"
          unit={quantityMode === "grams" ? "g" : "servings"}
          value={quantity}
        />
        <TextInput label="Date" onChange={setDate} type="date" value={date} />
        <TextInput label="Time" onChange={setTime} type="time" value={time} />
      </div>
      {error && <p className="mt-3 text-sm font-medium text-red-700">{error}</p>}
      <div className="mt-5 grid gap-2 sm:grid-cols-[1fr_1fr]">
        <SmallButton onClick={onDetailsEdit}>Details / Edit</SmallButton>
        <SmallButton onClick={onCancel}>Cancel</SmallButton>
        <button
          className={primaryAddClasses()}
          onClick={submit}
          type="button"
        >
          Add
        </button>
      </div>
    </section>
  );
}

function AddDrinkSheet({
  food,
  onAdd,
  onCancel,
  onDetailsEdit,
  toEntry,
}: {
  food: FoodItem;
  onAdd: (entry: HydrationEntry) => void;
  onCancel: () => void;
  onDetailsEdit: () => void;
  toEntry: (food: FoodItem, options?: {
    caloriesKcal?: number | null;
    carbohydratesG?: number | null;
    date?: string;
    notes?: string;
    sodiumMg?: number | null;
    time?: string;
    volumeMl?: number;
  }) => HydrationEntry;
}) {
  const defaultVolume = food.servingVolumeMl ?? 250;
  const defaultEntry = toEntry(food, { volumeMl: defaultVolume });
  const [date, setDate] = useState(localDateKey());
  const [time, setTime] = useState(currentLocalTime());
  const [volumeMl, setVolumeMl] = useState(String(defaultVolume));
  const [calories, setCalories] = useState(
    defaultEntry.caloriesKcal === null ? "" : String(defaultEntry.caloriesKcal),
  );
  const [carbs, setCarbs] = useState(
    defaultEntry.carbohydratesG === null ? "" : String(defaultEntry.carbohydratesG),
  );
  const [sodium, setSodium] = useState(
    defaultEntry.sodiumMg === null ? "" : String(defaultEntry.sodiumMg),
  );
  const [notes, setNotes] = useState(food.description ?? "");
  const [manualNutritionFields, setManualNutritionFields] = useState({
    calories: false,
    carbs: false,
    sodium: false,
  });
  const [error, setError] = useState("");

  const parsedVolumeForPreview = Number(volumeMl);
  const scaledEntry =
    Number.isFinite(parsedVolumeForPreview) && parsedVolumeForPreview > 0
      ? toEntry(food, { volumeMl: parsedVolumeForPreview })
      : defaultEntry;
  const displayedCalories = manualNutritionFields.calories
    ? calories
    : scaledEntry.caloriesKcal === null
      ? ""
      : String(scaledEntry.caloriesKcal);
  const displayedCarbs = manualNutritionFields.carbs
    ? carbs
    : scaledEntry.carbohydratesG === null
      ? ""
      : String(scaledEntry.carbohydratesG);
  const displayedSodium = manualNutritionFields.sodium
    ? sodium
    : scaledEntry.sodiumMg === null
      ? ""
      : String(scaledEntry.sodiumMg);

  function submit() {
    const parsedVolume = Number(volumeMl);
    if (!Number.isFinite(parsedVolume) || parsedVolume <= 0) {
      setError("Volume must be greater than zero.");
      return;
    }
    const parsedCalories = parseOptionalNumber(displayedCalories);
    const parsedCarbs = parseOptionalNumber(displayedCarbs);
    const parsedSodium = parseOptionalNumber(displayedSodium);
    if (
      [parsedCalories, parsedCarbs, parsedSodium].some(
        (value) => value !== null && (!Number.isFinite(value) || value < 0),
      )
    ) {
      setError("Nutrition values must be zero or greater.");
      return;
    }

    onAdd(
      toEntry(food, {
        caloriesKcal: parsedCalories,
        carbohydratesG: parsedCarbs,
        date,
        notes,
        sodiumMg: parsedSodium,
        time,
        volumeMl: parsedVolume,
      }),
    );
  }
  const previewCalories = parseOptionalNumber(displayedCalories);

  return (
    <section className="wc-section wc-section-padded shadow-sm">
      <h2 className="text-lg font-semibold text-stone-950">Add drink</h2>
      <p className="mt-1 text-sm text-stone-500">{food.name}</p>
      <p className="mt-2 text-sm font-medium text-stone-700">
        {previewCalories === null
          ? "Nutrition incomplete"
          : formatCalories(previewCalories, food.nutritionStatus)}
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <NumberInput
          label="Volume"
          onChange={(value) => {
            setVolumeMl(value);
          }}
          step="1"
          unit="ml"
          value={volumeMl}
        />
        <TextInput label="Date" onChange={setDate} type="date" value={date} />
        <TextInput label="Time" onChange={setTime} type="time" value={time} />
        <NumberInput
          label="Calories"
          onChange={(value) => {
            setManualNutritionFields((current) => ({ ...current, calories: true }));
            setCalories(value);
          }}
          step="0.1"
          unit="kcal"
          value={displayedCalories}
        />
        <NumberInput
          label="Carbohydrates"
          onChange={(value) => {
            setManualNutritionFields((current) => ({ ...current, carbs: true }));
            setCarbs(value);
          }}
          step="0.1"
          unit="g"
          value={displayedCarbs}
        />
        <NumberInput
          label="Sodium"
          onChange={(value) => {
            setManualNutritionFields((current) => ({ ...current, sodium: true }));
            setSodium(value);
          }}
          step="1"
          unit="mg"
          value={displayedSodium}
        />
      </div>
      <label className="mt-3 block">
        <span className="text-sm font-medium text-stone-700">Notes</span>
        <input
          className="mt-2 min-h-11 w-full rounded-md border border-stone-300 px-3 text-sm"
          onChange={(event) => setNotes(event.target.value)}
          value={notes}
        />
      </label>
      {error && <p className="mt-3 text-sm font-medium text-red-700">{error}</p>}
      <div className="mt-5 grid gap-2 sm:grid-cols-[1fr_1fr]">
        <SmallButton onClick={onDetailsEdit}>Details / Edit</SmallButton>
        <SmallButton onClick={onCancel}>Cancel</SmallButton>
        <button className={primaryAddClasses()} onClick={submit} type="button">
          Add drink
        </button>
      </div>
    </section>
  );
}

type QuickCreateItemType = "food" | "meal" | "drink";

const commonMetadataLabels = [
  "Brand",
  "Location",
  "Restaurant",
  "Store",
  "Collection",
  "Category",
  "Price",
  "Purchase date",
  "Source",
  "Notes",
  "Product name",
];

function createMetadataEntry(label = "Brand"): FoodMetadataEntry {
  return {
    id: makeId("detail"),
    label,
    value: "",
  };
}

function cleanMetadataEntries(entries: FoodMetadataEntry[]) {
  return entries
    .map((entry) => ({
      ...entry,
      label: entry.label.trim(),
      value: entry.value.trim(),
    }))
    .filter((entry) => entry.label && entry.value);
}

function metadataValue(entries: FoodMetadataEntry[], labels: string[]) {
  const wanted = labels.map((label) => label.toLowerCase());
  return entries.find((entry) => wanted.includes(entry.label.toLowerCase()))?.value ?? "";
}

function parsePriceMetadata(value: string) {
  const match = value.trim().match(/^(.+?)\s+([A-Z]{3})$/);
  return {
    amount: match ? match[1] : value.trim(),
    currency: match ? match[2] : "SGD",
  };
}

function composePriceMetadata(amount: string, currency: string) {
  return [amount.trim(), currency.trim().toUpperCase() || "SGD"].filter(Boolean).join(" ");
}

function categoryFromMetadata(value: string, fallback: FoodCategory) {
  const normalized = value.trim().toLowerCase();
  const match = foodCategoryOptions.find(
    (option) =>
      option.value === normalized ||
      option.label.toLowerCase() === normalized,
  );
  return match?.value ?? fallback;
}

function NewFoodForm({
  allowedTypes,
  foods = [],
  initialBeverageType = "other",
  initialCategory = "other",
  initialCollectionName = "",
  initialLocationName = "",
  initialType = "food",
  onCancel,
  onSave,
  onSaveAndAdd,
  onSaveDrink,
  onSaveDrinkAndAdd,
  onSaveMeal,
  onSaveMealAndAdd,
  showHeading = true,
}: {
  allowedTypes?: QuickCreateItemType[];
  collectionSuggestions: string[];
  foods?: FoodItem[];
  initialBeverageType?: LibraryBeverageType;
  initialCategory?: FoodCategory;
  initialCollectionName?: string;
  initialLocationName?: string;
  initialType?: QuickCreateItemType;
  onAddOnce: (food: FoodItem) => void;
  onCancel: () => void;
  onSave: (food: FoodItem) => void;
  onSaveAndAdd: (food: FoodItem) => void;
  onSaveDrink?: (food: FoodItem) => void;
  onSaveDrinkAndAdd?: (food: FoodItem) => void;
  onSaveMeal?: (meal: MealTemplate) => void;
  onSaveMealAndAdd?: (meal: MealTemplate) => void;
  showAddOnce?: boolean;
  showHeading?: boolean;
}) {
  const availableTypes: QuickCreateItemType[] = (
    allowedTypes ?? [
      "food",
      ...(onSaveMeal ? (["meal"] as const) : []),
      ...(onSaveDrink ? (["drink"] as const) : []),
    ]
  ).filter((type) => {
    if (type === "food") return true;
    if (type === "meal") return Boolean(onSaveMeal);
    return Boolean(onSaveDrink);
  });
  const [itemType, setItemType] = useState<QuickCreateItemType>(
    initialType === "meal" && !onSaveMeal
      ? "food"
      : initialType === "drink" && !onSaveDrink
        ? "food"
        : initialType,
  );
  const [name, setName] = useState("");
  const [servingLabel, setServingLabel] = useState("");
  const [moreNutritionOpen, setMoreNutritionOpen] = useState(false);
  const [moreOptionsOpen, setMoreOptionsOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [componentsOpen, setComponentsOpen] = useState(false);
  const [mealNutritionSource, setMealNutritionSource] = useState<"manual" | "components">("manual");
  const [componentToAdd, setComponentToAdd] = useState(foods[0]?.id ?? "");
  const [mealComponents, setMealComponents] = useState<MealTemplateItem[]>([]);
  const [metadataEntries, setMetadataEntries] = useState<FoodMetadataEntry[]>([]);
  const [nutritionDraft, setNutritionDraft] = useState<Record<keyof NutritionValues, string>>({
    caloriesKcal: "",
    proteinG: "",
    carbohydratesG: "",
    totalFatG: "",
    saturatedFatG: "",
    sugarsG: "",
    fibreG: "",
    sodiumMg: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  function updateNutrition(key: keyof NutritionValues, value: string) {
    setNutritionDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: "" }));
  }

  function updateMetadata(id: string, updates: Partial<FoodMetadataEntry>) {
    setMetadataEntries((current) =>
      current.map((entry) => (entry.id === id ? { ...entry, ...updates } : entry)),
    );
  }

  function removeMetadata(id: string) {
    setMetadataEntries((current) => current.filter((entry) => entry.id !== id));
  }

  function addComponent() {
    if (!componentToAdd) return;
    setMealComponents((current) => [
      ...current,
      { foodItemId: componentToAdd, quantity: 1 },
    ]);
  }

  function updateComponent(index: number, updates: Partial<MealTemplateItem>) {
    setMealComponents((current) =>
      current.map((component, componentIndex) =>
        componentIndex === index ? { ...component, ...updates } : component,
      ),
    );
  }

  function removeComponent(index: number) {
    setMealComponents((current) =>
      current.filter((_, componentIndex) => componentIndex !== index),
    );
  }

  function buildNutrition(nextErrors: Record<string, string>) {
    const nutritionValues = { ...emptyNutrition };
    let hasNutrition = false;
    for (const { key, label } of nutritionKeys) {
      const value = nutritionDraft[key]?.trim() ?? "";
      if (!value) continue;
      const parsed = Number(value);
      if (!Number.isFinite(parsed) || parsed < 0) {
        nextErrors[key] = `${label} cannot be negative or invalid.`;
      } else {
        nutritionValues[key] = parsed;
        hasNutrition = true;
      }
    }
    return { hasNutrition, nutritionValues };
  }

  function buildEntity() {
    const nextErrors: Record<string, string> = {};
    if (!name.trim()) nextErrors.name = "Name is required.";

    const metadata = cleanMetadataEntries(metadataEntries);
    const { hasNutrition, nutritionValues } = buildNutrition(nextErrors);
    const priceText = metadataValue(metadata, ["Price"]);
    const priceAmount = priceText ? parsePriceMetadata(priceText).amount : "";
    const parsedPrice = priceAmount ? Number(priceAmount) : null;
    if (parsedPrice !== null && (!Number.isFinite(parsedPrice) || parsedPrice < 0)) {
      nextErrors.price = "Price cannot be negative or invalid.";
    }

    const invalidComponent = mealComponents.find(
      (component) =>
        !foods.some((food) => food.id === component.foodItemId) ||
        !Number.isFinite(component.quantity) ||
        component.quantity < 0,
    );
    if (invalidComponent) {
      nextErrors.components = "Components need valid foods and non-negative quantities.";
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return null;

    const now = new Date().toISOString();
    const notes = metadataValue(metadata, ["Notes"]);
    const source = metadataValue(metadata, ["Source"]);
    const brand = metadataValue(metadata, ["Brand", "Product name"]);
    const locationName =
      metadataValue(metadata, ["Location", "Restaurant", "Office cafeteria"]) ||
      initialLocationName;
    const collectionName =
      metadataValue(metadata, ["Collection"]) ||
      initialCollectionName ||
      suggestedCollectionName({ brand, locationName }) ||
      null;
    const category = categoryFromMetadata(
      metadataValue(metadata, ["Category"]),
      itemType === "drink" ? "drink" : initialCategory,
    );
    const serving = servingLabel.trim() || "Serving not specified";
    const parsedVolumeMl =
      itemType === "drink"
        ? Number.parseFloat(servingLabel.replace(/,/g, "").match(/\d+(?:\.\d+)?/)?.[0] ?? "")
        : Number.NaN;
    const nutritionStatus: NutritionStatus = hasNutrition ? "estimated" : "missing";

    if (itemType === "meal") {
      const calculatedMeal = calculateMealNutrition(
        {
          id: "preview-meal",
          name: name.trim(),
          description: notes || name.trim(),
          mealType: inferMealType(),
          locationName: locationName || null,
          collectionName,
          estimatedPriceSgd: parsedPrice,
          metadataEntries: metadata,
          items: mealComponents,
          manualNutritionOverride: null,
          isSeedItem: false,
          clonedFromId: null,
          createdAt: now,
          updatedAt: now,
        },
        foods,
      );
      const shouldUseComponentNutrition =
        mealComponents.length > 0 && mealNutritionSource === "components";
      const manualNutritionOverride =
        shouldUseComponentNutrition && calculatedMeal.nutrition
          ? null
          : hasNutrition
            ? {
                nutrition: nutritionValues,
                nutritionStatus,
                sourceLabel: source || null,
                assumptions: notes ? [notes] : [],
                updatedAt: now,
              }
            : null;
      return {
        kind: "meal" as const,
        entity: {
          id: makeId("meal"),
          name: name.trim(),
          description: notes || name.trim(),
          mealType: inferMealType(),
          locationName: locationName || null,
          collectionName,
          estimatedPriceSgd: parsedPrice,
          metadataEntries: metadata,
          items: mealComponents,
          needsNutritionReview: !hasNutrition && !calculatedMeal.isComplete,
          reviewReason: null,
          reviewNote: null,
          referencePhoto: null,
          manualNutritionOverride,
          isSeedItem: false,
          clonedFromId: null,
          createdAt: now,
          updatedAt: now,
        } satisfies MealTemplate,
      };
    }

    const foodCategory = itemType === "drink" ? "drink" : category;
    return {
      kind: itemType === "drink" ? ("drink" as const) : ("food" as const),
      entity: {
        id: makeId("food"),
        name: name.trim(),
        description: notes || name.trim(),
        brand: brand || null,
        servingLabel: serving,
        locationName: locationName || null,
        collectionName,
        category: foodCategory,
        logDestination: itemType === "drink" ? "hydration" : "food",
        servingVolumeMl:
          itemType === "drink" && Number.isFinite(parsedVolumeMl) && parsedVolumeMl > 0
            ? parsedVolumeMl
            : itemType === "drink"
              ? null
              : undefined,
        beverageType: itemType === "drink" ? initialBeverageType : undefined,
        countryCode: "SG",
        nutrition: hasNutrition ? nutritionValues : null,
        nutritionStatus,
        uncertaintyPercent: hasNutrition ? 25 : null,
        sourceLabel: source || null,
        sourceUrl: null,
        lastVerifiedAt: null,
        assumptions: notes ? [notes] : [],
        usualStore: metadataValue(metadata, ["Store"]) || null,
        pricePaidSgd: parsedPrice,
        packageOrPurchaseWeight: metadataValue(metadata, ["Package weight"]) || null,
        purchaseDate: metadataValue(metadata, ["Purchase date"]) || null,
        metadataEntries: metadata,
        photoPending: false,
        exactNamePending: false,
        portionVerificationPending: false,
        servingWeightG: null,
        needsNutritionReview: !hasNutrition,
        reviewReason: null,
        reviewNote: null,
        referencePhoto: null,
        isSeedItem: false,
        clonedFromId: null,
        createdAt: now,
        updatedAt: now,
      } satisfies FoodItem,
    };
  }

  function submit(action: "save" | "save-add") {
    const result = buildEntity();
    if (!result) return;
    if (result.kind === "meal") {
      if (action === "save") onSaveMeal?.(result.entity);
      if (action === "save-add") onSaveMealAndAdd?.(result.entity);
      return;
    }
    if (result.kind === "drink") {
      if (action === "save") onSaveDrink?.(result.entity);
      if (action === "save-add") onSaveDrinkAndAdd?.(result.entity);
      return;
    }
    if (action === "save") onSave(result.entity);
    if (action === "save-add") onSaveAndAdd(result.entity);
  }

  const saveLabel =
    itemType === "meal" ? "Save meal" : itemType === "drink" ? "Save drink" : "Save food";
  const saveAndAddLabel =
    itemType === "meal"
      ? "Save meal and add today"
      : itemType === "drink"
        ? "Save drink and add today"
        : "Save food and add today";
  const heading =
    itemType === "meal"
      ? "Add new meal"
      : itemType === "drink"
        ? "Add new drink"
        : "Add new food";

  return (
    <section className={showHeading ? "wc-section wc-section-padded shadow-sm" : "grid gap-5"}>
      {showHeading && <h2 className="text-lg font-semibold text-stone-950">{heading}</h2>}
      <div className={`${showHeading ? "mt-4 " : ""}grid gap-4`}>
        <TextInput
          error={errors.name}
          label="Name *"
          onChange={(value) => {
            setName(value);
            setErrors((current) => ({ ...current, name: "" }));
          }}
          value={name}
        />
        <TextInput
          label={itemType === "drink" ? "Serving / volume, optional" : "Serving, optional"}
          onChange={setServingLabel}
          value={servingLabel}
        />
        {!moreNutritionOpen && (
          <div className="grid gap-3 sm:grid-cols-2">
            <NumberInput
              error={errors.caloriesKcal}
              label="Calories, optional"
              onChange={(value) => updateNutrition("caloriesKcal", value)}
              step="0.1"
              unit="kcal"
              value={nutritionDraft.caloriesKcal}
            />
            {itemType === "drink" ? (
              <NumberInput
                error={errors.sugarsG}
                label="Sugar, optional"
                onChange={(value) => updateNutrition("sugarsG", value)}
                step="0.1"
                unit="g"
                value={nutritionDraft.sugarsG}
              />
            ) : (
              <NumberInput
                error={errors.proteinG}
                label="Protein, optional"
                onChange={(value) => updateNutrition("proteinG", value)}
                step="0.1"
                unit="g"
                value={nutritionDraft.proteinG}
              />
            )}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            className={secondaryClasses()}
            onClick={() => setMoreNutritionOpen((current) => !current)}
            type="button"
          >
            {moreNutritionOpen ? "Less nutrition" : "More nutrition"}
          </button>
          <button
            className={secondaryClasses()}
            onClick={() => {
              setDetailsOpen(true);
              setMetadataEntries((current) => [...current, createMetadataEntry()]);
            }}
            type="button"
          >
            + Add optional detail
          </button>
          {availableTypes.length > 1 && (
            <button
              className={tertiaryClasses("px-3")}
              onClick={() => setMoreOptionsOpen((current) => !current)}
              type="button"
            >
              {moreOptionsOpen ? "Hide options" : "More options"}
            </button>
          )}
        </div>

        {moreNutritionOpen && (
          <div className="rounded-md border border-stone-200 bg-stone-50 p-3">
            <p className="text-sm font-semibold text-stone-950">Nutrition</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {nutritionKeys.map(({ key, label, unit }) => (
                <NumberInput
                  error={errors[key]}
                  key={key}
                  label={label}
                  onChange={(value) => updateNutrition(key, value)}
                  step="0.1"
                  unit={unit}
                  value={nutritionDraft[key]}
                />
              ))}
            </div>
          </div>
        )}

        {moreOptionsOpen && availableTypes.length > 1 && (
          <div className="rounded-md border border-stone-200 bg-stone-50 p-3">
            <p className="text-sm font-semibold text-stone-950">Type</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {availableTypes.map((type) => (
                <button
                  className={`btn min-h-9 px-3 text-sm ${
                    itemType === type ? "btn-primary-accent" : "btn-secondary-outline"
                  }`}
                  key={type}
                  onClick={() => setItemType(type)}
                  type="button"
                >
                  {type === "meal" ? "Meal" : type === "drink" ? "Drink" : "Food"}
                </button>
              ))}
            </div>
          </div>
        )}

        {itemType === "meal" && (
          <div className="rounded-md border border-stone-200 bg-stone-50 p-3">
            <button
              className={secondaryClasses()}
              onClick={() => setComponentsOpen((current) => !current)}
              type="button"
            >
              {componentsOpen ? "Hide components" : "+ Add components"}
            </button>
            {componentsOpen && (
              <div className="mt-3 grid gap-3">
                {foods.length > 0 ? (
                  <>
                    <div className="grid grid-cols-[1fr_auto] gap-2">
                      <select
                        className="min-h-10 rounded-md border border-stone-300 bg-white px-2 text-sm"
                        onChange={(event) => setComponentToAdd(event.target.value)}
                        value={componentToAdd}
                      >
                        {foods.map((food) => (
                          <option key={food.id} value={food.id}>
                            {food.name}
                          </option>
                        ))}
                      </select>
                      <SmallButton onClick={addComponent}>Add</SmallButton>
                    </div>
                    {mealComponents.map((component, index) => (
                      <div
                        className="grid gap-2 rounded-md border border-stone-200 bg-white p-2 sm:grid-cols-[1fr_7rem_auto]"
                        key={`${component.foodItemId}-${index}`}
                      >
                        <p className="text-sm font-medium text-stone-800">
                          {foods.find((food) => food.id === component.foodItemId)?.name ??
                            component.foodItemId}
                        </p>
                        <NumberInput
                          label="Quantity"
                          onChange={(value) =>
                            updateComponent(index, {
                              quantity: value ? Number(value) : 0,
                            })
                          }
                          step="0.1"
                          unit=""
                          value={component.quantity}
                        />
                        <SmallButton onClick={() => removeComponent(index)}>Remove</SmallButton>
                      </div>
                    ))}
                    {mealComponents.length > 0 && (
                      <div>
                        <p className="text-sm font-medium text-stone-700">
                          Nutrition source
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {(["manual", "components"] as const).map((source) => (
                            <button
                              className={`btn min-h-9 px-3 text-sm ${
                                mealNutritionSource === source
                                  ? "btn-primary-accent"
                                  : "btn-secondary-outline"
                              }`}
                              key={source}
                              onClick={() => setMealNutritionSource(source)}
                              type="button"
                            >
                              {source === "manual" ? "Enter manually" : "Calculate from components"}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-stone-500">
                    Add foods to the library first, then use them as components.
                  </p>
                )}
                {errors.components && (
                  <p className="text-sm font-medium text-red-700">{errors.components}</p>
                )}
              </div>
            )}
          </div>
        )}

        {(detailsOpen || metadataEntries.length > 0) && (
          <div className="rounded-md border border-stone-200 bg-stone-50 p-3">
            <p className="text-sm font-semibold text-stone-950">Optional details</p>
            <div className="mt-3 grid gap-2">
              {metadataEntries.map((entry) => {
                const price = parsePriceMetadata(entry.value);
                return (
                  <div className="grid gap-2 rounded-md border border-stone-200 bg-white p-2 md:grid-cols-[11rem_1fr_auto]" key={entry.id}>
                    <div className="grid gap-2">
                      <select
                        aria-label="Common details"
                        className="min-h-10 rounded-md border border-stone-300 bg-white px-2 text-sm"
                        onChange={(event) =>
                          updateMetadata(entry.id, {
                            label:
                              event.target.value === "__custom"
                                ? ""
                                : event.target.value,
                          })
                        }
                        value={
                          commonMetadataLabels.includes(entry.label)
                            ? entry.label
                            : "__custom"
                        }
                      >
                        {commonMetadataLabels.map((label) => (
                          <option key={label} value={label}>
                            {label}
                          </option>
                        ))}
                        <option value="__custom">Custom detail</option>
                      </select>
                      {!commonMetadataLabels.includes(entry.label) && (
                        <input
                          aria-label="Detail name"
                          className="min-h-10 rounded-md border border-stone-300 px-2 text-sm"
                          onChange={(event) =>
                            updateMetadata(entry.id, { label: event.target.value })
                          }
                          placeholder="Detail name"
                          value={entry.label}
                        />
                      )}
                    </div>
                    {entry.label === "Price" ? (
                      <div className="grid grid-cols-[1fr_5rem] gap-2">
                        <input
                          aria-label="Price amount"
                          className="min-h-10 rounded-md border border-stone-300 px-2 text-sm"
                          inputMode="decimal"
                          onChange={(event) =>
                            updateMetadata(entry.id, {
                              value: composePriceMetadata(event.target.value, price.currency),
                            })
                          }
                          placeholder="6.50"
                          value={price.amount}
                        />
                        <input
                          aria-label="Currency"
                          className="min-h-10 rounded-md border border-stone-300 px-2 text-sm uppercase"
                          maxLength={3}
                          onChange={(event) =>
                            updateMetadata(entry.id, {
                              value: composePriceMetadata(price.amount, event.target.value),
                            })
                          }
                          value={price.currency}
                        />
                      </div>
                    ) : (
                      <input
                        aria-label={`${entry.label || "Detail"} value`}
                        className="min-h-10 rounded-md border border-stone-300 px-2 text-sm"
                        onChange={(event) =>
                          updateMetadata(entry.id, { value: event.target.value })
                        }
                        placeholder="Value"
                        type={entry.label === "Purchase date" ? "date" : "text"}
                        value={entry.value}
                      />
                    )}
                    <SmallButton onClick={() => removeMetadata(entry.id)}>Remove</SmallButton>
                  </div>
                );
              })}
            </div>
            {errors.price && (
              <p className="mt-2 text-sm font-medium text-red-700">{errors.price}</p>
            )}
          </div>
        )}
      </div>
      <div className="mt-5 grid gap-2 sm:grid-cols-[auto_1fr_1fr]">
        <SmallButton onClick={onCancel}>Cancel</SmallButton>
        <button
          className={primarySaveClasses("min-h-11")}
          onClick={() => submit("save")}
          type="button"
        >
          {saveLabel}
        </button>
        <button
          className={primaryAddClasses("min-h-11")}
          onClick={() => submit("save-add")}
          type="button"
        >
          {saveAndAddLabel}
        </button>
      </div>
    </section>
  );
}

function FoodEditor({
  collectionSuggestions,
  food,
  onDirtyChange,
  onCancel,
  onSave,
  onSaveCopy,
}: {
  collectionSuggestions: string[];
  food: FoodItem;
  onDirtyChange?: (dirty: boolean) => void;
  onCancel: () => void;
  onSave: (food: FoodItem) => void;
  onSaveCopy?: (food: FoodItem) => void;
}) {
  const [draft, setDraft] = useState(food);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const hasNutrition = Boolean(
    draft.nutrition && nutritionKeys.some(({ key }) => draft.nutrition?.[key] !== null),
  );
  const previewChanges = [
    food.servingLabel !== draft.servingLabel
      ? `Serving: ${food.servingLabel} → ${draft.servingLabel}`
      : "",
    food.servingWeightG !== draft.servingWeightG
      ? `Serving weight: ${formatNumber(food.servingWeightG)} g → ${formatNumber(draft.servingWeightG)} g`
      : "",
    food.nutrition?.caloriesKcal !== draft.nutrition?.caloriesKcal
      ? `Calories: ${formatNumber(food.nutrition?.caloriesKcal)} → ${formatNumber(draft.nutrition?.caloriesKcal)} kcal`
      : "",
    food.nutritionStatus !== draft.nutritionStatus
      ? `Status: ${nutritionStatusLabel(food.nutritionStatus)} → ${nutritionStatusLabel(draft.nutritionStatus)}`
      : "",
  ].filter(Boolean);

  useEffect(() => {
    onDirtyChange?.(JSON.stringify(draft) !== JSON.stringify(food));
  }, [draft, food, onDirtyChange]);

  function updateNutrition(key: keyof NutritionValues, value: string) {
    const parsed = parseOptionalNumber(value);
    setDraft((current) => ({
      ...current,
      nutrition: {
        ...(current.nutrition ?? emptyNutrition),
        [key]: parsed,
      },
    }));
    setErrors((current) => ({ ...current, [key]: "" }));
  }

  function save() {
    const nextErrors: Record<string, string> = {};
    const values = draft.nutrition;

    if (!draft.name.trim()) {
      nextErrors.name = "Name is required.";
    }

    if (values) {
      for (const { key, label } of nutritionKeys) {
        const value = values[key];
        if (value !== null && value !== undefined && (!Number.isFinite(value) || value < 0)) {
          nextErrors[key] = `${label} cannot be negative or invalid.`;
        }
      }
    }

    if (
      draft.uncertaintyPercent !== null &&
      (!Number.isFinite(draft.uncertaintyPercent) ||
        draft.uncertaintyPercent < 0 ||
        draft.uncertaintyPercent > 100)
    ) {
      nextErrors.uncertaintyPercent = "Uncertainty must be between 0 and 100.";
    }
    if (
      draft.servingWeightG !== null &&
      draft.servingWeightG !== undefined &&
      (!Number.isFinite(draft.servingWeightG) || draft.servingWeightG <= 0)
    ) {
      nextErrors.servingWeightG = "Serving weight must be positive when supplied.";
    }
    if (
      draft.servingVolumeMl !== null &&
      draft.servingVolumeMl !== undefined &&
      (!Number.isFinite(draft.servingVolumeMl) || draft.servingVolumeMl <= 0)
    ) {
      nextErrors.servingVolumeMl = "Serving volume must be positive when supplied.";
    }
    if (draft.nutritionStatus === "official" && !draft.sourceLabel?.trim()) {
      nextErrors.sourceLabel = "Official nutrition requires a source label.";
    }
    if (
      draft.pricePaidSgd !== null &&
      draft.pricePaidSgd !== undefined &&
      (!Number.isFinite(draft.pricePaidSgd) || draft.pricePaidSgd < 0)
    ) {
      nextErrors.pricePaidSgd = "Price cannot be negative or invalid.";
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const nextFood: FoodItem = {
      ...draft,
      category: draft.category ?? "other",
      logDestination:
        draft.category === "drink" || draft.logDestination === "hydration"
          ? draft.logDestination ?? "hydration"
          : "food",
      nutritionStatus:
        draft.nutritionStatus === "official"
          ? "official"
          : hasNutrition
            ? "user-confirmed"
            : "missing",
      uncertaintyPercent:
        draft.nutritionStatus === "official" || !hasNutrition
          ? null
          : draft.uncertaintyPercent,
      nutrition:
        draft.nutrition && nutritionKeys.some(({ key }) => draft.nutrition?.[key] !== null)
          ? draft.nutrition
          : null,
      metadataEntries: cleanMetadataEntries(draft.metadataEntries ?? []),
      needsNutritionReview: false,
      reviewReason: null,
      reviewNote: null,
    };

    onSave(nextFood);
  }

  function saveCopy() {
    if (!onSaveCopy) return;
    const nextErrors: Record<string, string> = {};
    if (!draft.name.trim()) nextErrors.name = "Name is required.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    onSaveCopy(draft);
  }

  return (
    <section className="grid gap-5">
      <div className="mt-4 grid gap-4">
        <TextInput
          error={errors.name}
          id={fieldIdForFood("name")}
          label="Name"
          onChange={(value) => setDraft((current) => ({ ...current, name: value }))}
          value={draft.name}
        />
        <div className="grid gap-3 md:grid-cols-2">
          <TextInput
            label="Description"
            onChange={(value) =>
              setDraft((current) => ({ ...current, description: value }))
            }
            value={draft.description}
          />
          <TextInput
            label="Brand"
            onChange={(value) =>
              setDraft((current) => ({ ...current, brand: value || null }))
            }
            value={draft.brand ?? ""}
          />
          <label>
            <span className="text-sm font-medium text-stone-700">Type</span>
            <select
              className="mt-2 min-h-12 w-full rounded-md border border-stone-300 bg-white px-3"
              onChange={(event) =>
                setDraft((current) => {
                  const category = event.target.value as FoodCategory;
                  return {
                    ...current,
                    category,
                    logDestination: category === "drink" ? "hydration" : "food",
                  };
                })
              }
              value={draft.category ?? "other"}
            >
              {foodCategoryOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="text-sm font-medium text-stone-700">Log destination</span>
            <select
              className="mt-2 min-h-12 w-full rounded-md border border-stone-300 bg-white px-3"
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  logDestination: event.target.value as FoodItem["logDestination"],
                }))
              }
              value={draft.logDestination ?? (draft.category === "drink" ? "hydration" : "food")}
            >
              <option value="food">Food log</option>
              <option value="hydration">Hydration log</option>
            </select>
          </label>
          <TextInput
            label="Location / restaurant"
            onChange={(value) =>
              setDraft((current) => ({ ...current, locationName: value || null }))
            }
            value={draft.locationName ?? ""}
          />
          <TextInput
            label="Collection / group"
            list="food-editor-collection-suggestions"
            onChange={(value) =>
              setDraft((current) => ({ ...current, collectionName: value || null }))
            }
            value={draft.collectionName ?? ""}
          />
        </div>
        <datalist id="food-editor-collection-suggestions">
          {collectionSuggestions.map((collection) => (
            <option key={collection} value={collection} />
          ))}
        </datalist>
        <div className="grid gap-3 md:grid-cols-3">
          <TextInput
            label="Serving label"
            onChange={(value) =>
              setDraft((current) => ({ ...current, servingLabel: value }))
            }
            value={draft.servingLabel}
          />
          <NumberInput
            error={errors.servingWeightG}
            label="Mass"
            onChange={(value) =>
              setDraft((current) => ({
                ...current,
                servingWeightG: parseOptionalNumber(value),
              }))
            }
            step="0.1"
            unit="g"
            value={draft.servingWeightG ?? ""}
          />
          <NumberInput
            error={errors.servingVolumeMl}
            label="Volume"
            onChange={(value) =>
              setDraft((current) => ({
                ...current,
                servingVolumeMl: parseOptionalNumber(value),
              }))
            }
            step="1"
            unit="ml"
            value={draft.servingVolumeMl ?? ""}
          />
        </div>
        {(draft.category === "drink" || draft.logDestination === "hydration") && (
          <label>
            <span className="text-sm font-medium text-stone-700">Beverage type</span>
            <select
              className="mt-2 min-h-12 w-full rounded-md border border-stone-300 bg-white px-3"
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  beverageType: event.target.value as FoodItem["beverageType"],
                }))
              }
              value={draft.beverageType ?? "other"}
            >
              <option value="tap-water">Tap water</option>
              <option value="still-water">Still water</option>
              <option value="sparkling-water">Sparkling water</option>
              <option value="sweet-soda">Sweet soda</option>
              <option value="zero-soda">Zero soda</option>
              <option value="coffee">Coffee</option>
              <option value="tea">Tea</option>
              <option value="other">Other</option>
            </select>
          </label>
        )}
        <label>
          <span className="text-sm font-medium text-stone-700">Nutrition status</span>
          <select
            className="mt-2 min-h-12 w-full rounded-md border border-stone-300 bg-white px-3"
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                nutritionStatus: event.target.value as NutritionStatus,
              }))
            }
            value={draft.nutritionStatus}
          >
            <option value="missing">Needs nutrition</option>
            <option value="estimated">Estimated</option>
            <option value="user-confirmed">Confirmed</option>
            <option value="official">Official</option>
          </select>
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          {nutritionKeys.map(({ key, label, unit }) => (
            <NumberInput
              error={errors[key]}
              key={key}
              label={label}
              onChange={(value) => updateNutrition(key, value)}
              step="0.1"
              unit={unit}
              value={draft.nutrition?.[key] ?? ""}
            />
          ))}
        </div>
        <NumberInput
          error={errors.uncertaintyPercent}
          label="Uncertainty"
          onChange={(value) =>
            setDraft((current) => ({
              ...current,
              uncertaintyPercent: parseOptionalNumber(value),
            }))
          }
          step="1"
          unit="%"
          value={draft.uncertaintyPercent ?? ""}
        />
        <TextInput
          error={errors.sourceLabel}
          label="Source label"
          onChange={(value) =>
            setDraft((current) => ({ ...current, sourceLabel: value || null }))
          }
          value={draft.sourceLabel ?? ""}
        />
        <TextInput
          label="Source URL"
          onChange={(value) =>
            setDraft((current) => ({ ...current, sourceUrl: value || null }))
          }
          value={draft.sourceUrl ?? ""}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <TextInput
            label="Usual store"
            onChange={(value) =>
              setDraft((current) => ({ ...current, usualStore: value || null }))
            }
            value={draft.usualStore ?? ""}
          />
          <NumberInput
            error={errors.pricePaidSgd}
            label="Price paid"
            onChange={(value) =>
              setDraft((current) => ({
                ...current,
                pricePaidSgd: parseOptionalNumber(value),
              }))
            }
            step="0.01"
            unit="SGD"
            value={draft.pricePaidSgd ?? ""}
          />
          <TextInput
            label="Package or purchase weight"
            onChange={(value) =>
              setDraft((current) => ({
                ...current,
                packageOrPurchaseWeight: value || null,
              }))
            }
            value={draft.packageOrPurchaseWeight ?? ""}
          />
          <TextInput
            label="Purchase date"
            onChange={(value) =>
              setDraft((current) => ({ ...current, purchaseDate: value || null }))
            }
            type="date"
            value={draft.purchaseDate ?? ""}
          />
        </div>
        <div className="rounded-md border border-stone-200 bg-stone-50 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-stone-950">Optional details</p>
            <SmallButton
              onClick={() =>
                setDraft((current) => ({
                  ...current,
                  metadataEntries: [
                    ...(current.metadataEntries ?? []),
                    createMetadataEntry(),
                  ],
                }))
              }
            >
              + Add optional detail
            </SmallButton>
          </div>
          <div className="mt-3 grid gap-2">
            {(draft.metadataEntries ?? []).map((entry) => (
              <div
                className="grid gap-2 rounded-md border border-stone-200 bg-white p-2 sm:grid-cols-[10rem_1fr_auto]"
                key={entry.id}
              >
                <input
                  aria-label="Detail name"
                  className="min-h-10 rounded-md border border-stone-300 px-2 text-sm"
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      metadataEntries: (current.metadataEntries ?? []).map((detail) =>
                        detail.id === entry.id
                          ? { ...detail, label: event.target.value }
                          : detail,
                      ),
                    }))
                  }
                  value={entry.label}
                />
                <input
                  aria-label={`${entry.label || "Detail"} value`}
                  className="min-h-10 rounded-md border border-stone-300 px-2 text-sm"
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      metadataEntries: (current.metadataEntries ?? []).map((detail) =>
                        detail.id === entry.id
                          ? { ...detail, value: event.target.value }
                          : detail,
                      ),
                    }))
                  }
                  value={entry.value}
                />
                <SmallButton
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      metadataEntries: (current.metadataEntries ?? []).filter(
                        (detail) => detail.id !== entry.id,
                      ),
                    }))
                  }
                >
                  Remove
                </SmallButton>
              </div>
            ))}
          </div>
        </div>
        <div className="grid gap-2 rounded-md bg-stone-50 p-3">
          <CheckboxInput
            checked={Boolean(draft.photoPending)}
            label="Photo pending"
            onChange={(value) =>
              setDraft((current) => ({ ...current, photoPending: value }))
            }
          />
          <CheckboxInput
            checked={Boolean(draft.exactNamePending)}
            label="Exact product or menu name pending"
            onChange={(value) =>
              setDraft((current) => ({ ...current, exactNamePending: value }))
            }
          />
          <CheckboxInput
            checked={Boolean(draft.portionVerificationPending)}
            label="Portion verification pending"
            onChange={(value) =>
              setDraft((current) => ({
                ...current,
                portionVerificationPending: value,
              }))
            }
          />
        </div>
        <label>
          <span className="text-sm font-medium text-stone-700">Assumptions</span>
          <textarea
            className="mt-2 min-h-24 w-full rounded-md border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-900"
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                assumptions: event.target.value
                  .split("\n")
                  .map((line) => line.trim())
                  .filter(Boolean),
              }))
            }
            value={draft.assumptions.join("\n")}
          />
        </label>
        {previewChanges.length > 0 && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
            <p className="text-sm font-semibold text-amber-900">Change preview</p>
            <ul className="mt-2 grid gap-1 text-sm text-amber-900">
              {previewChanges.map((change) => (
                <li key={change}>{change}</li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-amber-800">
              Saving a manual correction affects future logs only. Existing food-log
              snapshots stay unchanged.
            </p>
          </div>
        )}
      </div>
      <div className="sticky bottom-0 -mx-4 mt-1 grid gap-2 border-t border-stone-200 bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:grid-cols-[1fr_1fr_auto] sm:px-6">
        <SmallButton onClick={onCancel}>Cancel</SmallButton>
        {onSaveCopy && (
          <button className="btn btn-secondary-outline" onClick={saveCopy} type="button">
            Save as copy
          </button>
        )}
        <button
          className={primarySaveClasses()}
          onClick={save}
          type="button"
        >
          Save changes
        </button>
      </div>
    </section>
  );
}

function createMealEditorDraft(meal: MealTemplate, foods: FoodItem[]): MealTemplate {
  if (meal.manualNutritionOverride) return meal;
  const calculated = calculateMealNutrition(meal, foods);
  if (!calculated.nutrition) return meal;
  return {
    ...meal,
    manualNutritionOverride: {
      nutrition: calculated.nutrition,
      nutritionStatus: calculated.status,
      sourceLabel: "Calculated from components",
      assumptions: [],
      updatedAt: meal.updatedAt,
    },
  };
}

function MealEditor({
  collectionSuggestions,
  foodById,
  foods,
  meal,
  onDirtyChange,
  onCancel,
  onSave,
  onSaveCopy,
  onSaveAndAdd,
}: {
  collectionSuggestions: string[];
  foodById: Map<string, FoodItem>;
  foods: FoodItem[];
  meal: MealTemplate;
  onDirtyChange?: (dirty: boolean) => void;
  onCancel: () => void;
  onSave: (meal: MealTemplate) => void;
  onSaveCopy?: (meal: MealTemplate) => void;
  onSaveAndAdd?: (meal: MealTemplate) => void;
  title?: string;
}) {
  const [draft, setDraft] = useState(() => createMealEditorDraft(meal, foods));
  const initialDraftRef = useRef(draft);
  const [componentToAdd, setComponentToAdd] = useState(foods[0]?.id ?? "");
  const [error, setError] = useState("");
  const [componentsChangedWithManual, setComponentsChangedWithManual] = useState(false);
  const [calculationPreviewOpen, setCalculationPreviewOpen] = useState(false);
  const calculatedDraftNutrition = calculateMealNutrition(
    { ...draft, manualNutritionOverride: null },
    foods,
  );
  const visibleNutrition = calculateMealNutrition(draft, foods);

  useEffect(() => {
    onDirtyChange?.(JSON.stringify(draft) !== JSON.stringify(initialDraftRef.current));
  }, [draft, onDirtyChange]);

  function updateComponent(index: number, component: MealTemplateItem) {
    setDraft((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) =>
        itemIndex === index ? component : item,
      ),
    }));
    if (draft.manualNutritionOverride) setComponentsChangedWithManual(true);
  }

  function removeComponent(index: number) {
    setDraft((current) => ({
      ...current,
      items: current.items.filter((_, itemIndex) => itemIndex !== index),
    }));
    if (draft.manualNutritionOverride) setComponentsChangedWithManual(true);
  }

  function moveComponent(index: number, direction: -1 | 1) {
    setDraft((current) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.items.length) return current;
      const items = [...current.items];
      const [item] = items.splice(index, 1);
      items.splice(nextIndex, 0, item);
      return { ...current, items };
    });
    if (draft.manualNutritionOverride) setComponentsChangedWithManual(true);
  }

  function updateManualNutrition(key: keyof NutritionValues, value: string) {
    const parsed = parseOptionalNumber(value);
    setDraft((current) => ({
      ...current,
      manualNutritionOverride: {
        nutrition: {
          ...(current.manualNutritionOverride?.nutrition ??
            visibleNutrition.nutrition ??
            emptyNutrition),
          [key]: parsed,
        },
        nutritionStatus:
          current.manualNutritionOverride?.nutritionStatus ?? visibleNutrition.status,
        sourceLabel: current.manualNutritionOverride?.sourceLabel ?? "Manual override",
        assumptions: current.manualNutritionOverride?.assumptions ?? [],
        updatedAt: new Date().toISOString(),
      },
    }));
  }

  function applyCalculatedTotals() {
    if (!calculatedDraftNutrition.nutrition) {
      setError("Component nutrition is incomplete, so totals cannot be calculated yet.");
      return;
    }
    setDraft((current) => ({
      ...current,
      manualNutritionOverride: {
        nutrition: calculatedDraftNutrition.nutrition!,
        nutritionStatus: calculatedDraftNutrition.status,
        sourceLabel: "Calculated from components",
        assumptions: [],
        updatedAt: new Date().toISOString(),
      },
    }));
    setCalculationPreviewOpen(false);
    setComponentsChangedWithManual(false);
    setError("");
  }

  function save() {
    if (!draft.name.trim()) {
      setError("Meal name is required.");
      return;
    }
    if (
      draft.items.some(
        (item) =>
          !foodById.has(item.foodItemId) ||
          !Number.isFinite(item.quantity) ||
          item.quantity < 0,
      )
    ) {
      setError("Components need valid foods and non-negative quantities.");
      return;
    }
    if (draft.manualNutritionOverride) {
      for (const { key, label } of nutritionKeys) {
        const value = draft.manualNutritionOverride.nutrition[key];
        if (value !== null && value !== undefined && (!Number.isFinite(value) || value < 0)) {
          setError(`${label} cannot be negative or invalid.`);
          return;
        }
      }
    }

    onSave({
      ...draft,
      metadataEntries: cleanMetadataEntries(draft.metadataEntries ?? []),
    });
  }

  function saveCopy() {
    if (!onSaveCopy) return;
    if (!draft.name.trim()) {
      setError("Meal name is required.");
      return;
    }
    onSaveCopy({
      ...draft,
      metadataEntries: cleanMetadataEntries(draft.metadataEntries ?? []),
    });
  }

  function saveAndAdd() {
    if (!onSaveAndAdd) return;
    if (!draft.name.trim()) {
      setError("Meal name is required.");
      return;
    }
    if (
      draft.items.some(
        (item) =>
          !foodById.has(item.foodItemId) ||
          !Number.isFinite(item.quantity) ||
          item.quantity < 0,
      )
    ) {
      setError("Components need valid foods and non-negative quantities.");
      return;
    }
    onSaveAndAdd({
      ...draft,
      metadataEntries: cleanMetadataEntries(draft.metadataEntries ?? []),
    });
  }

  return (
    <section className="grid gap-5">
      <div className="mt-4 grid gap-4">
        <TextInput
          label="Name"
          onChange={(value) => setDraft((current) => ({ ...current, name: value }))}
          value={draft.name}
        />
        <TextInput
          label="Description"
          onChange={(value) =>
            setDraft((current) => ({ ...current, description: value }))
          }
          value={draft.description}
        />
        <TextInput
          label="Location"
          onChange={(value) =>
            setDraft((current) => ({ ...current, locationName: value || null }))
          }
          value={draft.locationName ?? ""}
        />
        <TextInput
          label="Collection / group"
          list="meal-editor-collection-suggestions"
          onChange={(value) =>
            setDraft((current) => ({ ...current, collectionName: value || null }))
          }
          value={draft.collectionName ?? ""}
        />
        <datalist id="meal-editor-collection-suggestions">
          {collectionSuggestions.map((collection) => (
            <option key={collection} value={collection} />
          ))}
        </datalist>
        <NumberInput
          label="Estimated price"
          onChange={(value) =>
            setDraft((current) => ({
              ...current,
              estimatedPriceSgd: parseOptionalNumber(value),
            }))
          }
          step="0.1"
          unit="SGD"
          value={draft.estimatedPriceSgd ?? ""}
        />
        <div className="rounded-md border border-stone-200 bg-stone-50 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-stone-950">Optional details</p>
            <SmallButton
              onClick={() =>
                setDraft((current) => ({
                  ...current,
                  metadataEntries: [
                    ...(current.metadataEntries ?? []),
                    createMetadataEntry(),
                  ],
                }))
              }
            >
              + Add optional detail
            </SmallButton>
          </div>
          <div className="mt-3 grid gap-2">
            {(draft.metadataEntries ?? []).map((entry) => (
              <div
                className="grid gap-2 rounded-md border border-stone-200 bg-white p-2 sm:grid-cols-[10rem_1fr_auto]"
                key={entry.id}
              >
                <input
                  aria-label="Detail name"
                  className="min-h-10 rounded-md border border-stone-300 px-2 text-sm"
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      metadataEntries: (current.metadataEntries ?? []).map((detail) =>
                        detail.id === entry.id
                          ? { ...detail, label: event.target.value }
                          : detail,
                      ),
                    }))
                  }
                  value={entry.label}
                />
                <input
                  aria-label={`${entry.label || "Detail"} value`}
                  className="min-h-10 rounded-md border border-stone-300 px-2 text-sm"
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      metadataEntries: (current.metadataEntries ?? []).map((detail) =>
                        detail.id === entry.id
                          ? { ...detail, value: event.target.value }
                          : detail,
                      ),
                    }))
                  }
                  value={entry.value}
                />
                <SmallButton
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      metadataEntries: (current.metadataEntries ?? []).filter(
                        (detail) => detail.id !== entry.id,
                      ),
                    }))
                  }
                >
                  Remove
                </SmallButton>
              </div>
            ))}
          </div>
        </div>
        <div>
          <p className="text-sm font-medium text-stone-700">Components</p>
          <div className="mt-2 grid gap-2">
            {draft.items.map((component, index) => (
              <div
                className="grid gap-2 rounded-md border border-stone-200 bg-stone-50 p-2 sm:grid-cols-[1fr_5rem_auto_auto]"
                key={`${component.foodItemId}-${index}`}
              >
                <select
                  aria-label={`Component ${index + 1}`}
                  className="min-h-11 rounded-md border border-stone-300 bg-white px-2 text-sm"
                  onChange={(event) =>
                    updateComponent(index, {
                      ...component,
                      foodItemId: event.target.value,
                    })
                  }
                  value={component.foodItemId}
                >
                  {foods.map((food) => (
                    <option key={food.id} value={food.id}>
                      {food.name}
                    </option>
                  ))}
                </select>
                <input
                  aria-label={`Edit amount for ${
                    foodById.get(component.foodItemId)?.name ?? `component ${index + 1}`
                  }`}
                  className="min-h-11 rounded-md border border-stone-300 px-2 text-sm"
                  min="0"
                  onChange={(event) =>
                    updateComponent(index, {
                      ...component,
                      quantity: Number(event.target.value),
                    })
                  }
                  step="0.1"
                  type="number"
                  value={component.quantity}
                />
                <div className="flex gap-2">
                  <button
                    className="btn btn-secondary-outline min-h-11 px-3 text-xs"
                    disabled={index === 0}
                    onClick={() => moveComponent(index, -1)}
                    type="button"
                  >
                    Up
                  </button>
                  <button
                    className="btn btn-secondary-outline min-h-11 px-3 text-xs"
                    disabled={index === draft.items.length - 1}
                    onClick={() => moveComponent(index, 1)}
                    type="button"
                  >
                    Down
                  </button>
                </div>
                <button
                  className="btn btn-secondary-outline min-h-11 px-3 text-sm"
                  onClick={() => removeComponent(index)}
                  type="button"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
            <select
              className="min-h-11 rounded-md border border-stone-300 bg-white px-2 text-sm"
              onChange={(event) => setComponentToAdd(event.target.value)}
              value={componentToAdd}
            >
              {foods.map((food) => (
                <option key={food.id} value={food.id}>
                  {food.name}
                </option>
              ))}
            </select>
            <SmallButton
              onClick={() =>
                componentToAdd &&
                (setDraft((current) => ({
                  ...current,
                  items: [
                    ...current.items,
                    { foodItemId: componentToAdd, quantity: 1 },
                  ],
                })),
                draft.manualNutritionOverride && setComponentsChangedWithManual(true))
              }
            >
              Add
            </SmallButton>
          </div>
        </div>
        <div className="rounded-md border border-stone-200 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-stone-950">Meal nutrition</p>
              <p className="mt-1 text-xs text-stone-500">
                {draft.manualNutritionOverride
                  ? "Manual override is active for future logs."
                  : calculatedDraftNutrition.isComplete
                    ? "Totals are calculated from components."
                    : "Component nutrition is incomplete."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                className="btn btn-secondary-outline min-h-9 px-3 text-xs"
                onClick={() => setCalculationPreviewOpen(true)}
                type="button"
              >
                Calculate from components
              </button>
              <button
                className="btn btn-secondary-outline min-h-9 px-3 text-xs"
                onClick={() =>
                  setDraft((current) => ({
                    ...current,
                    manualNutritionOverride: {
                      nutrition:
                        current.manualNutritionOverride?.nutrition ??
                        calculatedDraftNutrition.nutrition ??
                        emptyNutrition,
                      nutritionStatus:
                        current.manualNutritionOverride?.nutritionStatus ??
                        calculatedDraftNutrition.status,
                      sourceLabel:
                        current.manualNutritionOverride?.sourceLabel ??
                        "Manual override",
                      assumptions: current.manualNutritionOverride?.assumptions ?? [],
                      updatedAt: new Date().toISOString(),
                    },
                  }))
                }
                type="button"
              >
                Manual override
              </button>
            </div>
          </div>
          {componentsChangedWithManual && (
            <p className="mt-3 rounded-md bg-amber-50 p-2 text-xs font-medium text-amber-900">
              Components changed. Recalculate totals or keep the manual values.
            </p>
          )}
          {calculationPreviewOpen && (
            <div className="mt-3 rounded-md bg-stone-50 p-3">
              <p className="text-sm font-semibold text-stone-950">
                Calculation preview
              </p>
              <div className="mt-3 grid gap-2 text-sm">
                {nutritionKeys.map(({ key, label, unit }) => (
                  <div
                    className="grid grid-cols-[1fr_auto_auto] gap-3"
                    key={key}
                  >
                    <span className="text-stone-600">{label}</span>
                    <span>
                      {formatNumber(visibleNutrition.nutrition?.[key])} {unit}
                    </span>
                    <span className="font-semibold text-stone-950">
                      {formatNumber(calculatedDraftNutrition.nutrition?.[key])} {unit}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  className="btn btn-primary-accent min-h-9 px-3 text-xs"
                  onClick={applyCalculatedTotals}
                  type="button"
                >
                  Apply calculated totals
                </button>
                <button
                  className="btn btn-secondary-outline min-h-9 px-3 text-xs"
                  onClick={() => setCalculationPreviewOpen(false)}
                  type="button"
                >
                  Keep current totals
                </button>
              </div>
            </div>
          )}
          {draft.manualNutritionOverride && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {nutritionKeys.map(({ key, label, unit }) => (
                <NumberInput
                  key={key}
                  label={label}
                  onChange={(value) => updateManualNutrition(key, value)}
                  step="0.1"
                  unit={unit}
                  value={draft.manualNutritionOverride?.nutrition[key] ?? ""}
                />
              ))}
              <label>
                <span className="text-sm font-medium text-stone-700">
                  Nutrition status
                </span>
                <select
                  className="mt-2 min-h-12 w-full rounded-md border border-stone-300 bg-white px-3"
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      manualNutritionOverride: current.manualNutritionOverride
                        ? {
                            ...current.manualNutritionOverride,
                            nutritionStatus: event.target.value as NutritionStatus,
                          }
                        : current.manualNutritionOverride,
                    }))
                  }
                  value={draft.manualNutritionOverride.nutritionStatus}
                >
                  <option value="missing">Needs nutrition</option>
                  <option value="estimated">Estimated</option>
                  <option value="user-confirmed">Confirmed</option>
                  <option value="official">Official</option>
                </select>
              </label>
              <TextInput
                label="Source note"
                onChange={(value) =>
                  setDraft((current) => ({
                    ...current,
                    manualNutritionOverride: current.manualNutritionOverride
                      ? {
                          ...current.manualNutritionOverride,
                          sourceLabel: value || null,
                        }
                      : current.manualNutritionOverride,
                  }))
                }
                value={draft.manualNutritionOverride.sourceLabel ?? ""}
              />
            </div>
          )}
        </div>
      </div>
      {error && <p className="mt-3 text-sm font-medium text-red-700">{error}</p>}
      <div className="sticky bottom-0 -mx-4 mt-1 grid gap-2 border-t border-stone-200 bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:grid-cols-[1fr_1fr_auto] sm:px-6">
        <SmallButton onClick={onCancel}>Cancel</SmallButton>
        {onSaveCopy && (
          <button className="btn btn-secondary-outline" onClick={saveCopy} type="button">
            Save as copy
          </button>
        )}
        <button
          className={primarySaveClasses()}
          onClick={save}
          type="button"
        >
          Save changes
        </button>
        {onSaveAndAdd && (
          <button
            className={primaryAddClasses()}
            onClick={saveAndAdd}
            type="button"
          >
            Save and log today
          </button>
        )}
      </div>
    </section>
  );
}

function FullNutritionSummary({
  nutrition,
  title = "Nutrition",
}: {
  nutrition: NutritionValues | null;
  title?: string;
}) {
  const rows: Array<{ label: string; unit: string; value: number | null | undefined }> = [
    { label: "Calories", unit: "kcal", value: nutrition?.caloriesKcal },
    { label: "Protein", unit: "g", value: nutrition?.proteinG },
    { label: "Fat", unit: "g", value: nutrition?.totalFatG },
    { label: "Saturated fat", unit: "g", value: nutrition?.saturatedFatG },
    { label: "Carbohydrates", unit: "g", value: nutrition?.carbohydratesG },
    { label: "Sugars", unit: "g", value: nutrition?.sugarsG },
    { label: "Fibre", unit: "g", value: nutrition?.fibreG },
    { label: "Sodium", unit: "mg", value: nutrition?.sodiumMg },
  ];

  return (
    <div className="rounded-md bg-stone-50 p-3">
      <p className="text-sm font-semibold text-stone-950">{title}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {rows.map((row) => (
          <p className="rounded-md border border-stone-200 bg-white p-3 text-sm" key={row.label}>
            <span className="block text-xs font-medium text-stone-500">{row.label}</span>
            <span className="mt-1 block font-semibold text-stone-950">
              {row.value === null || row.value === undefined
                ? "—"
                : `${formatNumber(row.value)} ${row.unit}`}
            </span>
          </p>
        ))}
      </div>
    </div>
  );
}

function MealDetails({
  foodById,
  foods,
  meal,
  onEditMeal,
  onRatingChange,
  onPrepareAi,
  onSaveReview,
}: {
  foodById: Map<string, FoodItem>;
  foods: FoodItem[];
  meal: MealTemplate;
  onEditMeal: () => void;
  onRatingChange: (rating: PersonalFoodRating | null) => void;
  onPrepareAi: () => void;
  onSaveReview: (meal: MealTemplate) => void;
}) {
  const nutrition = calculateMealNutrition(meal, foods);

  return (
    <section className="grid gap-4">
      <div>
        <p className="text-sm text-stone-500">{meal.description}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-stone-100 px-2 py-1 text-xs font-semibold text-stone-700">
            Meal
          </span>
          <span className="rounded-md bg-stone-100 px-2 py-1 text-xs font-semibold text-stone-700">
            {collectionForMeal(meal)}
          </span>
          <StatusBadge status={nutrition.status} />
        </div>
      </div>
      <RatingPicker rating={meal.userRating ?? null} onChange={onRatingChange} />
      <FullNutritionSummary nutrition={nutrition.nutrition} title="Total meal nutrition" />
      {meal.manualNutritionOverride && (
        <p className="rounded-md bg-amber-50 p-3 text-sm font-medium text-amber-900">
          Manual meal-total override
        </p>
      )}
      {meal.metadataEntries && meal.metadataEntries.length > 0 && (
        <div className="rounded-md bg-stone-50 p-3">
          <p className="text-sm font-semibold text-stone-950">Optional details</p>
          <div className="mt-2 grid gap-2 text-sm text-stone-600">
            {meal.metadataEntries.map((entry) => (
              <p key={entry.id}>
                <span className="font-medium text-stone-800">{entry.label}:</span>{" "}
                {entry.value}
              </p>
            ))}
          </div>
        </div>
      )}
      <div>
        <p className="text-sm font-semibold text-stone-950">Components</p>
        <div className="mt-2 divide-y divide-stone-100">
        {meal.items.map((component, index) => {
          const food = foodById.get(component.foodItemId);
          return (
            <div className="py-3 text-sm" key={`${component.foodItemId}-${index}`}>
              <p className="font-medium text-stone-800">
                {component.quantity} × {food?.name ?? component.foodItemId}
              </p>
              <p className="mt-1 text-stone-500">
                {food?.nutrition?.caloriesKcal !== null &&
                food?.nutrition?.caloriesKcal !== undefined
                  ? `${formatCalories(
                      food.nutrition.caloriesKcal,
                      food.nutritionStatus,
                    )} per serving`
                  : "Needs nutrition"}
              </p>
              {food && (
                <div className="mt-2 rounded-md bg-stone-50 p-2 text-xs text-stone-500">
                  <p>
                    {nutritionStatusLabel(food.nutritionStatus)}
                    {food.nutritionStatus === "estimated" &&
                    food.uncertaintyPercent !== null
                      ? ` · ±${food.uncertaintyPercent}%`
                      : ""}
                  </p>
                  {food.sourceLabel && <p>Source: {food.sourceLabel}</p>}
                  {food.lastVerifiedAt && <p>Verified: {food.lastVerifiedAt}</p>}
                  {food.assumptions.length > 0 && (
                    <p>Assumptions: {food.assumptions.join("; ")}</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
        </div>
      </div>
      <div className="grid gap-2">
        <ReviewPanel
          existingPhoto={meal.referencePhoto ?? null}
          mealTemplateId={meal.id}
          onCorrectManual={onEditMeal}
          onPrepareAi={onPrepareAi}
          onSave={(review) =>
            onSaveReview({
              ...meal,
              needsNutritionReview: true,
              reviewReason: review.reviewReason,
              reviewNote: review.reviewNote,
              referencePhoto: review.referencePhoto,
            })
          }
        />
      </div>
      <p className="mt-3 text-xs text-stone-500">
        For meal corrections, editing components is preferred. A separate meal-total
        override is shown explicitly when present.
      </p>
    </section>
  );
}

function FoodDetails({
  food,
  onEditNutrition,
  onRatingChange,
  onPrepareAi,
  onSaveReview,
}: {
  food: FoodItem;
  onEditNutrition: () => void;
  onRatingChange: (rating: PersonalFoodRating | null) => void;
  onPrepareAi: () => void;
  onSaveReview: (food: FoodItem) => void;
}) {
  const signals = nutritionSignals({
    nutrition: food.nutrition,
    status: food.nutritionStatus,
  });

  return (
    <section className="grid gap-4">
      <div>
        <p className="text-sm text-stone-500">{food.description}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-md bg-stone-100 px-2 py-1 text-xs font-semibold text-stone-700">
          {isReusableDrink(food) ? "Drink" : isIngredientFood(food) ? "Ingredient" : "Food"}
        </span>
        <span className="rounded-md bg-stone-100 px-2 py-1 text-xs font-semibold text-stone-700">
          {collectionForFood(food)}
        </span>
        <StatusBadge status={food.nutritionStatus} />
        {signals.map((signal) => (
          <SignalRow key={signal.label} signals={[signal]} />
        ))}
        {food.nutritionStatus === "estimated" &&
          food.uncertaintyPercent !== null && (
            <span className="rounded-md bg-stone-100 px-2 py-1 text-xs font-semibold text-stone-700">
              ±{food.uncertaintyPercent}%
            </span>
          )}
      </div>
      <RatingPicker rating={food.userRating ?? null} onChange={onRatingChange} />
      <div className="grid gap-2 rounded-md bg-stone-50 p-3 text-sm text-stone-600">
        <p>Serving: {food.servingLabel}</p>
        <p>Location: {food.locationName ?? "General"}</p>
        <p>Collection: {collectionForFood(food)}</p>
        {food.usualStore && <p>Usual store: {food.usualStore}</p>}
        {food.pricePaidSgd !== null && food.pricePaidSgd !== undefined && (
          <p>Price paid: SGD {formatNumber(food.pricePaidSgd)}</p>
        )}
        {food.packageOrPurchaseWeight && (
          <p>Purchase weight: {food.packageOrPurchaseWeight}</p>
        )}
        {food.purchaseDate && <p>Purchase date: {food.purchaseDate}</p>}
        {food.servingWeightG !== null && food.servingWeightG !== undefined && (
          <p>Serving weight: {formatNumber(food.servingWeightG)} g</p>
        )}
        {food.needsNutritionReview && (
          <p>
            Review later
            {food.reviewReason ? `: ${food.reviewReason}` : ""}
            {food.reviewNote ? ` · ${food.reviewNote}` : ""}
          </p>
        )}
        {food.referencePhoto && (
          <p>
            Reference photo: {food.referencePhoto.fileName} (
            {food.referencePhoto.reviewStatus})
          </p>
        )}
        {(food.photoPending ||
          food.exactNamePending ||
          food.portionVerificationPending) && (
          <p>
            Pending:{" "}
            {[
              food.photoPending ? "photo" : "",
              food.exactNamePending ? "exact product or menu name" : "",
              food.portionVerificationPending ? "portion verification" : "",
            ]
              .filter(Boolean)
              .join(", ")}
          </p>
        )}
        {food.sourceLabel && <p>Source: {food.sourceLabel}</p>}
        {food.lastVerifiedAt && <p>Last verified: {food.lastVerifiedAt}</p>}
      </div>
      <FullNutritionSummary nutrition={food.nutrition} />
      {food.metadataEntries && food.metadataEntries.length > 0 && (
        <div className="rounded-md bg-stone-50 p-3">
          <p className="text-sm font-semibold text-stone-950">Optional details</p>
          <div className="mt-2 grid gap-2 text-sm text-stone-600">
            {food.metadataEntries.map((entry) => (
              <p key={entry.id}>
                <span className="font-medium text-stone-800">{entry.label}:</span>{" "}
                {entry.value}
              </p>
            ))}
          </div>
        </div>
      )}
      {food.assumptions.length > 0 && (
        <div className="rounded-md bg-stone-50 p-3">
          <p className="text-sm font-semibold text-stone-800">Assumptions</p>
          <ul className="mt-2 list-inside list-disc text-sm text-stone-600">
            {food.assumptions.map((assumption) => (
              <li key={assumption}>{assumption}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="grid gap-2">
        <ReviewPanel
          existingPhoto={food.referencePhoto ?? null}
          foodItemId={food.id}
          onCorrectManual={onEditNutrition}
          onPrepareAi={onPrepareAi}
          onSave={(review) =>
            onSaveReview({
              ...food,
              needsNutritionReview: true,
              reviewReason: review.reviewReason,
              reviewNote: review.reviewNote,
              referencePhoto: review.referencePhoto,
            })
          }
        />
      </div>
    </section>
  );
}

const reviewReasons = [
  "Portion looks different",
  "Nutrition seems too high",
  "Nutrition seems too low",
  "Exact product is different",
  "Missing nutrition label",
  "Other",
];

function ReviewPanel({
  existingPhoto,
  foodItemId = null,
  mealTemplateId = null,
  onCorrectManual,
  onPrepareAi,
  onSave,
}: {
  existingPhoto: FoodReferencePhotoMetadata | null;
  foodItemId?: string | null;
  mealTemplateId?: string | null;
  onCorrectManual: () => void;
  onPrepareAi: () => void;
  onSave: (review: {
    referencePhoto: FoodReferencePhotoMetadata | null;
    reviewReason: string | null;
    reviewNote: string | null;
  }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(reviewReasons[0]);
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState<FoodReferencePhotoMetadata | null>(
    existingPhoto,
  );
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    if (!photo) {
      return;
    }

    readReferencePhotoUrl(photo.id)
      .then((url) => {
        if (active) setPreviewUrl(url);
      })
      .catch(() => {
        if (active) setError("Could not load the saved photo preview.");
      });

    return () => {
      active = false;
    };
  }, [photo]);

  async function handlePhoto(file: File | undefined) {
    if (!file) return;
    setError("");
    try {
      if (photo) {
        await deleteReferencePhoto(photo.id);
      }
      const metadata = await saveReferencePhoto({ file, foodItemId, mealTemplateId });
      setPhoto(metadata);
    } catch {
      setError("Could not save the reference photo.");
    }
  }

  async function removePhoto() {
    if (photo) {
      await deleteReferencePhoto(photo.id);
    }
    setPhoto(null);
    setPreviewUrl(null);
  }

  if (!open) {
    return (
      <button
        className={secondaryClasses()}
        onClick={() => setOpen(true)}
        type="button"
      >
        Doesn&apos;t look right?
      </button>
    );
  }

  return (
    <div className="rounded-md border border-stone-200 bg-stone-50 p-3 sm:col-span-2">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold text-stone-950">
          Doesn&apos;t look right?
        </h3>
        <button
          className={tertiaryClasses()}
          onClick={() => setOpen(false)}
          type="button"
        >
          Cancel
        </button>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <button
          className={secondaryClasses()}
          onClick={onCorrectManual}
          type="button"
        >
          Correct manually
        </button>
        <button
          className={secondaryClasses()}
          onClick={onPrepareAi}
          type="button"
        >
          Prepare for AI review
        </button>
        <button
          className={primarySaveClasses()}
          onClick={() =>
            onSave({
              referencePhoto: photo,
              reviewReason: reason,
              reviewNote: note.trim() || null,
            })
          }
          type="button"
        >
          Mark for later
        </button>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label>
          <span className="text-sm font-medium text-stone-700">Reason</span>
          <select
            className="mt-2 min-h-11 w-full rounded-md border border-stone-300 bg-white px-3 text-sm"
            onChange={(event) => setReason(event.target.value)}
            value={reason}
          >
            {reviewReasons.map((reviewReason) => (
              <option key={reviewReason} value={reviewReason}>
                {reviewReason}
              </option>
            ))}
          </select>
        </label>
        <TextInput label="Optional note" onChange={setNote} value={note} />
      </div>
      <label className="mt-3 block">
        <span className="text-sm font-medium text-stone-700">
          Add reference photo
        </span>
        <input
          accept="image/*"
          capture="environment"
          className="mt-2 block w-full text-sm text-stone-700"
          onChange={(event) => handlePhoto(event.target.files?.[0])}
          type="file"
        />
      </label>
      {previewUrl && (
        <div className="mt-3 flex items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt="Reference preview"
            className="h-24 w-24 rounded-md object-cover"
            src={previewUrl}
          />
          <div className="text-sm text-stone-600">
            <p>{photo?.fileName}</p>
            <button
              className={tertiaryClasses("mt-2 text-red-700")}
              onClick={removePhoto}
              type="button"
            >
              Remove photo
            </button>
          </div>
        </div>
      )}
      {error && <p className="mt-2 text-sm font-medium text-red-700">{error}</p>}
      <p className="mt-3 text-xs text-stone-500">
        Photos stay private in this browser. AI prompts mention when a reference
        photo exists, but the image must be attached manually outside the app.
      </p>
    </div>
  );
}

function AiBridgePanel({
  aiError,
  aiPaste,
  aiPrompt,
  aiUpdates,
  clipboardMessage,
  onApply,
  onClose,
  onPasteChange,
  onToggleApproval,
  onValidate,
}: {
  aiError: string;
  aiPaste: string;
  aiPrompt: string;
  aiUpdates: ValidatedFoodAiUpdate[];
  clipboardMessage: string;
  onApply: () => void;
  onClose: () => void;
  onPasteChange: (value: string) => void;
  onToggleApproval: (id: string) => void;
  onValidate: () => void;
}) {
  return (
    <section className="wc-section wc-section-padded shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-stone-950">AI refinement bridge</h2>
          <p className="mt-1 text-sm text-stone-500">
            No API call is made. Copy the prompt, paste JSON back, then approve
            changes.
          </p>
        </div>
        <SmallButton onClick={onClose}>Close</SmallButton>
      </div>
      {clipboardMessage && (
        <p className="mt-3 rounded-md bg-stone-50 p-3 text-sm text-stone-600">
          {clipboardMessage}
        </p>
      )}
      <label className="mt-4 block">
        <span className="text-sm font-medium text-stone-700">Copy for ChatGPT</span>
        <textarea
          className="mt-2 h-44 w-full rounded-md border border-stone-300 px-3 py-2 font-mono text-xs outline-none focus:border-stone-900"
          readOnly
          value={aiPrompt}
        />
      </label>
      <label className="mt-4 block">
        <span className="text-sm font-medium text-stone-700">Paste AI result</span>
        <textarea
          className="mt-2 h-36 w-full rounded-md border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-900"
          onChange={(event) => onPasteChange(event.target.value)}
          value={aiPaste}
        />
      </label>
      <button
        className="mt-3 min-h-11 w-full rounded-md bg-stone-900 px-4 text-sm font-semibold text-white"
        onClick={onValidate}
        type="button"
      >
        Validate result
      </button>
      {aiError && <p className="mt-3 text-sm font-medium text-red-700">{aiError}</p>}
      {aiUpdates.length > 0 && (
        <div className="mt-4 rounded-md bg-stone-50 p-3">
          <h3 className="font-semibold text-stone-950">Change preview</h3>
          <div className="mt-2 grid gap-3">
            {aiUpdates.map((update) => (
              <label
                className="wc-card border border-stone-200 bg-white text-sm"
                key={update.id}
              >
                <div className="flex items-start gap-3">
                  <input
                    checked={update.approved}
                    className="mt-1 h-4 w-4"
                    onChange={() => onToggleApproval(update.id)}
                    type="checkbox"
                  />
                  <div>
                    <p className="font-semibold text-stone-900">{update.current.name}</p>
                    <p className="mt-1 text-stone-600">
                      Calories: {formatNumber(update.current.nutrition?.caloriesKcal)} →{" "}
                      {formatNumber(update.update.nutrition.caloriesKcal)} kcal
                    </p>
                    <p className="text-stone-600">
                      Protein: {formatNumber(update.current.nutrition?.proteinG)} →{" "}
                      {formatNumber(update.update.nutrition.proteinG)} g
                    </p>
                    <p className="text-stone-600">
                      Status: {nutritionStatusLabel(update.current.nutritionStatus)} →{" "}
                      {nutritionStatusLabel(update.update.nutritionStatus)}
                    </p>
                    <p className="text-stone-600">
                      Uncertainty:{" "}
                      {update.current.uncertaintyPercent === null
                        ? "—"
                        : `±${update.current.uncertaintyPercent}%`}{" "}
                      → ±{update.update.uncertaintyPercent}%
                    </p>
                  </div>
                </div>
              </label>
            ))}
          </div>
          <button
            className="mt-4 min-h-11 w-full rounded-md bg-stone-900 px-4 text-sm font-semibold text-white"
            onClick={onApply}
            type="button"
          >
            Apply approved changes
          </button>
        </div>
      )}
    </section>
  );
}

function TextInput({
  error,
  id,
  label,
  list,
  onChange,
  type = "text",
  value,
}: {
  error?: string;
  id?: string;
  label: string;
  list?: string;
  onChange: (value: string) => void;
  type?: string;
  value: string;
}) {
  return (
    <label>
      <span className="text-sm font-medium text-stone-700">{label}</span>
      <input
        className="mt-2 min-h-12 w-full rounded-md border border-stone-300 px-3 text-sm outline-none focus:border-stone-900"
        id={id}
        list={list}
        onChange={(event) => onChange(event.target.value)}
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
        className="mt-2 min-h-12 w-full rounded-md border border-stone-300 bg-white px-3 text-sm"
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

function NumberInput({
  error,
  label,
  onChange,
  step,
  unit,
  value,
}: {
  error?: string;
  label: string;
  onChange: (value: string) => void;
  step: string;
  unit: string;
  value: number | string;
}) {
  return (
    <label>
      <span className="text-sm font-medium text-stone-700">{label}</span>
      <div className="mt-2 flex min-h-12 rounded-md border border-stone-300 focus-within:border-stone-900">
        <input
          className="min-w-0 flex-1 px-3 text-sm outline-none"
          min="0"
          onChange={(event) => onChange(event.target.value)}
          step={step}
          type="number"
          value={value}
        />
        <span className="self-center pr-3 text-xs text-stone-500">{unit}</span>
      </div>
      {error && <p className="mt-2 text-sm font-medium text-red-700">{error}</p>}
    </label>
  );
}
