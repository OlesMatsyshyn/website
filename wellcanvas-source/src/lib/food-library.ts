export type NutritionValues = {
  caloriesKcal: number | null;
  proteinG: number | null;
  carbohydratesG: number | null;
  totalFatG: number | null;
  saturatedFatG: number | null;
  sugarsG?: number | null;
  fibreG: number | null;
  sodiumMg: number | null;
};

export type NutritionStatus =
  | "missing"
  | "estimated"
  | "user-confirmed"
  | "official";

export type FoodCategory =
  | "breakfast"
  | "restaurant-meal"
  | "fruit"
  | "vegetable"
  | "nuts-seeds"
  | "grain-starch"
  | "protein"
  | "dairy"
  | "processed-snack"
  | "drink"
  | "meal-component"
  | "other";

export type LibraryLogDestination = "food" | "hydration";

export type LibraryBeverageType =
  | "tap-water"
  | "still-water"
  | "sparkling-water"
  | "sweet-soda"
  | "zero-soda"
  | "coffee"
  | "tea"
  | "juice"
  | "milk-dairy"
  | "other";

export type FoodMetadataEntry = {
  id: string;
  label: string;
  value: string;
};

export type PersonalFoodRating = 1 | 2 | 3 | 4 | 5;

export type FoodItem = {
  id: string;
  name: string;
  description: string;
  brand: string | null;
  servingLabel: string;
  locationName: string | null;
  collectionName: string | null;
  category?: FoodCategory;
  logDestination?: LibraryLogDestination;
  servingVolumeMl?: number | null;
  beverageType?: LibraryBeverageType;
  countryCode: "SG";
  nutrition: NutritionValues | null;
  nutritionStatus: NutritionStatus;
  uncertaintyPercent: number | null;
  sourceLabel: string | null;
  sourceUrl: string | null;
  lastVerifiedAt: string | null;
  assumptions: string[];
  usualStore?: string | null;
  pricePaidSgd?: number | null;
  packageOrPurchaseWeight?: string | null;
  purchaseDate?: string | null;
  metadataEntries?: FoodMetadataEntry[];
  userRating?: PersonalFoodRating | null;
  creatorRating?: PersonalFoodRating | null;
  importedFromPack?: string | null;
  photoPending?: boolean;
  exactNamePending?: boolean;
  portionVerificationPending?: boolean;
  servingWeightG?: number | null;
  needsNutritionReview?: boolean;
  reviewReason?: string | null;
  reviewNote?: string | null;
  referencePhoto?: FoodReferencePhotoMetadata | null;
  isSeedItem: boolean;
  clonedFromId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MealTemplateItem = {
  foodItemId: string;
  quantity: number;
};

export type MealTemplate = {
  id: string;
  name: string;
  description: string;
  mealType: "breakfast" | "lunch" | "dinner" | "snack";
  locationName: string | null;
  collectionName: string | null;
  estimatedPriceSgd: number | null;
  metadataEntries?: FoodMetadataEntry[];
  userRating?: PersonalFoodRating | null;
  creatorRating?: PersonalFoodRating | null;
  importedFromPack?: string | null;
  items: MealTemplateItem[];
  needsNutritionReview?: boolean;
  reviewReason?: string | null;
  reviewNote?: string | null;
  referencePhoto?: FoodReferencePhotoMetadata | null;
  manualNutritionOverride?: {
    nutrition: NutritionValues;
    nutritionStatus: NutritionStatus;
    sourceLabel: string | null;
    assumptions: string[];
    updatedAt: string;
  } | null;
  isSeedItem: boolean;
  clonedFromId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SeedPackInstall = {
  packId: string;
  version: number;
  importedAt: string;
  updatedAt: string;
};

export type LibraryVisibilityPreferences = {
  hiddenEntityKeys: string[];
  updatedAt: string;
};

export type FoodReferencePhotoMetadata = {
  id: string;
  foodItemId: string | null;
  mealTemplateId: string | null;
  createdAt: string;
  fileName: string;
  mimeType: string;
  reviewStatus: "pending" | "reviewed";
};

export type FoodAiUpdate = {
  id: string;
  name: string;
  description: string;
  servingLabel: string;
  nutrition: NutritionValues;
  nutritionStatus: "estimated";
  uncertaintyPercent: number;
  assumptions: string[];
};

export type ValidatedFoodAiUpdate = {
  id: string;
  current: FoodItem;
  update: FoodAiUpdate;
  approved: boolean;
};

export type MealNutritionResult = {
  nutrition: NutritionValues | null;
  isComplete: boolean;
  status: NutritionStatus;
  missingFoodIds: string[];
};

const CREATED_AT = "2026-08-02T00:00:00.000+08:00";
export const FOOD_ITEMS_STORAGE_KEY = "health-tracker-pwa.food-items.v1";
export const MEAL_TEMPLATES_STORAGE_KEY =
  "health-tracker-pwa.meal-templates.v1";
export const SEED_PACKS_STORAGE_KEY = "health-tracker-pwa.seed-packs.v1";
export const LIBRARY_VISIBILITY_STORAGE_KEY =
  "health-tracker-pwa.library-visibility.v1";
export const STARTER_FOOD_LIBRARY_PACK_ID = "wellcanvas-starter-foods-v1";
export const STARTER_FOOD_LIBRARY_PACK_VERSION = 1;

export const PREFERRED_COLLECTION_ORDER = [
  "Home",
  "Home meals",
  "Ingredients",
  "Fruit",
  "Vegetables",
  "Nuts and seeds",
  "Snacks",
  "Drinks",
  "Restaurants",
  "Groceries",
  "Other restaurants",
  "Other",
];

const nutrientKeys = [
  "caloriesKcal",
  "proteinG",
  "carbohydratesG",
  "totalFatG",
  "saturatedFatG",
  "fibreG",
  "sodiumMg",
] as const;

function nutrition(values: NutritionValues): NutritionValues {
  return values;
}

function collectionFromPlaceParts({
  id,
  brand,
  locationName,
}: {
  id: string;
  brand?: string | null;
  locationName?: string | null;
}) {
  const explicitSeedCollections: Record<string, string> = {
    "black-coffee-no-sugar": "Groceries",
    "coffee-with-milk-creamer": "Groceries",
    "teaspoon-sugar": "Groceries",
    "vietnamese-drip-coffee-condensed-milk": "Groceries",
    "egg-coffee": "Groceries",
    "two-soft-boiled-eggs": "Home",
    "soy-sauce-pepper-serving": "Home",
  };

  if (explicitSeedCollections[id]) {
    return explicitSeedCollections[id];
  }

  if (locationName === "Home") return "Home";
  if (brand || locationName) return brand ?? locationName ?? "Other";
  return "Other";
}

export function collectionForFood(food: FoodItem) {
  return (
    food.collectionName?.trim() ||
    food.locationName?.trim() ||
    food.brand?.trim() ||
    "Other"
  );
}

export function collectionForMeal(meal: MealTemplate) {
  return meal.collectionName?.trim() || meal.locationName?.trim() || "Other";
}

export function categoryForFood(food: FoodItem): FoodCategory {
  if (food.category) return food.category;

  const text = [
    food.id,
    food.name,
    food.description,
    food.brand,
    food.locationName,
    food.collectionName,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (food.collectionName === "Fruits" || text.includes("fruit")) return "fruit";
  if (food.collectionName === "Vegetables" || text.includes("broccoli") || text.includes("cucumber") || text.includes("tomato") || text.includes("carrot")) return "vegetable";
  if (food.collectionName === "Nuts and seeds" || text.includes("nuts") || text.includes("almonds") || text.includes("cashews") || text.includes("peanuts")) return "nuts-seeds";
  if (food.collectionName === "Snacks" || text.includes("chips") || text.includes("chocolate") || text.includes("doughnut") || text.includes("pastry")) return "processed-snack";
  if (text.includes("coffee") || text.includes("drink") || text.includes("soda")) return "drink";
  if (text.includes("restaurant") || text.includes("burrito") || text.includes("kebab")) return "restaurant-meal";
  if (text.includes("chicken breast") || text.includes("beef") || text.includes("pork") || text.includes("fish") || text.includes("salmon") || text.includes("prawns") || text.includes("egg")) return "protein";
  if (text.includes("rice") || text.includes("pasta") || text.includes("buckwheat") || text.includes("potato") || text.includes("bread")) return "grain-starch";
  if (food.collectionName === "Home meal components") return "meal-component";
  if (food.collectionName === "Home") return "breakfast";
  return "other";
}

export function logDestinationForFood(food: FoodItem): LibraryLogDestination {
  if (food.logDestination === "food" || food.logDestination === "hydration") {
    return food.logDestination;
  }
  return categoryForFood(food) === "drink" ? "hydration" : "food";
}

export function beverageTypeForFood(food: FoodItem): LibraryBeverageType {
  const value = food.beverageType;
  if (
    value === "tap-water" ||
    value === "still-water" ||
    value === "sparkling-water" ||
    value === "sweet-soda" ||
    value === "zero-soda" ||
    value === "coffee" ||
    value === "tea" ||
    value === "other"
  ) {
    return value;
  }
  return "other";
}

export function sortCollectionNames(collections: string[]) {
  return [...collections].sort((a, b) => {
    const aIndex = PREFERRED_COLLECTION_ORDER.indexOf(a);
    const bIndex = PREFERRED_COLLECTION_ORDER.indexOf(b);

    if (aIndex !== -1 || bIndex !== -1) {
      return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
    }

    return a.localeCompare(b);
  });
}

function foodItem(
  item: Omit<
    FoodItem,
    | "brand"
    | "locationName"
    | "collectionName"
    | "countryCode"
    | "sourceUrl"
    | "lastVerifiedAt"
    | "clonedFromId"
    | "createdAt"
    | "updatedAt"
  > & {
    brand?: string | null;
    locationName?: string | null;
    collectionName?: string | null;
    sourceUrl?: string | null;
    lastVerifiedAt?: string | null;
    clonedFromId?: string | null;
  },
): FoodItem {
  const nextItem = {
    ...item,
    brand: item.brand ?? null,
    locationName: item.locationName ?? null,
    collectionName:
      item.collectionName ??
      collectionFromPlaceParts({
        id: item.id,
        brand: item.brand,
        locationName: item.locationName,
    }),
    countryCode: "SG" as const,
    sourceUrl: item.sourceUrl ?? null,
    lastVerifiedAt: item.lastVerifiedAt ?? null,
    clonedFromId: item.clonedFromId ?? null,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
  };
  return {
    ...nextItem,
    category: item.category ?? categoryForFood(nextItem),
    logDestination:
      item.logDestination ?? (categoryForFood(nextItem) === "drink" ? "hydration" : "food"),
    servingVolumeMl: item.servingVolumeMl ?? null,
    beverageType: item.beverageType ?? (categoryForFood(nextItem) === "drink" ? "other" : undefined),
    metadataEntries: item.metadataEntries ?? [],
    userRating: item.userRating ?? null,
    creatorRating: item.creatorRating ?? null,
    importedFromPack: item.importedFromPack ?? null,
  };
}

export const starterSeedFoods: FoodItem[] = [
  foodItem({
    id: "starter-banana-100g",
    name: "Banana",
    description: "Generic starter entry for a medium banana.",
    servingLabel: "1 medium banana, 100 g",
    servingWeightG: 100,
    collectionName: "Fruit",
    category: "fruit",
    nutrition: nutrition({ caloriesKcal: 89, proteinG: 1.1, carbohydratesG: 22.8, totalFatG: 0.3, saturatedFatG: 0.1, fibreG: 2.6, sodiumMg: 1 }),
    nutritionStatus: "estimated",
    uncertaintyPercent: 20,
    sourceLabel: "Generic food composition estimate",
    assumptions: ["Starter value; replace with local product values when useful"],
    isSeedItem: true,
  }),
  foodItem({
    id: "starter-apple-150g",
    name: "Apple",
    description: "Generic starter entry for a medium apple.",
    servingLabel: "1 medium apple, 150 g",
    servingWeightG: 150,
    collectionName: "Fruit",
    category: "fruit",
    nutrition: nutrition({ caloriesKcal: 78, proteinG: 0.4, carbohydratesG: 20.7, totalFatG: 0.3, saturatedFatG: 0.1, fibreG: 3.6, sodiumMg: 2 }),
    nutritionStatus: "estimated",
    uncertaintyPercent: 20,
    sourceLabel: "Generic food composition estimate",
    assumptions: ["Starter value; replace with local product values when useful"],
    isSeedItem: true,
  }),
  foodItem({
    id: "starter-cooked-rice-150g",
    name: "Cooked rice",
    description: "Generic starter entry for cooked white rice.",
    servingLabel: "1 bowl, 150 g",
    servingWeightG: 150,
    collectionName: "Ingredients",
    category: "grain-starch",
    nutrition: nutrition({ caloriesKcal: 195, proteinG: 4.1, carbohydratesG: 42.9, totalFatG: 0.4, saturatedFatG: 0.1, fibreG: 0.6, sodiumMg: 2 }),
    nutritionStatus: "estimated",
    uncertaintyPercent: 20,
    sourceLabel: "Generic food composition estimate",
    assumptions: ["Starter value; replace with local product values when useful"],
    isSeedItem: true,
  }),
  foodItem({
    id: "starter-boiled-egg",
    name: "Boiled egg",
    description: "Generic starter entry for one large boiled egg.",
    servingLabel: "1 large egg",
    servingWeightG: 50,
    collectionName: "Ingredients",
    category: "protein",
    nutrition: nutrition({ caloriesKcal: 78, proteinG: 6.3, carbohydratesG: 0.6, totalFatG: 5.3, saturatedFatG: 1.6, fibreG: 0, sodiumMg: 62 }),
    nutritionStatus: "estimated",
    uncertaintyPercent: 20,
    sourceLabel: "Generic food composition estimate",
    assumptions: ["Starter value; replace with local product values when useful"],
    isSeedItem: true,
  }),
  foodItem({
    id: "starter-black-coffee-250ml",
    name: "Black coffee",
    description: "Reusable starter drink with no sugar or milk added.",
    servingLabel: "1 cup",
    servingVolumeMl: 250,
    collectionName: "Drinks",
    category: "drink",
    logDestination: "hydration",
    beverageType: "coffee",
    nutrition: nutrition({ caloriesKcal: 2, proteinG: 0.3, carbohydratesG: 0, totalFatG: 0, saturatedFatG: 0, fibreG: 0, sodiumMg: 5 }),
    nutritionStatus: "estimated",
    uncertaintyPercent: 15,
    sourceLabel: "Generic brewed coffee estimate",
    assumptions: ["No sugar or milk added"],
    isSeedItem: true,
  }),
  foodItem({
    id: "starter-water-250ml",
    name: "Water",
    description: "Reusable starter drink for plain water.",
    servingLabel: "1 glass",
    servingVolumeMl: 250,
    collectionName: "Drinks",
    category: "drink",
    logDestination: "hydration",
    beverageType: "tap-water",
    nutrition: nutrition({ caloriesKcal: 0, proteinG: 0, carbohydratesG: 0, totalFatG: 0, saturatedFatG: 0, fibreG: 0, sodiumMg: 0 }),
    nutritionStatus: "estimated",
    uncertaintyPercent: 0,
    sourceLabel: "Plain water",
    assumptions: [],
    isSeedItem: true,
  }),
];

export const starterSnackSeedFoods: FoodItem[] = [];
export const starterSeedMeals: MealTemplate[] = [];

function uniqueFoodsById(foods: FoodItem[]) {
  return [...new Map(foods.map((food) => [food.id, food])).values()];
}

export function starterLibrarySeedFoods() {
  return uniqueFoodsById(starterSeedFoods);
}

function canUseStorage() {
  return typeof window !== "undefined";
}

function readJson<T>(key: string, fallback: T): T {
  if (!canUseStorage()) {
    return fallback;
  }

  try {
    const rawValue = window.localStorage.getItem(key);
    return rawValue ? (JSON.parse(rawValue) as T) : fallback;
  } catch {
    return fallback;
  }
}

function saveJson<T>(key: string, value: T) {
  if (canUseStorage()) {
    window.localStorage.setItem(key, JSON.stringify(value));
  }
}

function normalizeFoodMetadataEntries(value: unknown): FoodMetadataEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry, index) => {
      const record =
        entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {};
      const label = typeof record.label === "string" ? record.label.trim() : "";
      const entryValue = typeof record.value === "string" ? record.value.trim() : "";
      if (!label || !entryValue) return null;
      return {
        id:
          typeof record.id === "string" && record.id.trim()
            ? record.id.trim()
            : `detail-${index + 1}`,
        label,
        value: entryValue,
      };
    })
    .filter((entry): entry is FoodMetadataEntry => Boolean(entry));
}

