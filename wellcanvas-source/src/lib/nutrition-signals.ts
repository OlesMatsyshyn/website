import type { NutritionStatus, NutritionValues } from "@/lib/food-library";

export type NutritionSignal = {
  label: string;
  tone: "amber" | "blue" | "emerald" | "stone";
};

export function nutritionSignals({
  nutrition,
  status,
}: {
  nutrition: NutritionValues | null;
  status: NutritionStatus;
}) {
  const signals: NutritionSignal[] = [];

  if (nutrition?.proteinG !== null && nutrition?.proteinG !== undefined && nutrition.proteinG >= 20) {
    signals.push({ label: "Protein-rich", tone: "blue" });
  }

  if (nutrition?.fibreG !== null && nutrition?.fibreG !== undefined && nutrition.fibreG >= 3) {
    signals.push({ label: "Fibre source", tone: "emerald" });
  }

  if (nutrition?.sodiumMg !== null && nutrition?.sodiumMg !== undefined && nutrition.sodiumMg >= 700) {
    signals.push({ label: "Higher sodium", tone: "amber" });
  }

  if (
    nutrition?.saturatedFatG !== null &&
    nutrition?.saturatedFatG !== undefined &&
    nutrition.saturatedFatG >= 5
  ) {
    signals.push({ label: "Higher saturated fat", tone: "amber" });
  }

  if (status === "estimated") {
    signals.push({ label: "Estimated", tone: "stone" });
  }

  if (status === "official") {
    signals.push({ label: "Official", tone: "stone" });
  }

  return signals;
}
