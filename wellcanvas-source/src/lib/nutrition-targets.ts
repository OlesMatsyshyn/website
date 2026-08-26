export type NutritionTargets = {
  caloriesKcal: number | null;
  proteinG: number;
  fibreG: number;
  saturatedFatLimitG: number;
  sodiumLimitMg: number;
  source: "custom" | "recommended" | "recommended-edited";
  updatedAt: string;
};

export type DailyMovement = "seated" | "mixed" | "on-feet";
export type ExerciseType = "none" | "cardio" | "lifting" | "mixed";
export type ExerciseAmountMode = "sessions" | "hours";
export type EnergyProfile = "female" | "male" | "skip";
export type ExerciseAmountLevel = "none" | "light" | "regular" | "substantial";

export type RecommendationProfile = {
  ageYears: string;
  heightCm: string;
  weightKg: string;
  dailyMovement: DailyMovement;
  exerciseType: ExerciseType;
  exerciseAmountMode: ExerciseAmountMode;
  sessionsPerWeek: string;
  hoursPerWeek: string;
  energyProfile: EnergyProfile;
  standardMayNotApply: boolean;
};

export type RecommendationResult = {
  targets: Omit<NutritionTargets, "source" | "updatedAt">;
  maintenanceCalories: number | null;
  calorieRange: { low: number; high: number } | null;
  activityFactor: number | null;
  exerciseAmountLevel: ExerciseAmountLevel;
  calorieEstimateSkipped: boolean;
};

export const NUTRITION_TARGETS_STORAGE_KEY =
  "health-tracker-pwa.nutrition-targets.v1";
export const RECOMMENDATION_PROFILE_STORAGE_KEY =
  "health-tracker-pwa.recommendation-profile.v1";
export const NUTRITION_TARGETS_CHANGED_EVENT =
  "health-tracker:nutrition-targets-changed";

export const DEFAULT_NUTRITION_TARGETS: NutritionTargets = {
  caloriesKcal: 2100,
  proteinG: 130,
  fibreG: 32,
  saturatedFatLimitG: 22,
  sodiumLimitMg: 2300,
  source: "custom",
  updatedAt: "",
};

export const DEFAULT_RECOMMENDATION_PROFILE: RecommendationProfile = {
  ageYears: "",
  heightCm: "",
  weightKg: "",
  dailyMovement: "mixed",
  exerciseType: "mixed",
  exerciseAmountMode: "sessions",
  sessionsPerWeek: "3",
  hoursPerWeek: "",
  energyProfile: "skip",
  standardMayNotApply: false,
};

export function roundToNearest(value: number, increment: number) {
  return Math.round(value / increment) * increment;
}

export function classifyExerciseAmount(
  mode: ExerciseAmountMode,
  amount: number,
): ExerciseAmountLevel {
  if (mode === "sessions") {
    if (amount <= 0) return "none";
    if (amount <= 2) return "light";
    if (amount <= 5) return "regular";
    return "substantial";
  }

  if (amount < 1) return "none";
  if (amount < 3) return "light";
  if (amount < 7) return "regular";
  return "substantial";
}

export function activityFactorFor(
  dailyMovement: DailyMovement,
  exerciseAmountLevel: ExerciseAmountLevel,
) {
  if (dailyMovement === "seated") {
    return exerciseAmountLevel === "none"
      ? 1.2
      : exerciseAmountLevel === "substantial"
        ? 1.5
        : 1.35;
  }

  if (dailyMovement === "mixed") {
    return exerciseAmountLevel === "regular" ||
      exerciseAmountLevel === "substantial"
      ? 1.5
      : 1.35;
  }

  return exerciseAmountLevel === "substantial" ? 1.65 : 1.5;
}

export function restingEnergyMifflinStJeor({
  ageYears,
  heightCm,
  weightKg,
  energyProfile,
}: {
  ageYears: number;
  heightCm: number;
  weightKg: number;
  energyProfile: Exclude<EnergyProfile, "skip">;
}) {
  const profileConstant = energyProfile === "male" ? 5 : -161;
  return 10 * weightKg + 6.25 * heightCm - 5 * ageYears + profileConstant;
}

export function proteinTargetFor(weightKg: number, exerciseType: ExerciseType) {
  const gramsPerKg =
    exerciseType === "none" ? 0.8 : exerciseType === "cardio" ? 1.0 : 1.2;
  return roundToNearest(weightKg * gramsPerKg, 5);
}

export function calculateRecommendations({
  ageYears,
  heightCm,
  weightKg,
  dailyMovement,
  exerciseType,
  exerciseAmountMode,
  exerciseAmount,
  energyProfile,
}: {
  ageYears: number;
  heightCm: number;
  weightKg: number;
  dailyMovement: DailyMovement;
  exerciseType: ExerciseType;
  exerciseAmountMode: ExerciseAmountMode;
  exerciseAmount: number;
  energyProfile: EnergyProfile;
}): RecommendationResult {
  const exerciseAmountLevel = classifyExerciseAmount(
    exerciseAmountMode,
    exerciseAmount,
  );
  const proteinG = proteinTargetFor(weightKg, exerciseType);

  if (energyProfile === "skip") {
    return {
      targets: {
        caloriesKcal: null,
        proteinG,
        fibreG: 28,
        saturatedFatLimitG: 22,
        sodiumLimitMg: 2300,
      },
      maintenanceCalories: null,
      calorieRange: null,
      activityFactor: null,
      exerciseAmountLevel,
      calorieEstimateSkipped: true,
    };
  }

  const activityFactor = activityFactorFor(dailyMovement, exerciseAmountLevel);
  const restingEnergy = restingEnergyMifflinStJeor({
    ageYears,
    heightCm,
    weightKg,
    energyProfile,
  });
  const maintenanceCalories = roundToNearest(restingEnergy * activityFactor, 50);

  return {
    targets: {
      caloriesKcal: maintenanceCalories,
      proteinG,
      fibreG: Math.round((14 * maintenanceCalories) / 1000),
      saturatedFatLimitG: Math.round((maintenanceCalories * 0.1) / 9),
      sodiumLimitMg: 2300,
    },
    maintenanceCalories,
    calorieRange: {
      low: roundToNearest(maintenanceCalories * 0.9, 50),
      high: roundToNearest(maintenanceCalories * 1.1, 50),
    },
    activityFactor,
    exerciseAmountLevel,
    calorieEstimateSkipped: false,
  };
}

export function isNutritionTargets(value: unknown): value is NutritionTargets {
  if (!value || typeof value !== "object") {
    return false;
  }

  const target = value as NutritionTargets;
  return (
    (typeof target.caloriesKcal === "number" || target.caloriesKcal === null) &&
    typeof target.proteinG === "number" &&
    typeof target.fibreG === "number" &&
    typeof target.saturatedFatLimitG === "number" &&
    typeof target.sodiumLimitMg === "number" &&
    ["custom", "recommended", "recommended-edited"].includes(target.source) &&
    typeof target.updatedAt === "string"
  );
}
