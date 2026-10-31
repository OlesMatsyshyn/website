import {
  type FoodCategory,
  type FoodItem,
  type FoodMetadataEntry,
  type LibraryBeverageType,
  type NutritionValues,
} from "@/lib/food-library";

export type BulkFoodDraft = Omit<
  FoodItem,
  | "id"
  | "countryCode"
  | "isSeedItem"
  | "clonedFromId"
  | "createdAt"
  | "updatedAt"
>;

export type BulkFoodImportItem =
  | { draft: BulkFoodDraft; index: number; status: "ready" }
  | { draft: BulkFoodDraft; index: number; status: "duplicate" }
  | { errors: string[]; index: number; name: string; status: "invalid" };

export type BulkFoodImportPreview = {
  error: string | null;
  items: BulkFoodImportItem[];
};

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

const beverageTypes: LibraryBeverageType[] = [
  "tap-water",
  "still-water",
  "sparkling-water",
  "sweet-soda",
  "zero-soda",
  "coffee",
  "tea",
  "juice",
  "milk-dairy",
  "other",
];

const nutritionFields: Array<{
  aliases: string[];
  key: keyof NutritionValues;
  label: string;
}> = [
  { aliases: ["calories", "caloriesKcal"], key: "caloriesKcal", label: "Calories" },
  { aliases: ["protein", "proteinG"], key: "proteinG", label: "Protein" },
  {
    aliases: ["carbohydrates", "carbs", "carbohydratesG"],
    key: "carbohydratesG",
    label: "Carbohydrates",
  },
  { aliases: ["fat", "totalFat", "totalFatG"], key: "totalFatG", label: "Total fat" },
  {
    aliases: ["saturatedFat", "saturatedFatG"],
    key: "saturatedFatG",
    label: "Saturated fat",
  },
  { aliases: ["sugar", "sugars", "sugarsG"], key: "sugarsG", label: "Sugars" },
  { aliases: ["fibre", "fiber", "fibreG"], key: "fibreG", label: "Fibre" },
  { aliases: ["sodium", "sodiumMg"], key: "sodiumMg", label: "Sodium" },
];

function stripOuterCodeFence(value: string) {
  const trimmed = value.trim();
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match ? match[1].trim() : trimmed;
}

function normalizeDuplicatePart(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

export function bulkFoodDuplicateKey(name: string, servingLabel: string) {
  return `${normalizeDuplicatePart(name)}|${normalizeDuplicatePart(servingLabel)}`;
}

function optionalString(record: Record<string, unknown>, key: string) {
  return typeof record[key] === "string" ? record[key].trim() : "";
}

function optionalNumber(
  record: Record<string, unknown>,
  aliases: string[],
  label: string,
  errors: string[],
) {
  const alias = aliases.find((key) => record[key] !== undefined && record[key] !== null);
  if (!alias) return null;
  const value = record[alias];
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    errors.push(`${label} must be a non-negative number.`);
    return null;
  }
  return value;
}

function metadataFromDetails(value: unknown, index: number): FoodMetadataEntry[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.entries(value as Record<string, unknown>)
    .filter(([, entryValue]) =>
      typeof entryValue === "string" ||
      typeof entryValue === "number" ||
      typeof entryValue === "boolean",
    )
    .map(([label, entryValue], detailIndex) => ({
      id: `bulk-detail-${index + 1}-${detailIndex + 1}`,
      label: label.trim(),
      value: String(entryValue).trim(),
    }))
    .filter((entry) => entry.label && entry.value);
}