function normalizePersonalFoodRating(value: unknown): PersonalFoodRating | null {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5
    ? value
    : null;
}

export function readFoodItems() {
  return readJson<FoodItem[]>(FOOD_ITEMS_STORAGE_KEY, []).map((item) => {
    const normalized = { 
      ...item,
      collectionName: item.collectionName ?? null,
      logDestination:
        item.logDestination ?? (categoryForFood(item) === "drink" ? "hydration" : "food"),
      servingVolumeMl: item.servingVolumeMl ?? null,
      beverageType:
        item.beverageType ?? (categoryForFood(item) === "drink" ? "other" : undefined),
      usualStore: item.usualStore ?? null,
      pricePaidSgd: item.pricePaidSgd ?? null,
      packageOrPurchaseWeight: item.packageOrPurchaseWeight ?? null,
      purchaseDate: item.purchaseDate ?? null,
      metadataEntries: normalizeFoodMetadataEntries(item.metadataEntries),
      userRating: normalizePersonalFoodRating(item.userRating),
      creatorRating: normalizePersonalFoodRating(item.creatorRating),
      importedFromPack: item.importedFromPack ?? null,
      photoPending: item.photoPending ?? false,
      exactNamePending: item.exactNamePending ?? false,
      portionVerificationPending: item.portionVerificationPending ?? false,
      servingWeightG: item.servingWeightG ?? null,
      needsNutritionReview: item.needsNutritionReview ?? false,
      reviewReason: item.reviewReason ?? null,
      reviewNote: item.reviewNote ?? null,
      referencePhoto: item.referencePhoto ?? null,
    };

    return {
      ...normalized,
      category: normalized.category ?? categoryForFood(normalized),
    };
  });
}

