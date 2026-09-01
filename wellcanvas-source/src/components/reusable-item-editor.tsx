"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import {
  calculateMealNutrition,
  type FoodCategory,
  type FoodItem,
  type FoodMetadataEntry,
  type LibraryBeverageType,
  type MealTemplate,
  type MealTemplateItem,
  type NutritionStatus,
  type NutritionValues,
  type PersonalFoodRating,
} from "@/lib/food-library";
import { makeId } from "@/lib/food-log";

type ReusableEditorEntity =
  | { kind: "food" | "drink"; item: FoodItem }
  | { kind: "meal"; item: MealTemplate };

type ReusableItemEditorProps = {
  collectionSuggestions: string[];
  entity: ReusableEditorEntity;
  foods: FoodItem[];
  onCancel: () => void;
  onSaveFood: (food: FoodItem) => void;
  onSaveMeal: (meal: MealTemplate) => void;
};

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

const foodCategoryOptions: Array<{ value: FoodCategory; label: string }> = [
  { value: "breakfast", label: "Breakfast" },
  { value: "restaurant-meal", label: "Restaurant meal" },
  { value: "fruit", label: "Fruit" },
  { value: "vegetable", label: "Vegetable" },
  { value: "nuts-seeds", label: "Nuts and seeds" },
  { value: "grain-starch", label: "Grain or starch" },
  { value: "protein", label: "Protein" },
  { value: "dairy", label: "Dairy" },
  { value: "processed-snack", label: "Snack" },
  { value: "drink", label: "Drink" },
  { value: "meal-component", label: "Meal component" },
  { value: "other", label: "Other" },
];

const beverageOptions: Array<{ value: LibraryBeverageType; label: string }> = [
  { value: "tap-water", label: "Tap water" },
  { value: "still-water", label: "Still water" },
  { value: "sparkling-water", label: "Sparkling water" },
  { value: "sweet-soda", label: "Sweet soda" },
  { value: "zero-soda", label: "Zero soda" },
  { value: "coffee", label: "Coffee" },
  { value: "tea", label: "Tea" },
  { value: "juice", label: "Juice" },
  { value: "milk-dairy", label: "Milk / dairy" },
  { value: "other", label: "Other" },
];

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

function cloneFood(food: FoodItem): FoodItem {
  return {
    ...food,
    assumptions: [...(food.assumptions ?? [])],
    metadataEntries: [...(food.metadataEntries ?? [])],
    nutrition: food.nutrition ? { ...food.nutrition } : null,
  };
}

function cloneMeal(meal: MealTemplate): MealTemplate {
  return {
    ...meal,
    items: meal.items.map((item) => ({ ...item })),
    metadataEntries: [...(meal.metadataEntries ?? [])],
    manualNutritionOverride: meal.manualNutritionOverride
      ? {
          ...meal.manualNutritionOverride,
          assumptions: [...meal.manualNutritionOverride.assumptions],
          nutrition: { ...meal.manualNutritionOverride.nutrition },
        }
      : null,
  };
}

function parseOptionalNumber(value: string) {
  return value.trim() === "" ? null : Number(value);
}

function hasAnyNutrition(nutrition: NutritionValues | null | undefined) {
  return Boolean(nutrition && nutritionKeys.some(({ key }) => nutrition[key] !== null));
}

function cleanMetadataEntries(entries: FoodMetadataEntry[] | undefined) {
  return (entries ?? [])
    .map((entry) => ({
      ...entry,
      label: entry.label.trim(),
      value: entry.value.trim(),
    }))
    .filter((entry) => entry.label || entry.value);
}

function formatNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value)
    ? value.toLocaleString(undefined, { maximumFractionDigits: 1 })
    : "-";
}

function normalizeStatus(status: NutritionStatus, nutrition: NutritionValues | null) {
  if (!hasAnyNutrition(nutrition)) return "missing";
  return status === "missing" ? "estimated" : status;
}

