"use client";

import { useMemo, useState } from "react";
import {
  createLogEntryFromFood,
  createLogEntryFromMeal,
  inferMealType,
  makeId,
  scaleNutrition,
  type FoodLogEntry,
} from "@/lib/food-log";
import {
  starterSnackSeedFoods,
  type FoodItem,
  type MealTemplate,
  type NutritionValues,
} from "@/lib/food-library";

const nutrientFields: Array<{
  key: keyof NutritionValues;
  label: string;
  unit: string;
}> = [
  { key: "caloriesKcal", label: "Calories", unit: "kcal" },
  { key: "proteinG", label: "Protein", unit: "g" },
  { key: "carbohydratesG", label: "Carbs", unit: "g" },
  { key: "totalFatG", label: "Fat", unit: "g" },
  { key: "saturatedFatG", label: "Saturated fat", unit: "g" },
  { key: "fibreG", label: "Fibre", unit: "g" },
  { key: "sodiumMg", label: "Sodium", unit: "mg" },
];

const emptyNutrition: NutritionValues = {
  caloriesKcal: 0,
  proteinG: 0,
  carbohydratesG: 0,
  totalFatG: 0,
  saturatedFatG: 0,
  fibreG: 0,
  sodiumMg: 0,
};

const baseIds = [
  "plate-boiled-potato-200g",
  "plate-sweet-potato-200g",
  "plate-cooked-pasta-180g",
  "plate-cooked-buckwheat-180g",
  "plate-cooked-green-peas-160g",
  "plate-cooked-white-rice-180g",
];

const vegetableIds = [
  "plate-plain-lettuce-vegetable-salad-150g",
  "plate-mixed-salad-light-dressing-bowl",
  "plate-feta-cheese-40g",
];

const proteinIds = [
  "plate-chicken-breast-150g",
  "plate-lean-beef-150g",
  "plate-pork-loin-150g",
  "plate-white-fish-150g",
  "plate-salmon-150g",
  "plate-prawns-150g",
];

const extraIds = [
  "teaspoon-cooking-oil",
  "plate-tablespoon-cooking-oil",
  "plate-light-sauce",
  "plate-regular-sauce",
  "plate-creamy-sauce",
  "plate-fried-breaded-preparation",
];

const quantityOptions = ["0.5", "1", "1.5", "2", "custom"];

const quickSnackCategories = {
  potato: {
    label: "Potato chips or crisps",
    kcalPer100g: 550,
    seedId: "snack-potato-chips-30g",
    uncertainty: 20,
  },
  corn: {
    label: "Corn or tortilla chips",
    kcalPer100g: 500,
    seedId: "snack-corn-tortilla-chips-30g",
    uncertainty: 20,
  },
  cookies: {
    label: "Cookies or biscuits",
    kcalPer100g: 480,
    seedId: "snack-cookies-sweet-biscuits-30g",
    uncertainty: 20,
  },
  chocolate: {
    label: "Chocolate",
    kcalPer100g: 535,
    seedId: "snack-milk-chocolate-25g",
    uncertainty: 20,
  },
  sweets: {
    label: "Gummy or hard sweets",
    kcalPer100g: 360,
    seedId: "snack-gummy-hard-sweets-30g",
    uncertainty: 20,
  },
  icecream: {
    label: "Ice cream",
    kcalPer100g: 200,
    seedId: "snack-ice-cream-scoop-80g",
    uncertainty: 25,
  },
  fried: {
    label: "Deep-fried savoury snack",
    kcalPer100g: 320,
    seedId: "snack-curry-puff-80g",
    uncertainty: 35,
  },
  pastry: {
    label: "Sweet pastry or doughnut",
    kcalPer100g: 380,
    seedId: "snack-doughnut-70g",
    uncertainty: 35,
  },
  other: {
    label: "Other",
    kcalPer100g: null,
    seedId: null,
    uncertainty: 40,
  },
} as const;

const commonSnackWeights = {
  bites: 15,
  small: 30,
  regular: 60,
  large: 100,
};

function formatNumber(value: number | null | undefined, maximumFractionDigits = 1) {
  return typeof value === "number" && Number.isFinite(value)
    ? value.toLocaleString(undefined, { maximumFractionDigits })
    : "-";
}

function addNutrition(
  total: NutritionValues,
  nutrition: NutritionValues | null,
  quantity: number,
) {
  if (!nutrition) return total;

  const next = { ...total };
  for (const { key } of nutrientFields) {
    const value = nutrition[key];
    next[key] = (next[key] ?? 0) + (value ?? 0) * quantity;
  }
  return next;
}

function roundNutrition(nutrition: NutritionValues) {
  return Object.fromEntries(
    nutrientFields.map(({ key }) => [
      key,
      Math.round(((nutrition[key] ?? 0) as number) * 10) / 10,
    ]),
  ) as NutritionValues;
}