export function saveFoodItems(items: FoodItem[]) {
  saveJson(FOOD_ITEMS_STORAGE_KEY, items);
}

export function readMealTemplates() {
  return readJson<MealTemplate[]>(MEAL_TEMPLATES_STORAGE_KEY, []).map((meal) => ({
    ...meal,
    collectionName: meal.collectionName ?? null,
    metadataEntries: normalizeFoodMetadataEntries(meal.metadataEntries),
    userRating: normalizePersonalFoodRating(meal.userRating),
    creatorRating: normalizePersonalFoodRating(meal.creatorRating),
    importedFromPack: meal.importedFromPack ?? null,
    needsNutritionReview: meal.needsNutritionReview ?? false,
    reviewReason: meal.reviewReason ?? null,
    reviewNote: meal.reviewNote ?? null,
    referencePhoto: meal.referencePhoto ?? null,
    manualNutritionOverride: meal.manualNutritionOverride ?? null,
  }));
}

export function saveMealTemplates(meals: MealTemplate[]) {
  saveJson(MEAL_TEMPLATES_STORAGE_KEY, meals);
}

export function readLibraryVisibilityPreferences(): LibraryVisibilityPreferences {
  const stored = readJson<Partial<LibraryVisibilityPreferences>>(
    LIBRARY_VISIBILITY_STORAGE_KEY,
    {},
  );
  return {
    hiddenEntityKeys: Array.isArray(stored.hiddenEntityKeys)
      ? stored.hiddenEntityKeys.filter((key): key is string => typeof key === "string")
      : [],
    updatedAt: typeof stored.updatedAt === "string" ? stored.updatedAt : "",
  };
}