export function ReusableItemEditor({
  collectionSuggestions,
  entity,
  foods,
  onCancel,
  onSaveFood,
  onSaveMeal,
}: ReusableItemEditorProps) {
  return entity.kind === "meal" ? (
    <MealReusableEditor
      collectionSuggestions={collectionSuggestions}
      foods={foods}
      meal={entity.item}
      onCancel={onCancel}
      onSave={onSaveMeal}
    />
  ) : (
    <FoodReusableEditor
      collectionSuggestions={collectionSuggestions}
      food={entity.item}
      isDrink={entity.kind === "drink"}
      onCancel={onCancel}
      onSave={onSaveFood}
    />
  );
}

function FoodReusableEditor({
  collectionSuggestions,
  food,
  isDrink,
  onCancel,
  onSave,
}: {
  collectionSuggestions: string[];
  food: FoodItem;
  isDrink: boolean;
  onCancel: () => void;
  onSave: (food: FoodItem) => void;
}) {
  const [draft, setDraft] = useState(() => cloneFood(food));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const initialDraft = useRef(JSON.stringify(cloneFood(food)));

  function updateNutrition(key: keyof NutritionValues, value: string) {
    setDraft((current) => ({
      ...current,
      nutrition: {
        ...(current.nutrition ?? emptyNutrition),
        [key]: parseOptionalNumber(value),
      },
    }));
    setErrors((current) => ({ ...current, [key]: "" }));
  }

  function updateMetadata(id: string, patch: Partial<FoodMetadataEntry>) {
    setDraft((current) => ({
      ...current,
      metadataEntries: (current.metadataEntries ?? []).map((entry) =>
        entry.id === id ? { ...entry, ...patch } : entry,
      ),
    }));
  }

  function cancel() {
    if (
      JSON.stringify(draft) !== initialDraft.current &&
      !window.confirm("Discard unsaved changes?")
    ) {
      return;
    }
    onCancel();
  }

  function save() {
    const nextErrors: Record<string, string> = {};
    if (!draft.name.trim()) nextErrors.name = "Name is required.";

    if (draft.nutrition) {
      for (const { key, label } of nutritionKeys) {
        const value = draft.nutrition[key];
        if (value !== null && value !== undefined && (!Number.isFinite(value) || value < 0)) {
          nextErrors[key] = `${label} cannot be negative or invalid.`;
        }
      }
    }
    if (
      draft.servingWeightG !== null &&
      draft.servingWeightG !== undefined &&
      (!Number.isFinite(draft.servingWeightG) || draft.servingWeightG <= 0)
    ) {
      nextErrors.servingWeightG = "Mass must be positive when supplied.";
    }
    if (
      draft.servingVolumeMl !== null &&
      draft.servingVolumeMl !== undefined &&
      (!Number.isFinite(draft.servingVolumeMl) || draft.servingVolumeMl <= 0)
    ) {
      nextErrors.servingVolumeMl = "Volume must be positive when supplied.";
    }
    if (
      draft.uncertaintyPercent !== null &&
      draft.uncertaintyPercent !== undefined &&
      (!Number.isFinite(draft.uncertaintyPercent) ||
        draft.uncertaintyPercent < 0 ||
        draft.uncertaintyPercent > 100)
    ) {
      nextErrors.uncertaintyPercent = "Uncertainty must be between 0 and 100.";
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const nutrition = hasAnyNutrition(draft.nutrition) ? draft.nutrition : null;
    onSave({
      ...draft,
      category: isDrink ? "drink" : (draft.category ?? "other"),
      logDestination: isDrink ? "hydration" : (draft.logDestination ?? "food"),
      metadataEntries: cleanMetadataEntries(draft.metadataEntries),
      name: draft.name.trim(),
      nutrition,
      nutritionStatus: normalizeStatus(draft.nutritionStatus, nutrition),
      servingLabel: draft.servingLabel.trim() || "serving",
      updatedAt: new Date().toISOString(),
    });
  }

  return (
    <section className="grid gap-4">
      <EditorGrid>
        <TextInput
          error={errors.name}
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
          label="Serving"
          onChange={(value) =>
            setDraft((current) => ({ ...current, servingLabel: value }))
          }
          value={draft.servingLabel}
        />
        <TextInput
          label="Collection / group"
          list="quick-editor-collections"
          onChange={(value) =>
            setDraft((current) => ({ ...current, collectionName: value || null }))
          }
          value={draft.collectionName ?? ""}
        />
        <datalist id="quick-editor-collections">
          {collectionSuggestions.map((collection) => (
            <option key={collection} value={collection} />
          ))}
        </datalist>
        <TextInput
          label="Location / restaurant"
          onChange={(value) =>
            setDraft((current) => ({ ...current, locationName: value || null }))
          }
          value={draft.locationName ?? ""}
        />
        <TextInput
          label="Brand"
          onChange={(value) => setDraft((current) => ({ ...current, brand: value || null }))}
          value={draft.brand ?? ""}
        />
        <label>
          <span className="text-sm font-medium text-stone-700">Type</span>
          <select
            className="mt-2 min-h-11 w-full rounded-md border border-stone-300 bg-white px-3 text-sm"
            disabled={isDrink}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                category: event.target.value as FoodCategory,
              }))
            }
            value={isDrink ? "drink" : (draft.category ?? "other")}
          >
            {foodCategoryOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        {isDrink && (
          <label>
            <span className="text-sm font-medium text-stone-700">Beverage type</span>
            <select
              className="mt-2 min-h-11 w-full rounded-md border border-stone-300 bg-white px-3 text-sm"
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  beverageType: event.target.value as LibraryBeverageType,
                }))
              }
              value={draft.beverageType ?? "other"}
            >
              {beverageOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        )}
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
      </EditorGrid>

      <section className="rounded-md border border-stone-200 bg-stone-50 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-stone-950">Nutrition</h3>
          <label className="min-w-44">
            <span className="sr-only">Nutrition status</span>
            <select
              className="min-h-10 w-full rounded-md border border-stone-300 bg-white px-2 text-sm"
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
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
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
      </section>

      <EditorGrid>
        <TextInput
          label="Source"
          onChange={(value) =>
            setDraft((current) => ({ ...current, sourceLabel: value || null }))
          }
          value={draft.sourceLabel ?? ""}
        />
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
      </EditorGrid>

      <RatingPicker
        onChange={(rating) => setDraft((current) => ({ ...current, userRating: rating }))}
        rating={draft.userRating ?? null}
      />

      <MetadataEditor
        entries={draft.metadataEntries ?? []}
        onAdd={() =>
          setDraft((current) => ({
            ...current,
            metadataEntries: [
              ...(current.metadataEntries ?? []),
              { id: makeId("metadata"), label: "Brand", value: "" },
            ],
          }))
        }
        onRemove={(id) =>
          setDraft((current) => ({
            ...current,
            metadataEntries: (current.metadataEntries ?? []).filter((entry) => entry.id !== id),
          }))
        }
        onUpdate={updateMetadata}
      />

      <div className="grid gap-2 sm:grid-cols-[auto_1fr]">
        <SmallButton onClick={cancel}>Cancel</SmallButton>
        <button className="btn btn-primary-dark min-h-11 px-4 text-sm" onClick={save} type="button">
          Save changes
        </button>
      </div>
    </section>
  );
}