function componentChoices(foods: FoodItem[], ids: string[]) {
  const foodById = new Map(foods.map((food) => [food.id, food]));
  return ids.map((id) => foodById.get(id)).filter(Boolean) as FoodItem[];
}

function parsePositive(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function primaryAddClasses() {
  return "min-h-11 rounded-md bg-teal-700 px-4 text-sm font-semibold text-white disabled:bg-stone-300";
}

function primarySaveClasses() {
  return "min-h-11 rounded-md bg-stone-900 px-4 text-sm font-semibold text-white";
}

function secondaryClasses() {
  return "min-h-10 rounded-md border border-stone-300 px-3 text-sm font-semibold text-stone-800";
}

function tertiaryClasses() {
  return "min-h-10 px-2 text-sm font-semibold text-stone-600 underline decoration-stone-300 underline-offset-4";
}

function NutrientPreview({ nutrition }: { nutrition: NutritionValues | null }) {
  return (
    <div className="rounded-md bg-stone-50 p-3">
      <p className="text-sm font-semibold text-stone-900">
        {formatNumber(nutrition?.caloriesKcal, 0)} kcal
      </p>
      <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-stone-600 sm:grid-cols-3">
        <p>Protein {formatNumber(nutrition?.proteinG)} g</p>
        <p>Fibre {formatNumber(nutrition?.fibreG)} g</p>
        <p>Sodium {formatNumber(nutrition?.sodiumMg, 0)} mg</p>
      </div>
    </div>
  );
}

function QuantitySelect({
  customValue,
  label,
  onCustomChange,
  onModeChange,
  mode,
}: {
  customValue: string;
  label: string;
  mode: string;
  onCustomChange: (value: string) => void;
  onModeChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-[1fr_7rem]">
      <label>
        <span className="text-xs font-medium text-stone-600">{label}</span>
        <select
          className="mt-1 min-h-10 w-full rounded-md border border-stone-300 bg-white px-2 text-sm"
          onChange={(event) => onModeChange(event.target.value)}
          value={mode}
        >
          {quantityOptions.map((option) => (
            <option key={option} value={option}>
              {option === "custom" ? "Custom" : `${option} serving`}
            </option>
          ))}
        </select>
      </label>
      {mode === "custom" && (
        <label>
          <span className="text-xs font-medium text-stone-600">Qty</span>
          <input
            className="mt-1 min-h-10 w-full rounded-md border border-stone-300 px-2 text-sm"
            min="0"
            onChange={(event) => onCustomChange(event.target.value)}
            step="0.1"
            type="number"
            value={customValue}
          />
        </label>
      )}
    </div>
  );
}

function SlotSelect({
  choices,
  customQuantity,
  label,
  onQuantityChange,
  onSelect,
  onCustomQuantityChange,
  quantityMode,
  value,
}: {
  choices: FoodItem[];
  customQuantity: string;
  label: string;
  onCustomQuantityChange: (value: string) => void;
  onQuantityChange: (value: string) => void;
  onSelect: (value: string) => void;
  quantityMode: string;
  value: string;
}) {
  return (
    <div className="rounded-md border border-stone-200 p-3">
      <label>
        <span className="text-sm font-semibold text-stone-800">{label}</span>
        <select
          className="mt-2 min-h-11 w-full rounded-md border border-stone-300 bg-white px-3 text-sm"
          onChange={(event) => onSelect(event.target.value)}
          value={value}
        >
          <option value="">None</option>
          {choices.map((food) => (
            <option key={food.id} value={food.id}>
              {food.name}
            </option>
          ))}
        </select>
      </label>
      {value && (
        <div className="mt-3">
          <QuantitySelect
            customValue={customQuantity}
            label="Quantity"
            mode={quantityMode}
            onCustomChange={onCustomQuantityChange}
            onModeChange={onQuantityChange}
          />
        </div>
      )}
    </div>
  );
}

type PlateSlot = {
  foodItemId: string;
  quantityMode: string;
  customQuantity: string;
};

const emptySlot: PlateSlot = {
  foodItemId: "",
  quantityMode: "1",
  customQuantity: "1",
};

export function BuildPlateForm({
  collectionSuggestions,
  foods,
  initialMealType,
  onAddEntry,
  onClose,
  onSaveMeal,
}: {
  collectionSuggestions: string[];
  foods: FoodItem[];
  initialMealType?: FoodLogEntry["mealType"];
  onAddEntry: (entry: FoodLogEntry) => void;
  onClose: () => void;
  onSaveMeal: (meal: MealTemplate) => void;
}) {
  const [base, setBase] = useState<PlateSlot>(emptySlot);
  const [vegetable, setVegetable] = useState<PlateSlot>(emptySlot);
  const [protein, setProtein] = useState<PlateSlot>(emptySlot);
  const [extras, setExtras] = useState<Record<string, PlateSlot>>({});
  const [portionMode, setPortionMode] = useState("1");
  const [customPortion, setCustomPortion] = useState("1");
  const [mealName, setMealName] = useState("");
  const [collection, setCollection] = useState("Home");
  const [location, setLocation] = useState("");
  const [mealType, setMealType] = useState<FoodLogEntry["mealType"]>(
    initialMealType ?? inferMealType(),
  );
  const [error, setError] = useState("");

  const choices = useMemo(
    () => ({
      bases: componentChoices(foods, baseIds),
      vegetables: componentChoices(foods, vegetableIds),
      proteins: componentChoices(foods, proteinIds),
      extras: componentChoices(foods, extraIds),
    }),
    [foods],
  );

  function slotQuantity(slot: PlateSlot) {
    return slot.quantityMode === "custom"
      ? parsePositive(slot.customQuantity)
      : Number(slot.quantityMode);
  }

  const selectedItems = useMemo(() => {
    const slots = [base, vegetable, protein, ...Object.values(extras)];
    return slots.flatMap((slot) => {
      const quantity = slotQuantity(slot);
      return slot.foodItemId && quantity ? [{ foodItemId: slot.foodItemId, quantity }] : [];
    });
  }, [base, vegetable, extras, protein]);

  const portion = portionMode === "custom" ? parsePositive(customPortion) : Number(portionMode);
  const fullPlateNutrition = useMemo(
    () =>
      roundNutrition(
        selectedItems.reduce((total, item) => {
          const food = foods.find((entry) => entry.id === item.foodItemId);
          return addNutrition(total, food?.nutrition ?? null, item.quantity);
        }, emptyNutrition),
      ),
    [foods, selectedItems],
  );
  const consumedPreview = portion
    ? scaleNutrition(fullPlateNutrition, portion)
    : fullPlateNutrition;

  function updateExtra(foodItemId: string, checked: boolean) {
    setExtras((current) => {
      const next = { ...current };
      if (checked) {
        next[foodItemId] = { ...emptySlot, foodItemId };
      } else {
        delete next[foodItemId];
      }
      return next;
    });
  }

  function buildMeal() {
    if (selectedItems.length === 0) {
      setError("Select at least one component.");
      return null;
    }

    if (!portion) {
      setError("Portion consumed must be greater than zero.");
      return null;
    }

    if (!mealName.trim()) {
      setError("Add a meal name before saving.");
      return null;
    }

    const now = new Date().toISOString();
    setError("");
    return {
      id: makeId("meal"),
      name: mealName.trim(),
      description: "Plate built from reusable components.",
      mealType,
      locationName: location.trim() || null,
      collectionName: collection.trim() || "Home",
      estimatedPriceSgd: null,
      items: selectedItems,
      isSeedItem: false,
      clonedFromId: null,
      createdAt: now,
      updatedAt: now,
    } satisfies MealTemplate;
  }

  function addToToday() {
    if (selectedItems.length === 0) {
      setError("Select at least one component.");
      return;
    }

    if (!portion) {
      setError("Portion consumed must be greater than zero.");
      return;
    }

    const now = new Date().toISOString();
    const temporaryMeal: MealTemplate = {
      id: makeId("plate"),
      name: mealName.trim() || "Built plate",
      description: "Plate built from reusable components.",
      mealType,
      locationName: location.trim() || null,
      collectionName: collection.trim() || "Home",
      estimatedPriceSgd: null,
      items: selectedItems,
      isSeedItem: false,
      clonedFromId: null,
      createdAt: now,
      updatedAt: now,
    };
    onAddEntry(createLogEntryFromMeal({ foods, meal: temporaryMeal, quantity: portion }));
  }

  function saveOnly() {
    const meal = buildMeal();
    if (meal) onSaveMeal(meal);
  }

  function saveAndAdd() {
    const meal = buildMeal();
    if (!meal || !portion) return;

    onSaveMeal(meal);
    onAddEntry(createLogEntryFromMeal({ foods, meal, quantity: portion }));
  }

  return (
    <section className="wc-section wc-section-padded shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-stone-950">Build a plate</h2>
          <p className="mt-1 text-sm text-stone-500">
            Choose normal library components; oil, sauces and breading stay explicit.
          </p>
        </div>
        <button className={tertiaryClasses()} onClick={onClose} type="button">
          Cancel
        </button>
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <SlotSelect choices={choices.bases} customQuantity={base.customQuantity} label="Base / starch" onCustomQuantityChange={(value) => setBase((current) => ({ ...current, customQuantity: value }))} onQuantityChange={(value) => setBase((current) => ({ ...current, quantityMode: value }))} onSelect={(value) => setBase({ ...emptySlot, foodItemId: value })} quantityMode={base.quantityMode} value={base.foodItemId} />
        <SlotSelect choices={choices.vegetables} customQuantity={vegetable.customQuantity} label="Vegetables or salad" onCustomQuantityChange={(value) => setVegetable((current) => ({ ...current, customQuantity: value }))} onQuantityChange={(value) => setVegetable((current) => ({ ...current, quantityMode: value }))} onSelect={(value) => setVegetable({ ...emptySlot, foodItemId: value })} quantityMode={vegetable.quantityMode} value={vegetable.foodItemId} />
        <SlotSelect choices={choices.proteins} customQuantity={protein.customQuantity} label="Protein" onCustomQuantityChange={(value) => setProtein((current) => ({ ...current, customQuantity: value }))} onQuantityChange={(value) => setProtein((current) => ({ ...current, quantityMode: value }))} onSelect={(value) => setProtein({ ...emptySlot, foodItemId: value })} quantityMode={protein.quantityMode} value={protein.foodItemId} />
        <div className="rounded-md border border-stone-200 p-3">
          <p className="text-sm font-semibold text-stone-800">Extras and preparation</p>
          <div className="mt-2 grid gap-3">
            {choices.extras.map((food) => {
              const selected = extras[food.id];
              return (
                <div className="rounded-md bg-stone-50 p-2" key={food.id}>
                  <label className="flex items-center gap-2 text-sm font-medium text-stone-800">
                    <input
                      checked={Boolean(selected)}
                      onChange={(event) => updateExtra(food.id, event.target.checked)}
                      type="checkbox"
                    />
                    {food.name}
                  </label>
                  {selected && (
                    <div className="mt-2">
                      <QuantitySelect customValue={selected.customQuantity} label="Quantity" mode={selected.quantityMode} onCustomChange={(value) => setExtras((current) => ({ ...current, [food.id]: { ...current[food.id], customQuantity: value } }))} onModeChange={(value) => setExtras((current) => ({ ...current, [food.id]: { ...current[food.id], quantityMode: value } }))} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <QuantitySelect customValue={customPortion} label="Portion consumed" mode={portionMode} onCustomChange={setCustomPortion} onModeChange={setPortionMode} />
        <NutrientPreview nutrition={consumedPreview} />
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <TextInput label="Meal name" onChange={setMealName} value={mealName} />
        <TextInput label="Collection" list="plate-collection-suggestions" onChange={setCollection} value={collection} />
        <datalist id="plate-collection-suggestions">
          {collectionSuggestions.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
        <TextInput label="Location" onChange={setLocation} value={location} />
        <MealTypeSelect onChange={setMealType} value={mealType} />
      </div>
      {error && <p className="mt-3 text-sm font-medium text-red-700">{error}</p>}
      <div className="mt-5 grid gap-2 sm:grid-cols-3">
        <button className={primaryAddClasses()} onClick={addToToday} type="button">
          Add to today
        </button>
        <button className={primarySaveClasses()} onClick={saveOnly} type="button">
          Save as meal
        </button>
        <button className={primarySaveClasses()} onClick={saveAndAdd} type="button">
          Save and add
        </button>
      </div>
    </section>
  );
}

type QuickChoice = {
  label: string;
  nutrition: NutritionValues;
};

const quickBases: Record<string, QuickChoice> = {
  none: { label: "None", nutrition: emptyNutrition },
  small: { label: "Small", nutrition: { ...emptyNutrition, caloriesKcal: 120, carbohydratesG: 26, proteinG: 2.5, fibreG: 1 } },
  regular: { label: "Regular", nutrition: { ...emptyNutrition, caloriesKcal: 240, carbohydratesG: 52, proteinG: 5, fibreG: 2 } },
  large: { label: "Large", nutrition: { ...emptyNutrition, caloriesKcal: 360, carbohydratesG: 78, proteinG: 7.5, fibreG: 3 } },
};

const quickProtein: Record<string, QuickChoice> = {
  none: { label: "None", nutrition: emptyNutrition },
  small: { label: "Small", nutrition: { ...emptyNutrition, caloriesKcal: 130, proteinG: 20, totalFatG: 5, saturatedFatG: 1.5, sodiumMg: 150 } },
  regular: { label: "Regular", nutrition: { ...emptyNutrition, caloriesKcal: 260, proteinG: 38, totalFatG: 11, saturatedFatG: 3.5, sodiumMg: 300 } },
  large: { label: "Large", nutrition: { ...emptyNutrition, caloriesKcal: 390, proteinG: 55, totalFatG: 17, saturatedFatG: 5, sodiumMg: 450 } },
};

const quickVegetables: Record<string, QuickChoice> = {
  none: { label: "None", nutrition: emptyNutrition },
  some: { label: "Some", nutrition: { ...emptyNutrition, caloriesKcal: 45, carbohydratesG: 8, proteinG: 2, fibreG: 2.5, sodiumMg: 50 } },
  half: { label: "About half the plate", nutrition: { ...emptyNutrition, caloriesKcal: 90, carbohydratesG: 16, proteinG: 4, fibreG: 5, sodiumMg: 100 } },
};

const quickPrep: Record<string, QuickChoice> = {
  steamed: { label: "Steamed or grilled", nutrition: emptyNutrition },
  stir: { label: "Stir-fried", nutrition: { ...emptyNutrition, caloriesKcal: 120, totalFatG: 10, saturatedFatG: 1.5, sodiumMg: 180 } },
  fried: { label: "Deep-fried or breaded", nutrition: { ...emptyNutrition, caloriesKcal: 240, carbohydratesG: 20, totalFatG: 15, saturatedFatG: 3, sodiumMg: 350 } },
  creamy: { label: "Creamy or cheesy", nutrition: { ...emptyNutrition, caloriesKcal: 240, totalFatG: 18, saturatedFatG: 8, sodiumMg: 450 } },
  mixed: { label: "Mixed or unknown", nutrition: { ...emptyNutrition, caloriesKcal: 160, carbohydratesG: 8, totalFatG: 10, saturatedFatG: 3, sodiumMg: 300 } },
};

const quickSauce: Record<string, QuickChoice> = {
  none: { label: "None", nutrition: emptyNutrition },
  light: { label: "Light", nutrition: { ...emptyNutrition, caloriesKcal: 40, carbohydratesG: 8, sodiumMg: 200 } },
  regular: { label: "Regular", nutrition: { ...emptyNutrition, caloriesKcal: 90, carbohydratesG: 14, totalFatG: 2, sodiumMg: 450 } },
  heavy: { label: "Heavy or unknown", nutrition: { ...emptyNutrition, caloriesKcal: 180, carbohydratesG: 18, totalFatG: 8, saturatedFatG: 2, sodiumMg: 700 } },
};

const venueUncertainty: Record<string, number> = {
  homemade: 20,
  "food-court": 30,
  "fast-food": 30,
  restaurant: 35,
  other: 40,
};

const amountConsumed: Record<string, number> = {
  "25": 0.25,
  "50": 0.5,
  "75": 0.75,
  all: 1,
};

export function QuickEstimateForm({
  initialMealType,
  onAddEntry,
  onClose,
  onSaveFood,
}: {
  initialMealType?: FoodLogEntry["mealType"];
  onAddEntry: (entry: FoodLogEntry) => void;
  onClose: () => void;
  onSaveFood: (food: FoodItem) => void;
}) {
  const [venue, setVenue] = useState("food-court");
  const [mealSize, setMealSize] = useState("regular");
  const [baseType, setBaseType] = useState("rice");
  const [baseAmount, setBaseAmount] = useState("regular");
  const [proteinAmount, setProteinAmount] = useState("regular");
  const [vegetables, setVegetables] = useState("some");
  const [preparation, setPreparation] = useState("mixed");
  const [sauce, setSauce] = useState("regular");
  const [consumed, setConsumed] = useState("all");
  const [fullnessNote, setFullnessNote] = useState("not-recorded");
  const [name, setName] = useState("Quick meal estimate");
  const [draft, setDraft] = useState<Record<keyof NutritionValues, string> | null>(null);

  const estimate = useMemo(() => {
    const raw = [quickBases[baseAmount], quickProtein[proteinAmount], quickVegetables[vegetables], quickPrep[preparation], quickSauce[sauce]]
      .reduce((total, item) => addNutrition(total, item.nutrition, 1), emptyNutrition);
    const sizeFactor = mealSize === "small" ? 0.85 : mealSize === "large" ? 1.2 : 1;
    const consumedFactor = amountConsumed[consumed] ?? 1;
    const nutrition = roundNutrition(scaleNutrition(raw, sizeFactor * consumedFactor));
    const uncertainty = venueUncertainty[venue] ?? 40;
    const calories = nutrition.caloriesKcal ?? 0;
    const range = {
      min: Math.round(calories * (1 - uncertainty / 100)),
      max: Math.round(calories * (1 + uncertainty / 100)),
    };
    const assumptions = [
      `Venue: ${venue.replace("-", " ")}`,
      `Meal size: ${mealSize}`,
      `Base: ${baseType}, amount ${baseAmount}`,
      `Protein amount: ${proteinAmount}`,
      `Vegetables: ${vegetables}`,
      `Preparation: ${quickPrep[preparation].label}`,
      `Sauce: ${quickSauce[sauce].label}`,
      `Amount consumed: ${Math.round(consumedFactor * 100)}%`,
    ];

    return { nutrition, uncertainty, range, assumptions, consumedFactor };
  }, [baseAmount, baseType, consumed, mealSize, preparation, proteinAmount, sauce, vegetables, venue]);

  const effectiveNutrition = useMemo(() => {
    if (!draft) return estimate.nutrition;

    return Object.fromEntries(
      nutrientFields.map(({ key }) => {
        const parsed = Number(draft[key]);
        return [key, Number.isFinite(parsed) && parsed >= 0 ? parsed : 0];
      }),
    ) as NutritionValues;
  }, [draft, estimate.nutrition]);

  function enableEditing() {
    setDraft(
      Object.fromEntries(
        nutrientFields.map(({ key }) => [key, String(estimate.nutrition[key] ?? 0)]),
      ) as Record<keyof NutritionValues, string>,
    );
  }

  function makeFood() {
    const now = new Date().toISOString();
    return {
      id: makeId("food"),
      name: name.trim() || "Quick meal estimate",
      description: "Reusable quick estimate from broad visible meal components.",
      brand: null,
      servingLabel: "1 estimated meal",
      locationName: venue === "homemade" ? "Home" : venue.replace("-", " "),
      collectionName: venue === "food-court" ? "Food court" : "Other restaurants",
      countryCode: "SG" as const,
      nutrition: effectiveNutrition,
      nutritionStatus: "estimated" as const,
      uncertaintyPercent: estimate.uncertainty,
      sourceLabel: "Structured quick estimate",
      sourceUrl: null,
      lastVerifiedAt: null,
      assumptions: estimate.assumptions,
      isSeedItem: false,
      clonedFromId: null,
      createdAt: now,
      updatedAt: now,
    };
  }

  function addOnce() {
    const food = makeFood();
    const entry = createLogEntryFromFood({
      food,
      mealType: initialMealType ?? inferMealType(),
      sourceType: "custom-one-off",
    });
    onAddEntry({
      ...entry,
      quickEstimate: {
        uncertaintyPercent: estimate.uncertainty,
        calorieRange: estimate.range,
        assumptions: estimate.assumptions,
        venueType: venue,
        amountConsumedPercent: Math.round(estimate.consumedFactor * 100),
        fullnessNote,
      },
    });
  }

  function saveFood() {
    onSaveFood(makeFood());
  }

  return (
    <section className="wc-section wc-section-padded shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-stone-950">Quick meal estimate</h2>
          <p className="mt-1 text-sm text-stone-500">
            Use this when exact foods are unknown. The entry remains estimated.
          </p>
        </div>
        <button className={tertiaryClasses()} onClick={onClose} type="button">
          Cancel
        </button>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <SelectInput label="Venue" onChange={setVenue} options={[["homemade", "Homemade"], ["food-court", "Food court"], ["fast-food", "Fast food"], ["restaurant", "Restaurant"], ["other", "Other"]]} value={venue} />
        <SelectInput label="Plate or meal size" onChange={setMealSize} options={[["small", "Small"], ["regular", "Regular"], ["large", "Large"]]} value={mealSize} />
        <SelectInput label="Base type" onChange={setBaseType} options={[["none", "None"], ["rice", "Rice"], ["noodles", "Noodles"], ["pasta", "Pasta"], ["potato", "Potato"], ["bread", "Bread"], ["other", "Other"]]} value={baseType} />
        <SelectInput label="Base amount" onChange={setBaseAmount} options={[["none", "None"], ["small", "Small"], ["regular", "Regular"], ["large", "Large"]]} value={baseAmount} />
        <SelectInput label="Protein amount" onChange={setProteinAmount} options={[["none", "None"], ["small", "Small"], ["regular", "Regular"], ["large", "Large"]]} value={proteinAmount} />
        <SelectInput label="Vegetables" onChange={setVegetables} options={[["none", "None"], ["some", "Some"], ["half", "About half the plate"]]} value={vegetables} />
        <SelectInput label="Preparation" onChange={setPreparation} options={[["steamed", "Steamed or grilled"], ["stir", "Stir-fried"], ["fried", "Deep-fried or breaded"], ["creamy", "Creamy or cheesy"], ["mixed", "Mixed or unknown"]]} value={preparation} />
        <SelectInput label="Sauce" onChange={setSauce} options={[["none", "None"], ["light", "Light"], ["regular", "Regular"], ["heavy", "Heavy or unknown"]]} value={sauce} />
        <SelectInput label="Amount consumed" onChange={setConsumed} options={[["25", "25 percent"], ["50", "50 percent"], ["75", "75 percent"], ["all", "All"]]} value={consumed} />
        <SelectInput label="How did the meal leave you feeling?" onChange={setFullnessNote} options={[["still-hungry", "Still hungry"], ["comfortable", "Comfortable"], ["very-full", "Very full"], ["not-recorded", "Not recorded"]]} value={fullnessNote} />
      </div>
      <div className="mt-4 rounded-md bg-stone-50 p-3">
        <p className="text-sm font-semibold text-stone-900">
          Estimated {estimate.range.min.toLocaleString()}-{estimate.range.max.toLocaleString()} kcal
        </p>
        <p className="mt-1 text-sm text-stone-600">
          Daily total records approximately{" "}
          {formatNumber(effectiveNutrition.caloriesKcal, 0)} kcal.
        </p>
        <p className="mt-1 text-xs text-stone-500">
          Uncertainty: +/-{estimate.uncertainty}%. The fullness note is private context
          and does not alter nutrition.
        </p>
      </div>
      <details className="mt-3 rounded-md border border-stone-200 p-3">
        <summary className="cursor-pointer text-sm font-semibold text-stone-800">
          Assumptions
        </summary>
        <ul className="mt-2 list-inside list-disc text-sm text-stone-600">
          {estimate.assumptions.map((assumption) => (
            <li key={assumption}>{assumption}</li>
          ))}
        </ul>
      </details>
      <div className="mt-4 grid gap-3">
        <TextInput label="Reusable item name" onChange={setName} value={name} />
        <button className={secondaryClasses()} onClick={enableEditing} type="button">
          Edit estimated nutrition before saving
        </button>
        {draft && (
          <div className="grid gap-3 sm:grid-cols-2">
            {nutrientFields.map(({ key, label, unit }) => (
              <TextInput
                key={key}
                label={`${label} (${unit})`}
                onChange={(value) => setDraft((current) => ({ ...(current ?? {}), [key]: value } as Record<keyof NutritionValues, string>))}
                type="number"
                value={draft[key]}
              />
            ))}
          </div>
        )}
      </div>
      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        <button className={primaryAddClasses()} onClick={addOnce} type="button">
          Add once
        </button>
        <button className={primarySaveClasses()} onClick={saveFood} type="button">
          Save this estimate as a reusable item
        </button>
      </div>
    </section>
  );
}

function scaleSeedNutrition(seed: FoodItem | undefined, calories: number) {
  if (!seed?.nutrition?.caloriesKcal) return null;

  return scaleNutrition(seed.nutrition, calories / seed.nutrition.caloriesKcal);
}

export function QuickSnackForm({
  onAddEntry,
  onClose,
  onSaveFood,
}: {
  onAddEntry: (entry: FoodLogEntry) => void;
  onClose: () => void;
  onSaveFood: (food: FoodItem) => void;
}) {
  const [category, setCategory] = useState<keyof typeof quickSnackCategories>("potato");
  const [amountMode, setAmountMode] = useState("common");
  const [commonPortion, setCommonPortion] = useState<keyof typeof commonSnackWeights>("small");
  const [grams, setGrams] = useState("30");
  const [otherKcalPer100g, setOtherKcalPer100g] = useState("");
  const [otherPortionCalories, setOtherPortionCalories] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  const config = quickSnackCategories[category];
  const weightG =
    amountMode === "grams"
      ? parsePositive(grams)
      : parsePositive(grams) ?? commonSnackWeights[commonPortion];
  const kcalPer100g =
    config.kcalPer100g ?? parsePositive(otherKcalPer100g);
  const calories =
    category === "other" && otherPortionCalories.trim()
      ? parsePositive(otherPortionCalories)
      : weightG && kcalPer100g
        ? Math.round((weightG * kcalPer100g) / 100)
        : null;
  const seed = starterSnackSeedFoods.find((food) => food.id === config.seedId);
  const scaledNutrition =
    calories !== null
      ? scaleSeedNutrition(seed, calories) ?? {
          caloriesKcal: calories,
          proteinG: null,
          carbohydratesG: null,
          totalFatG: null,
          saturatedFatG: null,
          fibreG: null,
          sodiumMg: null,
        }
      : null;
  const kcalPerGram = kcalPer100g ? kcalPer100g / 100 : null;
  const displayName = name.trim() || config.label;

  function validate() {
    if (!weightG) {
      setError("Enter a positive amount in grams.");
      return false;
    }
    if (category === "other" && !kcalPer100g && !parsePositive(otherPortionCalories)) {
      setError("For Other, enter calories per 100 g or calories for the whole portion.");
      return false;
    }
    if (!calories || !scaledNutrition) {
      setError("Enter enough information to estimate calories.");
      return false;
    }

    setError("");
    return true;
  }

  function makeFood() {
    const now = new Date().toISOString();
    return {
      id: makeId("food"),
      name: displayName,
      description: `Quick snack estimate: ${config.label}.`,
      brand: null,
      servingLabel: `${formatNumber(weightG, 1)} g`,
      servingWeightG: weightG,
      locationName: null,
      collectionName: "Snacks",
      countryCode: "SG" as const,
      nutrition: scaledNutrition,
      nutritionStatus: "estimated" as const,
      uncertaintyPercent: config.uncertainty,
      sourceLabel: "Quick snack estimate",
      sourceUrl: null,
      lastVerifiedAt: null,
      assumptions: [
        `${config.label}: ${config.kcalPer100g ?? kcalPer100g} kcal per 100 g`,
        `Estimated amount eaten: ${formatNumber(weightG, 1)} g`,
        "Package-label nutrition should replace this estimate when available",
      ],
      isSeedItem: false,
      clonedFromId: null,
      createdAt: now,
      updatedAt: now,
    } satisfies FoodItem;
  }

  function addOnce() {
    if (!validate()) return;
    onAddEntry(
      createLogEntryFromFood({
        food: makeFood(),
        mealType: "snack",
        sourceType: "custom-one-off",
      }),
    );
  }

  function saveOnly() {
    if (!validate()) return;
    onSaveFood(makeFood());
  }

  function saveAndAdd() {
    if (!validate()) return;
    const food = makeFood();
    onSaveFood(food);
    onAddEntry(createLogEntryFromFood({ food, mealType: "snack" }));
  }

  return (
    <section className="wc-section wc-section-padded shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-stone-950">Quick snack</h2>
          <p className="mt-1 text-sm text-stone-500">
            Fast estimate for a snack when the exact brand is not in the library.
          </p>
        </div>
        <button className={tertiaryClasses()} onClick={onClose} type="button">
          Cancel
        </button>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <SelectInput
          label="Category"
          onChange={(value) => {
            setCategory(value as keyof typeof quickSnackCategories);
            const nextConfig = quickSnackCategories[value as keyof typeof quickSnackCategories];
            setName(nextConfig.label === "Other" ? "" : nextConfig.label);
          }}
          options={Object.entries(quickSnackCategories).map(([key, value]) => [
            key,
            value.label,
          ])}
          value={category}
        />
        <SelectInput
          label="Amount input mode"
          onChange={setAmountMode}
          options={[
            ["common", "Common portion"],
            ["grams", "Grams"],
          ]}
          value={amountMode}
        />
        {amountMode === "common" && (
          <SelectInput
            label="Common portion"
            onChange={(value) => {
              setCommonPortion(value as keyof typeof commonSnackWeights);
              setGrams(String(commonSnackWeights[value as keyof typeof commonSnackWeights]));
            }}
            options={[
              ["bites", "A few bites"],
              ["small", "Small portion"],
              ["regular", "Regular portion"],
              ["large", "Large portion"],
            ]}
            value={commonPortion}
          />
        )}
        <TextInput label="Amount eaten (g)" onChange={setGrams} type="number" value={grams} />
        {category === "other" && (
          <>
            <TextInput
              label="Estimated calories per 100 g"
              onChange={setOtherKcalPer100g}
              type="number"
              value={otherKcalPer100g}
            />
            <TextInput
              label="Estimated calories for whole portion"
              onChange={setOtherPortionCalories}
              type="number"
              value={otherPortionCalories}
            />
          </>
        )}
        <TextInput label="Reusable food name" onChange={setName} value={name} />
      </div>
      <div className="mt-4 rounded-md bg-stone-50 p-3">
        <p className="text-sm font-semibold text-stone-900">
          {weightG && kcalPerGram
            ? `${formatNumber(weightG, 1)} g × ${formatNumber(kcalPerGram, 1)} kcal/g ≈ ${formatNumber(calories, 0)} kcal`
            : `Estimated ${formatNumber(calories, 0)} kcal`}
        </p>
        <p className="mt-1 text-xs text-stone-500">
          Uncertainty: +/-{config.uncertainty}%.{" "}
          {config.seedId
            ? "Nutrients scale from the matching generic snack item."
            : "Calories-only entries leave unknown nutrients blank."}
        </p>
      </div>
      {error && <p className="mt-3 text-sm font-medium text-red-700">{error}</p>}
      <div className="mt-5 grid gap-2 sm:grid-cols-3">
        <button className={primaryAddClasses()} onClick={addOnce} type="button">
          Add once
        </button>
        <button className={primarySaveClasses()} onClick={saveOnly} type="button">
          Save as reusable food
        </button>
        <button className={primarySaveClasses()} onClick={saveAndAdd} type="button">
          Save and add
        </button>
      </div>
    </section>
  );
}

function TextInput({
  label,
  list,
  onChange,
  type = "text",
  value,
}: {
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
        className="mt-2 min-h-11 w-full rounded-md border border-stone-300 px-3 text-sm outline-none focus:border-stone-900"
        list={list}
        min={type === "number" ? "0" : undefined}
        onChange={(event) => onChange(event.target.value)}
        step={type === "number" ? "0.1" : undefined}
        type={type}
        value={value}
      />
    </label>
  );
}

function SelectInput({
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
        className="mt-2 min-h-11 w-full rounded-md border border-stone-300 bg-white px-3 text-sm"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {options.map(([optionValue, labelText]) => (
          <option key={optionValue} value={optionValue}>
            {labelText}
          </option>
        ))}
      </select>
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