export function saveLibraryVisibilityPreferences(
  preferences: LibraryVisibilityPreferences,
) {
  saveJson(LIBRARY_VISIBILITY_STORAGE_KEY, preferences);
}

export function readSeedPacks() {
  return readJson<Record<string, SeedPackInstall>>(SEED_PACKS_STORAGE_KEY, {});
}

export function saveSeedPacks(seedPacks: Record<string, SeedPackInstall>) {
  saveJson(SEED_PACKS_STORAGE_KEY, seedPacks);
}

export function isStarterFoodLibraryInstalled() {
  return Boolean(readSeedPacks()[STARTER_FOOD_LIBRARY_PACK_ID]);
}

function canApplySeedCollection(existing: { isSeedItem: boolean; clonedFromId: string | null; collectionName?: string | null }) {
  return existing.isSeedItem && existing.clonedFromId === null && !existing.collectionName?.trim();
}

function importFoodSeedPack({ foods, packId, version }: { foods: FoodItem[]; packId: string; version: number }) {
  const now = new Date().toISOString();
  const currentFoods = readFoodItems();
  const currentFoodIds = new Set(currentFoods.map((item) => item.id));
  const seedFoodById = new Map(foods.map((item) => [item.id, item]));
  const missingFoods = foods.filter((item) => !currentFoodIds.has(item.id));
  const revisedFoods = currentFoods.map((item) => {
    const seed = seedFoodById.get(item.id);
    if (seed && canApplySeedCollection(item)) {
      return { ...item, collectionName: seed.collectionName, category: item.category ?? seed.category ?? categoryForFood(seed) };
    }
    return { ...item, collectionName: item.collectionName ?? null, category: item.category ?? (seed ? seed.category : categoryForFood(item)) };
  });
  const seedPacks = readSeedPacks();
  const existingInstall = seedPacks[packId];
  saveFoodItems([...revisedFoods, ...missingFoods]);
  saveSeedPacks({
    ...seedPacks,
    [packId]: { packId, version, importedAt: existingInstall?.importedAt ?? now, updatedAt: now },
  });
  return { addedFoodCount: missingFoods.length, addedMealCount: 0 };
}