function MealReusableEditor({
  collectionSuggestions,
  foods,
  meal,
  onCancel,
  onSave,
}: {
  collectionSuggestions: string[];
  foods: FoodItem[];
  meal: MealTemplate;
  onCancel: () => void;
  onSave: (meal: MealTemplate) => void;
}) {
  const [draft, setDraft] = useState(() => cloneMeal(meal));
  const [componentToAdd, setComponentToAdd] = useState(foods[0]?.id ?? "");
  const [error, setError] = useState("");
  const initialDraft = useRef(JSON.stringify(cloneMeal(meal)));
  const foodById = useMemo(() => new Map(foods.map((food) => [food.id, food])), [foods]);
  const calculated = calculateMealNutrition(
    { ...draft, manualNutritionOverride: null },
    foods,
  );
  const visibleNutrition = calculateMealNutrition(draft, foods);
  const manualNutrition =
    draft.manualNutritionOverride?.nutrition ?? visibleNutrition.nutrition ?? emptyNutrition;

  function cancel() {
    if (
      JSON.stringify(draft) !== initialDraft.current &&
      !window.confirm("Discard unsaved changes?")
    ) {
      return;
    }
    onCancel();
  }

  function updateManualNutrition(key: keyof NutritionValues, value: string) {
    setDraft((current) => ({
      ...current,
      manualNutritionOverride: {
        nutrition: {
          ...(current.manualNutritionOverride?.nutrition ??
            visibleNutrition.nutrition ??
            emptyNutrition),
          [key]: parseOptionalNumber(value),
        },
        nutritionStatus:
          current.manualNutritionOverride?.nutritionStatus ?? visibleNutrition.status,
        sourceLabel: current.manualNutritionOverride?.sourceLabel ?? "Manual correction",
        assumptions: current.manualNutritionOverride?.assumptions ?? [],
        updatedAt: new Date().toISOString(),
      },
    }));
  }

  function updateComponent(index: number, patch: Partial<MealTemplateItem>) {
    setDraft((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    }));
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
  }

  function updateMetadata(id: string, patch: Partial<FoodMetadataEntry>) {
    setDraft((current) => ({
      ...current,
      metadataEntries: (current.metadataEntries ?? []).map((entry) =>
        entry.id === id ? { ...entry, ...patch } : entry,
      ),
    }));
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
      metadataEntries: cleanMetadataEntries(draft.metadataEntries),
      name: draft.name.trim(),
      updatedAt: new Date().toISOString(),
    });
  }

  return (
    <section className="grid gap-4">
      <EditorGrid>
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
          label="Collection / group"
          list="quick-meal-editor-collections"
          onChange={(value) =>
            setDraft((current) => ({ ...current, collectionName: value || null }))
          }
          value={draft.collectionName ?? ""}
        />
        <datalist id="quick-meal-editor-collections">
          {collectionSuggestions.map((collection) => (
            <option key={collection} value={collection} />
          ))}
        </datalist>
        <TextInput
          label="Location"
          onChange={(value) =>
            setDraft((current) => ({ ...current, locationName: value || null }))
          }
          value={draft.locationName ?? ""}
        />
        <label>
          <span className="text-sm font-medium text-stone-700">Meal type</span>
          <select
            className="mt-2 min-h-11 w-full rounded-md border border-stone-300 bg-white px-3 text-sm"
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                mealType: event.target.value as MealTemplate["mealType"],
              }))
            }
            value={draft.mealType}
          >
            <option value="breakfast">Breakfast</option>
            <option value="lunch">Lunch</option>
            <option value="dinner">Dinner</option>
            <option value="snack">Snack</option>
          </select>
        </label>
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
      </EditorGrid>

      <section className="rounded-md border border-stone-200 bg-stone-50 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-stone-950">Components</h3>
          {foods.length > 0 && (
            <div className="flex flex-wrap gap-2">
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
              <SmallButton
                onClick={() => {
                  if (!componentToAdd) return;
                  setDraft((current) => ({
                    ...current,
                    items: [
                      ...current.items,
                      { foodItemId: componentToAdd, quantity: 1 },
                    ],
                  }));
                }}
              >
                Add component
              </SmallButton>
            </div>
          )}
        </div>
        <div className="mt-3 grid gap-2">
          {draft.items.length === 0 ? (
            <p className="text-sm text-stone-500">No components yet. Manual nutrition is still allowed.</p>
          ) : (
            draft.items.map((item, index) => {
              const food = foodById.get(item.foodItemId);
              return (
                <div
                  className="grid gap-2 rounded-md border border-stone-200 bg-white p-2 md:grid-cols-[1fr_8rem_auto]"
                  key={`${item.foodItemId}-${index}`}
                >
                  <select
                    aria-label="Component food"
                    className="min-h-10 rounded-md border border-stone-300 bg-white px-2 text-sm"
                    onChange={(event) =>
                      updateComponent(index, { foodItemId: event.target.value })
                    }
                    value={item.foodItemId}
                  >
                    {foods.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.name}
                      </option>
                    ))}
                  </select>
                  <NumberInput
                    label="Quantity"
                    onChange={(value) =>
                      updateComponent(index, { quantity: parseOptionalNumber(value) ?? 0 })
                    }
                    step="0.1"
                    unit="servings"
                    value={item.quantity}
                  />
                  <div className="flex flex-wrap items-end gap-2">
                    <SmallButton onClick={() => moveComponent(index, -1)}>Up</SmallButton>
                    <SmallButton onClick={() => moveComponent(index, 1)}>Down</SmallButton>
                    <SmallButton
                      onClick={() =>
                        setDraft((current) => ({
                          ...current,
                          items: current.items.filter((_, itemIndex) => itemIndex !== index),
                        }))
                      }
                    >
                      Remove
                    </SmallButton>
                  </div>
                  {!food && <p className="text-sm text-red-700">Missing library item.</p>}
                </div>
              );
            })
          )}
        </div>
      </section>

      <section className="rounded-md border border-stone-200 bg-stone-50 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-stone-950">Meal nutrition</h3>
            <p className="mt-1 text-xs text-stone-500">
              Current preview: {formatNumber(visibleNutrition.nutrition?.caloriesKcal)} kcal
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <SmallButton
              onClick={() =>
                setDraft((current) => ({
                  ...current,
                  manualNutritionOverride: {
                    nutrition: calculated.nutrition ?? emptyNutrition,
                    nutritionStatus: calculated.status,
                    sourceLabel: "Calculated from components",
                    assumptions: [],
                    updatedAt: new Date().toISOString(),
                  },
                }))
              }
            >
              Use calculated
            </SmallButton>
            <SmallButton
              onClick={() =>
                setDraft((current) => ({
                  ...current,
                  manualNutritionOverride: {
                    nutrition: current.manualNutritionOverride?.nutrition ?? emptyNutrition,
                    nutritionStatus:
                      current.manualNutritionOverride?.nutritionStatus ?? "estimated",
                    sourceLabel:
                      current.manualNutritionOverride?.sourceLabel ?? "Manual correction",
                    assumptions: current.manualNutritionOverride?.assumptions ?? [],
                    updatedAt: new Date().toISOString(),
                  },
                }))
              }
            >
              Enter manually
            </SmallButton>
          </div>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {nutritionKeys.map(({ key, label, unit }) => (
            <NumberInput
              key={key}
              label={label}
              onChange={(value) => updateManualNutrition(key, value)}
              step="0.1"
              unit={unit}
              value={manualNutrition[key] ?? ""}
            />
          ))}
        </div>
        {draft.manualNutritionOverride && (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label>
              <span className="text-sm font-medium text-stone-700">Nutrition status</span>
              <select
                className="mt-2 min-h-11 w-full rounded-md border border-stone-300 bg-white px-3 text-sm"
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    manualNutritionOverride: current.manualNutritionOverride
                      ? {
                          ...current.manualNutritionOverride,
                          nutritionStatus: event.target.value as NutritionStatus,
                        }
                      : null,
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
              label="Source"
              onChange={(value) =>
                setDraft((current) => ({
                  ...current,
                  manualNutritionOverride: current.manualNutritionOverride
                    ? {
                        ...current.manualNutritionOverride,
                        sourceLabel: value || null,
                      }
                    : null,
                }))
              }
              value={draft.manualNutritionOverride.sourceLabel ?? ""}
            />
          </div>
        )}
      </section>

      <RatingPicker
        onChange={(rating) => setDraft((current) => ({ ...current, userRating: rating }))}
        rating={draft.userRating ?? null}
      />

      <MetadataEditor
        entries={draft.metadataEntries ?? []}
        onAdd={() =>
          setDraft((current) => ({
            ...current,
            metadataEntries: [
              ...(current.metadataEntries ?? []),
              { id: makeId("metadata"), label: "Brand", value: "" },
            ],
          }))
        }
        onRemove={(id) =>
          setDraft((current) => ({
            ...current,
            metadataEntries: (current.metadataEntries ?? []).filter((entry) => entry.id !== id),
          }))
        }
        onUpdate={updateMetadata}
      />

      {error && <p className="text-sm font-semibold text-red-700">{error}</p>}
      <div className="grid gap-2 sm:grid-cols-[auto_1fr]">
        <SmallButton onClick={cancel}>Cancel</SmallButton>
        <button className="btn btn-primary-dark min-h-11 px-4 text-sm" onClick={save} type="button">
          Save changes
        </button>
      </div>
    </section>
  );
}