function parseDraft(rawItem: unknown, index: number) {
  const errors: string[] = [];
  if (!rawItem || typeof rawItem !== "object" || Array.isArray(rawItem)) {
    return { errors: ["Item must be a JSON object."], name: `Item ${index + 1}` };
  }

  const record = rawItem as Record<string, unknown>;
  const name = optionalString(record, "name");
  if (!name) errors.push("Name is required.");

  const rawType = record.type ?? "food";
  const type = rawType === "drink" ? "drink" : "food";
  if (rawType !== "food" && rawType !== "drink") {
    errors.push('Type must be "food" or "drink".');
  }

  const rawCategory = record.category;
  let category: FoodCategory = type === "drink" ? "drink" : "other";
  if (rawCategory !== undefined) {
    if (typeof rawCategory === "string" && foodCategories.includes(rawCategory as FoodCategory)) {
      category = rawCategory as FoodCategory;
    } else {
      errors.push("Category is not recognized.");
    }
  }
  if (type === "drink") category = "drink";

  const rawBeverageType = record.beverageType;
  let beverageType: LibraryBeverageType | undefined;
  if (type === "drink") {
    beverageType = "other";
    if (rawBeverageType !== undefined) {
      if (
        typeof rawBeverageType === "string" &&
        beverageTypes.includes(rawBeverageType as LibraryBeverageType)
      ) {
        beverageType = rawBeverageType as LibraryBeverageType;
      } else {
        errors.push("Beverage type is not recognized.");
      }
    }
  }

  const nutrition: NutritionValues = {
    caloriesKcal: null,
    proteinG: null,
    carbohydratesG: null,
    totalFatG: null,
    saturatedFatG: null,
    sugarsG: null,
    fibreG: null,
    sodiumMg: null,
  };
  let hasNutrition = false;
  for (const field of nutritionFields) {
    const supplied = field.aliases.some(
      (alias) => record[alias] !== undefined && record[alias] !== null,
    );
    const value = optionalNumber(record, field.aliases, field.label, errors);
    nutrition[field.key] = value;
    if (supplied && value !== null) hasNutrition = true;
  }

  const servingLabel = optionalString(record, "serving") || "Serving not specified";
  const servingWeightG = optionalNumber(
    record,
    ["servingWeightG"],
    "Serving weight",
    errors,
  );
  const explicitServingVolumeMl = optionalNumber(
    record,
    ["volumeMl", "servingVolumeMl"],
    "Serving volume",
    errors,
  );
  const servingNumber = Number.parseFloat(servingLabel.replace(",", "."));
  const servingVolumeMl =
    explicitServingVolumeMl ??
    (type === "drink" && Number.isFinite(servingNumber) && servingNumber > 0
      ? servingNumber
      : null);
  const pricePaidSgd = optionalNumber(record, ["price", "pricePaidSgd"], "Price", errors);
  const uncertaintyPercent = optionalNumber(
    record,
    ["uncertaintyPercent"],
    "Uncertainty",
    errors,
  );
  if (uncertaintyPercent !== null && uncertaintyPercent > 100) {
    errors.push("Uncertainty must be between 0 and 100.");
  }

  const description = optionalString(record, "description");
  const notes = optionalString(record, "notes");
  const collectionName = optionalString(record, "collection") || null;
  const locationName = optionalString(record, "location") || null;
  const assumptions = notes ? [notes] : [];
  const metadataEntries = metadataFromDetails(record.details, index);

  if (errors.length > 0) return { errors, name: name || `Item ${index + 1}` };

  const draft: BulkFoodDraft = {
    name,
    description: description || notes || name,
    brand: optionalString(record, "brand") || null,
    servingLabel,
    locationName,
    collectionName: collectionName ?? (type === "drink" ? "Drinks" : null),
    category,
    logDestination: type === "drink" ? "hydration" : "food",
    servingVolumeMl: type === "drink" ? servingVolumeMl : undefined,
    beverageType,
    nutrition: hasNutrition ? nutrition : null,
    nutritionStatus: hasNutrition ? "estimated" : "missing",
    uncertaintyPercent: hasNutrition ? uncertaintyPercent ?? 25 : null,
    sourceLabel: optionalString(record, "source") || null,
    sourceUrl: null,
    lastVerifiedAt: null,
    assumptions,
    usualStore: optionalString(record, "store") || null,
    pricePaidSgd,
    packageOrPurchaseWeight: optionalString(record, "packageWeight") || null,
    purchaseDate: optionalString(record, "purchaseDate") || null,
    metadataEntries,
    userRating: null,
    creatorRating: null,
    importedFromPack: null,
    photoPending: false,
    exactNamePending: false,
    portionVerificationPending: false,
    servingWeightG,
    needsNutritionReview: !hasNutrition,
    reviewReason: null,
    reviewNote: null,
    referencePhoto: null,
  };

  return { draft, errors: [], name };
}

export function previewBulkFoodImport(
  raw: string,
  existingFoods: FoodItem[],
): BulkFoodImportPreview {
  if (!raw.trim()) return { error: null, items: [] };

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripOuterCodeFence(raw));
  } catch {
    return { error: "Paste a valid JSON array or an object with an items array.", items: [] };
  }

  const rawItems = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === "object" && Array.isArray((parsed as { items?: unknown }).items)
      ? (parsed as { items: unknown[] }).items
      : null;
  if (!rawItems) {
    return { error: "JSON must be an array or an object with an items array.", items: [] };
  }

  const duplicateKeys = new Set(
    existingFoods.map((food) => bulkFoodDuplicateKey(food.name, food.servingLabel)),
  );
  const seenImportKeys = new Set<string>();
  const items = rawItems.map((rawItem, index): BulkFoodImportItem => {
    const parsedItem = parseDraft(rawItem, index);
    if (!parsedItem.draft) {
      return {
        errors: parsedItem.errors,
        index,
        name: parsedItem.name,
        status: "invalid",
      };
    }

    const key = bulkFoodDuplicateKey(parsedItem.draft.name, parsedItem.draft.servingLabel);
    const duplicate = duplicateKeys.has(key) || seenImportKeys.has(key);
    seenImportKeys.add(key);
    return {
      draft: parsedItem.draft,
      index,
      status: duplicate ? "duplicate" : "ready",
    };
  });

  return { error: null, items };
}

export function createFoodItemFromBulkDraft(
  draft: BulkFoodDraft,
  id: string,
  timestamp: string,
): FoodItem {
  return {
    ...draft,
    id,
    countryCode: "SG",
    isSeedItem: false,
    clonedFromId: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function buildBulkFoodImportTemplate() {
  return `Create a JSON array of WellCanvas reusable food/drink items.

Name is required. Type may be "food" or "drink" and defaults to "food". Include a realistic serving size and nutrition only when known or reasonably estimated. Do not invent unnecessary fields. Return JSON only, without Markdown or commentary.

Supported schema:
[
  {
    "name": "Required item name",
    "type": "food",
    "serving": "Optional serving label",
    "calories": 0,
    "protein": 0,
    "carbohydrates": 0,
    "fat": 0,
    "saturatedFat": 0,
    "sugars": 0,
    "fibre": 0,
    "sodium": 0,
    "description": "Optional factual description",
    "brand": "Optional brand",
    "collection": "Optional library group",
    "category": "Optional WellCanvas food category",
    "notes": "Optional assumptions or notes",
    "details": { "Label": "Optional value" }
  }
]

Nutrition units are kcal for calories, grams for protein/carbohydrates/fat/saturatedFat/sugars/fibre, and milligrams for sodium.

Examples:
[
  {
    "name": "Chicken rice",
    "type": "food",
    "serving": "1 plate",
    "calories": 650,
    "protein": 30
  },
  {
    "name": "Coke Zero",
    "type": "drink",
    "serving": "330 ml",
    "volumeMl": 330,
    "calories": 0,
    "protein": 0,
    "beverageType": "zero-soda"
  }
]`;
}