export function importStarterFoodLibrarySeedPack() {
  return importFoodSeedPack({
    foods: starterLibrarySeedFoods(),
    packId: STARTER_FOOD_LIBRARY_PACK_ID,
    version: STARTER_FOOD_LIBRARY_PACK_VERSION,
  });
}

export function syncInstalledSeedPack() {
  return { addedFoodCount: 0, addedMealCount: 0 };
}

export function makeCopyId(id: string, existingIds: Set<string>) {
  let index = 1;
  let nextId = `${id}-copy`;

  while (existingIds.has(nextId)) {
    index += 1;
    nextId = `${id}-copy-${index}`;
  }

  return nextId;
}

export function duplicateFoodItem(item: FoodItem, existingItems: FoodItem[]) {
  const now = new Date().toISOString();
  return {
    ...item,
    id: makeCopyId(item.id, new Set(existingItems.map((food) => food.id))),
    name: `${item.name} Copy`,
    isSeedItem: false,
    clonedFromId: item.clonedFromId ?? item.id,
    createdAt: now,
    updatedAt: now,
  };
}

export function duplicateMealTemplate(
  meal: MealTemplate,
  existingMeals: MealTemplate[],
) {
  const now = new Date().toISOString();
  return {
    ...meal,
    id: makeCopyId(meal.id, new Set(existingMeals.map((entry) => entry.id))),
    name: `${meal.name} Copy`,
    isSeedItem: false,
    clonedFromId: meal.clonedFromId ?? meal.id,
    createdAt: now,
    updatedAt: now,
  };
}