function MetadataEditor({
  entries,
  onAdd,
  onRemove,
  onUpdate,
}: {
  entries: FoodMetadataEntry[];
  onAdd: () => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, patch: Partial<FoodMetadataEntry>) => void;
}) {
  return (
    <section className="rounded-md border border-stone-200 bg-stone-50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-stone-950">Optional details</h3>
        <SmallButton onClick={onAdd}>Add optional detail</SmallButton>
      </div>
      <div className="mt-3 grid gap-2">
        {entries.length === 0 ? (
          <p className="text-sm text-stone-500">No optional details.</p>
        ) : (
          entries.map((entry) => (
            <div className="grid gap-2 md:grid-cols-[12rem_1fr_auto]" key={entry.id}>
              <select
                aria-label="Detail name"
                className="min-h-10 rounded-md border border-stone-300 bg-white px-2 text-sm"
                onChange={(event) =>
                  onUpdate(entry.id, {
                    label: event.target.value === "__custom" ? "" : event.target.value,
                  })
                }
                value={commonMetadataLabels.includes(entry.label) ? entry.label : "__custom"}
              >
                {commonMetadataLabels.map((label) => (
                  <option key={label} value={label}>
                    {label}
                  </option>
                ))}
                <option value="__custom">Custom detail</option>
              </select>
              <input
                aria-label={`${entry.label || "Detail"} value`}
                className="min-h-10 rounded-md border border-stone-300 px-2 text-sm"
                onChange={(event) => onUpdate(entry.id, { value: event.target.value })}
                placeholder="Value"
                type={entry.label === "Purchase date" ? "date" : "text"}
                value={entry.value}
              />
              <SmallButton onClick={() => onRemove(entry.id)}>Remove</SmallButton>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function RatingPicker({
  onChange,
  rating,
}: {
  onChange: (rating: PersonalFoodRating | null) => void;
  rating: PersonalFoodRating | null;
}) {
  return (
    <section className="rounded-md border border-stone-200 bg-stone-50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-stone-950">My rating</h3>
        {rating ? <SmallButton onClick={() => onChange(null)}>Clear rating</SmallButton> : null}
      </div>
      <div className="mt-2 flex flex-wrap gap-1" role="group" aria-label="My rating">
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
        Personal preference only, not a health or nutrition score.
      </p>
    </section>
  );
}

function EditorGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-3 md:grid-cols-2">{children}</div>;
}

function TextInput({
  error,
  label,
  list,
  onChange,
  type = "text",
  value,
}: {
  error?: string;
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
        onChange={(event) => onChange(event.target.value)}
        type={type}
        value={value}
      />
      {error && <p className="mt-2 text-sm font-medium text-red-700">{error}</p>}
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
      <div className="mt-2 flex min-h-11 rounded-md border border-stone-300 focus-within:border-stone-900">
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

function SmallButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      className="btn btn-secondary-outline min-h-10 px-3 text-sm"
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}