function isCompleteNutrition(nutritionValue: NutritionValues | null) {
  return Boolean(
    nutritionValue &&
      nutrientKeys.every((key) => typeof nutritionValue[key] === "number"),
  );
}

function completeNutrition(nutritionValue: NutritionValues | null) {
  return isCompleteNutrition(nutritionValue)
    ? (nutritionValue as Record<keyof NutritionValues, number>)
    : null;
}

export function calculateMealNutrition(
  meal: MealTemplate,
  foods: FoodItem[],
): MealNutritionResult {
  if (meal.manualNutritionOverride) {
    return {
      nutrition: meal.manualNutritionOverride.nutrition,
      isComplete: isCompleteNutrition(meal.manualNutritionOverride.nutrition),
      status: meal.manualNutritionOverride.nutritionStatus,
      missingFoodIds: [],
    };
  }

  if (meal.items.length === 0) {
    return {
      nutrition: null,
      isComplete: false,
      status: "missing",
      missingFoodIds: [],
    };
  }

  const foodById = new Map(foods.map((food) => [food.id, food]));
  const totals = Object.fromEntries(nutrientKeys.map((key) => [key, 0])) as Record<
    keyof NutritionValues,
    number
  >;
  const missingFoodIds: string[] = [];
  const statuses: NutritionStatus[] = [];

  for (const component of meal.items) {
    const food = foodById.get(component.foodItemId);
    const foodNutrition = food ? completeNutrition(food.nutrition) : null;
    if (
      !food ||
      !Number.isFinite(component.quantity) ||
      component.quantity < 0 ||
      !foodNutrition
    ) {
      missingFoodIds.push(component.foodItemId);
      continue;
    }

    statuses.push(food.nutritionStatus);
    for (const key of nutrientKeys) {
      totals[key] += foodNutrition[key] * component.quantity;
    }
  }

  if (missingFoodIds.length > 0) {
    return {
      nutrition: null,
      isComplete: false,
      status: "missing",
      missingFoodIds,
    };
  }

  const status: NutritionStatus = statuses.every((entry) => entry === "official")
    ? "official"
    : statuses.every((entry) => entry === "official" || entry === "user-confirmed")
      ? "user-confirmed"
      : "estimated";

  return {
    nutrition: totals,
    isComplete: true,
    status,
    missingFoodIds: [],
  };
}

export function nutritionStatusLabel(status: NutritionStatus) {
  if (status === "official") return "Official";
  if (status === "user-confirmed") return "Confirmed";
  if (status === "estimated") return "Estimated";
  return "Needs nutrition";
}

export function buildFoodAiPrompt(
  items: FoodItem[],
  mealContext = "",
  hasReferencePhoto = items.some((item) => item.referencePhoto),
) {
  return JSON.stringify(
    {
      task:
        "Estimate missing nutrition values for existing food items in a local nutrition tracker. Return one valid JSON object only. Do not wrap it in Markdown.",
      rules: [
        "Do not change IDs.",
        "Estimate only missing values.",
        "Do not replace official or user-confirmed nutrition.",
        "Use estimated status for photograph-, description-, or generic-database-based values.",
        "Use a reasonable uncertainty percentage.",
        "Avoid exact-looking precision unsupported by the description.",
        "Keep restaurant names and locations factual.",
        "Do not add health judgements or dieting advice.",
        "State assumptions.",
        hasReferencePhoto
          ? "A reference photo exists. Attach it manually when sending this prompt to ChatGPT."
          : "No reference photo metadata was provided.",
      ],
      existingItems: items,
      mealOrFoodContext: mealContext,
      expectedSchema: {
        schemaVersion: "health-tracker-food-ai-v1",
        items: [
          {
            id: "existing-stable-id",
            name: "Clean display name",
            description: "Concise factual description",
            servingLabel: "One serving",
            nutrition: {
              caloriesKcal: 0,
              proteinG: 0,
              carbohydratesG: 0,
              totalFatG: 0,
              saturatedFatG: 0,
              fibreG: 0,
              sodiumMg: 0,
            },
            nutritionStatus: "estimated",
            uncertaintyPercent: 25,
            assumptions: ["Assumption one"],
          },
        ],
      },
    },
    null,
    2,
  );
}

function validateNutritionValues(value: unknown): value is NutritionValues {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as NutritionValues;
  return nutrientKeys.every((key) => {
    const nutrient = candidate[key];
    return typeof nutrient === "number" && Number.isFinite(nutrient) && nutrient >= 0;
  });
}

export function validateFoodAiResult(
  rawValue: string,
  currentFoods: FoodItem[],
): { updates: ValidatedFoodAiUpdate[]; error: string | null } {
  let parsed: unknown;

  try {
    parsed = JSON.parse(rawValue);
  } catch {
    return { updates: [], error: "Paste a valid JSON object." };
  }

  if (!parsed || typeof parsed !== "object") {
    return { updates: [], error: "The AI result must be a JSON object." };
  }

  const payload = parsed as { schemaVersion?: unknown; items?: unknown };
  if (payload.schemaVersion !== "health-tracker-food-ai-v1") {
    return { updates: [], error: "Schema version does not match." };
  }

  if (!Array.isArray(payload.items)) {
    return { updates: [], error: "The AI result must contain an items array." };
  }

  const foodById = new Map(currentFoods.map((food) => [food.id, food]));
  const seenIds = new Set<string>();
  const updates: ValidatedFoodAiUpdate[] = [];

  for (const item of payload.items) {
    if (!item || typeof item !== "object") {
      return { updates: [], error: "Every item must be an object." };
    }

    const update = item as FoodAiUpdate;
    if (typeof update.id !== "string" || !foodById.has(update.id)) {
      return { updates: [], error: "AI result contains an unknown food ID." };
    }

    if (seenIds.has(update.id)) {
      return { updates: [], error: "AI result contains duplicate food IDs." };
    }
    seenIds.add(update.id);

    const current = foodById.get(update.id)!;
    if (
      current.nutritionStatus === "official" ||
      current.nutritionStatus === "user-confirmed"
    ) {
      return {
        updates: [],
        error:
          "AI result includes official or user-confirmed food. These are not overwritten automatically.",
      };
    }

    if (
      typeof update.name !== "string" ||
      typeof update.description !== "string" ||
      typeof update.servingLabel !== "string" ||
      update.nutritionStatus !== "estimated" ||
      !validateNutritionValues(update.nutrition) ||
      typeof update.uncertaintyPercent !== "number" ||
      !Number.isFinite(update.uncertaintyPercent) ||
      update.uncertaintyPercent < 0 ||
      update.uncertaintyPercent > 100 ||
      !Array.isArray(update.assumptions) ||
      !update.assumptions.every((assumption) => typeof assumption === "string")
    ) {
      return {
        updates: [],
        error:
          "Each estimated item needs complete non-negative nutrition, uncertainty 0-100, and assumptions.",
      };
    }

    updates.push({ id: update.id, current, update, approved: true });
  }

  return { updates, error: null };
}

export function applyFoodAiUpdates(
  foods: FoodItem[],
  updates: ValidatedFoodAiUpdate[],
) {
  const approvedById = new Map(
    updates.filter((update) => update.approved).map((update) => [update.id, update]),
  );
  const now = new Date().toISOString();

  return foods.map((food) => {
    const approved = approvedById.get(food.id);
    if (!approved) {
      return food;
    }

    return {
      ...food,
      name: approved.update.name,
      description: approved.update.description,
      servingLabel: approved.update.servingLabel,
      nutrition: approved.update.nutrition,
      nutritionStatus: approved.update.nutritionStatus,
      uncertaintyPercent: approved.update.uncertaintyPercent,
      assumptions: approved.update.assumptions,
      sourceLabel: food.sourceLabel ?? "Manual AI estimate review",
      needsNutritionReview: false,
      reviewReason: null,
      referencePhoto: food.referencePhoto
        ? { ...food.referencePhoto, reviewStatus: "reviewed" as const }
        : null,
      updatedAt: now,
    };
  });
}
