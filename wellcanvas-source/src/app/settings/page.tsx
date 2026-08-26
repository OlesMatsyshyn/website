"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from "react";
import { PageHeader } from "@/components/page-header";
import { ProfileAvatar } from "@/components/profile-avatar";
import { ToastBridge } from "@/components/toast";
import {
  activeRotatingBackgroundId,
  BACKGROUND_INTERVAL_OPTIONS,
  backgroundNameForId,
  BUILT_IN_BACKGROUNDS,
  DEFAULT_BACKGROUND_ID,
  nextRotatingBackgroundId,
  orderedEnabledBackgroundIds,
} from "@/lib/backgrounds";
import {
  calculateRecommendations,
  DEFAULT_NUTRITION_TARGETS,
  DEFAULT_RECOMMENDATION_PROFILE,
  isNutritionTargets,
  NUTRITION_TARGETS_CHANGED_EVENT,
  NUTRITION_TARGETS_STORAGE_KEY,
  RECOMMENDATION_PROFILE_STORAGE_KEY,
  type DailyMovement,
  type EnergyProfile,
  type ExerciseAmountMode,
  type ExerciseType,
  type NutritionTargets,
  type RecommendationProfile,
  type RecommendationResult,
} from "@/lib/nutrition-targets";
import {
  accentThemes,
  applyAppearance,
  backgroundOptions,
  DEFAULT_APPEARANCE,
  DEFAULT_PROFILE,
  PROFILE_PRESET_PHOTO_PATH,
  readAppearance,
  readProfile,
  saveAppearance,
  saveProfile,
  type AccentTheme,
  type AppearancePreferences,
  type UserProfile,
} from "@/lib/personalization";
import {
  calculateProfilePhotoTransform,
  clampProfilePosition,
  clampProfileZoom,
  dragDeltaToProfilePosition,
  profilePhotoImageStyle,
  type ProfilePhotoGeometry,
} from "@/lib/profile-photo";
import {
  readReferencePhotoUrl,
  saveProfilePhoto,
} from "@/lib/reference-photos";
import {
  DEFAULT_HYDRATION_PREFERENCES,
  readHydrationPreferences,
  saveHydrationPreferences,
  type HydrationPreferences,
} from "@/lib/hydration";
import {
  DEFAULT_CALENDAR_PREFERENCES,
  readCalendarPreferences,
  saveCalendarPreferences,
  type CalendarPreferences,
} from "@/lib/calendar";
import {
  createWellCanvasBackup,
  dateStamp,
  downloadBlob,
  readWellCanvasBackup,
  restoreWellCanvasBackup,
  type WellCanvasBackupPreview,
} from "@/lib/portability";

type TargetMode = "custom" | "recommended";
type TargetDraft = {
  caloriesKcal: string;
  hydrationMl: string;
  proteinG: string;
  fibreG: string;
  saturatedFatLimitG: string;
  sodiumLimitMg: string;
};
type ProfileErrorField =
  | "ageYears"
  | "heightCm"
  | "weightKg"
  | "sessionsPerWeek"
  | "hoursPerWeek"
  | "standardMayNotApply";
type SaveState = "idle" | "saving" | "saved";
type SettingsSection =
  | "profile"
  | "targets"
  | "appearance"
  | null;

const movementOptions: Array<{ value: DailyMovement; label: string }> = [
  { value: "seated", label: "Mostly seated" },
  { value: "mixed", label: "Mixed sitting and walking" },
  { value: "on-feet", label: "Mostly on feet" },
];

const exerciseOptions: Array<{ value: ExerciseType; label: string }> = [
  { value: "none", label: "None" },
  { value: "cardio", label: "Cardio" },
  { value: "lifting", label: "Lifting" },
  { value: "mixed", label: "Mixed cardio and lifting" },
];

const energyProfileOptions: Array<{ value: EnergyProfile; label: string }> = [
  { value: "female", label: "Female equation" },
  { value: "male", label: "Male equation" },
  { value: "skip", label: "Skip calorie estimate" },
];

function targetToDraft(
  target: NutritionTargets,
  hydration: HydrationPreferences = DEFAULT_HYDRATION_PREFERENCES,
): TargetDraft {
  return {
    caloriesKcal: target.caloriesKcal === null ? "" : String(target.caloriesKcal),
    hydrationMl: String(hydration.targetMl),
    proteinG: String(target.proteinG),
    fibreG: String(target.fibreG),
    saturatedFatLimitG: String(target.saturatedFatLimitG),
    sodiumLimitMg: String(target.sodiumLimitMg),
  };
}

function recommendationToDraft(result: RecommendationResult): TargetDraft {
  return {
    caloriesKcal:
      result.targets.caloriesKcal === null
        ? ""
        : String(result.targets.caloriesKcal),
    hydrationMl: String(DEFAULT_HYDRATION_PREFERENCES.targetMl),
    proteinG: String(result.targets.proteinG),
    fibreG: String(result.targets.fibreG),
    saturatedFatLimitG: String(result.targets.saturatedFatLimitG),
    sodiumLimitMg: String(result.targets.sodiumLimitMg),
  };
}

function parseNumber(value: string) {
  if (value.trim() === "") {
    return Number.NaN;
  }

  return Number(value);
}

function formatNumber(value: number | null) {
  return value === null ? "Not estimated" : value.toLocaleString();
}

function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-4 w-4 rounded-full border-2 border-current border-r-transparent motion-safe:animate-spin"
    />
  );
}

function validateTargetDraft(draft: TargetDraft) {
  const fields = [
    ["caloriesKcal", "Daily calories"] as const,
    ["hydrationMl", "Hydration"] as const,
    ["proteinG", "Protein"] as const,
    ["fibreG", "Fibre"] as const,
    ["saturatedFatLimitG", "Saturated fat upper limit"] as const,
    ["sodiumLimitMg", "Sodium upper limit"] as const,
  ];

  const errors: Partial<Record<keyof TargetDraft, string>> = {};

  for (const [field, label] of fields) {
    if (field === "caloriesKcal" && draft[field].trim() === "") {
      continue;
    }

    const parsed = parseNumber(draft[field]);
    if (!Number.isFinite(parsed)) {
      errors[field] = `${label} needs a number.`;
    } else if (parsed < 0) {
      errors[field] = `${label} cannot be negative.`;
    }
  }

  return errors;
}

function makeHydrationPreferencesFromDraft(
  draft: TargetDraft,
  current: HydrationPreferences,
): HydrationPreferences {
  return {
    ...current,
    targetMode: "custom",
    targetMl: Math.round(parseNumber(draft.hydrationMl)),
    showGeneralRange: false,
    updatedAt: new Date().toISOString(),
  };
}

function makeTargetsFromDraft(
  draft: TargetDraft,
  source: NutritionTargets["source"],
): NutritionTargets {
  return {
    caloriesKcal:
      draft.caloriesKcal.trim() === "" ? null : parseNumber(draft.caloriesKcal),
    proteinG: parseNumber(draft.proteinG),
    fibreG: parseNumber(draft.fibreG),
    saturatedFatLimitG: parseNumber(draft.saturatedFatLimitG),
    sodiumLimitMg: parseNumber(draft.sodiumLimitMg),
    source,
    updatedAt: new Date().toISOString(),
  };
}

function NumberField({
  error,
  id,
  label,
  onChange,
  step = "1",
  value,
  unit,
}: {
  error?: string;
  id?: string;
  label: string;
  onChange: (value: string) => void;
  step?: string;
  value: string;
  unit: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-stone-700">{label}</span>
      <div className="mt-2 flex min-h-12 items-center rounded-md border border-stone-300 bg-white focus-within:border-stone-900">
        <input
          className="min-w-0 flex-1 bg-transparent px-4 py-3 text-base font-semibold outline-none"
          id={id}
          inputMode="decimal"
          min="0"
          onChange={(event) => onChange(event.target.value)}
          step={step}
          type="number"
          value={value}
        />
        <span className="pr-4 text-sm text-stone-500">{unit}</span>
      </div>
      {error && <p className="mt-2 text-sm font-medium text-red-700">{error}</p>}
    </label>
  );
}

function ProfileMetricField({
  error,
  id,
  label,
  onChange,
  step = "1",
  value,
  unit,
}: {
  error?: string;
  id: string;
  label: string;
  onChange: (value: string) => void;
  step?: string;
  value: string;
  unit: string;
}) {
  return (
    <label className="profile-metric-field">
      <span className="profile-editor-label">{label}</span>
      <span className="profile-metric-control">
        <input
          aria-describedby={`${id}-unit${error ? ` ${id}-error` : ""}`}
          id={id}
          inputMode="decimal"
          min="0"
          onChange={(event) => onChange(event.target.value)}
          step={step}
          type="number"
          value={value}
        />
        <span className="profile-metric-unit" id={`${id}-unit`}>
          {unit}
        </span>
      </span>
      {error && (
        <span className="profile-field-error" id={`${id}-error`}>
          {error}
        </span>
      )}
    </label>
  );
}

function ChoiceGroup<T extends string>({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string }>;
  value: T;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-medium text-stone-700">{label}</legend>
      <div className="mt-2 grid gap-2">
        {options.map((option) => (
          <label
            className={`flex min-h-12 items-center rounded-md border px-4 text-sm font-semibold ${
              value === option.value
                ? "accent-selected"
                : "border-stone-300 bg-white text-stone-800"
            }`}
            key={option.value}
          >
            <input
              checked={value === option.value}
              className="sr-only"
              name={label}
              onChange={() => onChange(option.value)}
              type="radio"
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function SettingsSummaryCard({
  actions,
  children,
  className = "",
  expandedClassName = "",
  isOpen,
  summary,
  title,
}: {
  actions: ReactNode;
  children: ReactNode;
  className?: string;
  expandedClassName?: string;
  isOpen: boolean;
  summary: ReactNode;
  title: string;
}) {
  return (
    <section className={`wc-section wc-section-padded shadow-sm ${className}`}>
      <div className="settings-summary-card-header flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-stone-950">{title}</h2>
          <div className="mt-1 text-sm text-stone-500">{summary}</div>
        </div>
        <div className="settings-summary-card-actions flex shrink-0 flex-wrap justify-end gap-2">{actions}</div>
      </div>
      {isOpen && (
        <div
          className={`mt-4 rounded-[var(--wc-card-radius)] border border-stone-100 p-[var(--wc-card-padding)] ${expandedClassName}`}
        >
          {children}
        </div>
      )}
    </section>
  );
}

const focusLabels: Record<UserProfile["currentFocus"], string> = {
  none: "No specific goal",
  "maintain-routine": "Maintain current routine",
  "general-fitness": "Improve general fitness",
  "strength-muscle": "Support strength and muscle development",
  "gradual-weight-change": "Support gradual weight change",
};

function energyProfileLabel(profile: EnergyProfile) {
  if (profile === "male") return "Male energy equation";
  if (profile === "female") return "Female energy equation";
  return "Energy estimate skipped";
}

function ProfileCardSummary({
  personalProfile,
  profile,
}: {
  personalProfile: UserProfile;
  profile: RecommendationProfile;
}) {
  const name = personalProfile.displayName.trim() || "No display name";
  const details = [
    profile.ageYears.trim() ? `${profile.ageYears.trim()} y` : null,
    profile.heightCm.trim() ? `${profile.heightCm.trim()} cm` : null,
    profile.weightKg.trim() ? `${profile.weightKg.trim()} kg` : null,
  ].filter(Boolean);

  return (
    <div className="flex items-center gap-3">
      <ProfileAvatar
        className="ring-stone-200"
        fallbackText={name.slice(0, 1).toUpperCase()}
        profile={personalProfile}
        sizeClassName="h-12 w-12"
      />
      <span className="min-w-0">
        <span className="block font-medium text-stone-700">{name}</span>
        <span className="mt-0.5 block">
          {details.length > 0 ? details.join(" · ") : "Age, height and weight not set"}
        </span>
        <span className="mt-0.5 block">
          {energyProfileLabel(profile.energyProfile)} ·{" "}
          {focusLabels[personalProfile.currentFocus]}
        </span>
      </span>
    </div>
  );
}

function compactTargetsSummary(
  targets: NutritionTargets,
  hydration: HydrationPreferences,
) {
  return (
    <>
      <p>
        {targets.caloriesKcal === null
          ? "Calories not estimated"
          : `${formatNumber(targets.caloriesKcal)} kcal`}{" "}
        · {targets.proteinG} g protein · {targets.fibreG} g fibre
      </p>
      <p className="mt-0.5">
        Hydration {(hydration.targetMl / 1000).toFixed(1)} L · Saturated fat{" "}
        {targets.saturatedFatLimitG} g limit · Sodium{" "}
        {formatNumber(targets.sodiumLimitMg)} mg limit
      </p>
    </>
  );
}

function compactAppearanceSummary(appearance: AppearancePreferences) {
  const enabledCount = orderedEnabledBackgroundIds(
    appearance.enabledBackgroundIds,
  ).length;
  const backgroundLabel =
    appearance.backgroundMode === "automatic"
      ? `Rotating ${enabledCount} ${
          enabledCount === 1 ? "background" : "backgrounds"
        } every ${appearance.rotationIntervalHours} h`
      : appearance.background === "none"
        ? "No background"
        : backgroundOptions[appearance.selectedBackgroundId]?.label ??
          backgroundNameForId(appearance.selectedBackgroundId) ??
          "Nature background";
  const panelLabel =
    appearance.panelTransparency === "solid"
      ? "Solid panels"
      : appearance.panelTransparency === "soft"
        ? "Soft panels"
        : "Glass panels";

  return (
    <span>
      {accentThemes[appearance.accentTheme].label} · {backgroundLabel} · {panelLabel}
    </span>
  );
}

function compactCalendarSummary(preferences: CalendarPreferences) {
  return (
    <span>
      Week starts on {preferences.weekStartsOn === "monday" ? "Monday" : "Sunday"}
    </span>
  );
}

function resolveAppearanceBackgroundId(appearance: AppearancePreferences) {
  if (appearance.backgroundMode !== "automatic") {
    return appearance.background === "none"
      ? "none"
      : appearance.selectedBackgroundId || DEFAULT_BACKGROUND_ID;
  }

  return activeRotatingBackgroundId({
    enabledBackgroundIds: appearance.enabledBackgroundIds,
    intervalHours: appearance.rotationIntervalHours,
    rotationStartTimestamp: appearance.rotationStartTimestamp,
    selectedBackgroundId: appearance.selectedBackgroundId,
  });
}

function ProfileSettings({
  onProfileSaved,
  profileDetails,
}: {
  onProfileSaved?: (profile: UserProfile) => void;
  profileDetails?: ReactNode;
}) {
  const [savedDraft, setSavedDraft] = useState<UserProfile>(DEFAULT_PROFILE);
  const [draft, setDraft] = useState<UserProfile>(DEFAULT_PROFILE);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [error, setError] = useState("");
  const cropRef = useRef<HTMLDivElement | null>(null);
  const dragStartRef = useRef<{
    clientX: number;
    clientY: number;
    positionX: number;
    positionY: number;
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [imageSize, setImageSize] = useState<{
    height: number;
    width: number;
  } | null>(null);
  const [viewportSize, setViewportSize] = useState<{
    height: number;
    width: number;
  } | null>(null);
  const photoPath =
    draft.photoSource === "preset"
      ? draft.presetPhotoPath
      : draft.photoSource === "uploaded"
        ? uploadedUrl
        : null;
  const cropGeometry: ProfilePhotoGeometry | null =
    imageSize && viewportSize
      ? {
          imageNaturalHeight: imageSize.height,
          imageNaturalWidth: imageSize.width,
          viewportHeight: viewportSize.height,
          viewportWidth: viewportSize.width,
        }
      : null;
  const cropTransform = cropGeometry
    ? calculateProfilePhotoTransform(draft, cropGeometry)
    : null;

  useEffect(() => {
    queueMicrotask(() => {
      const nextProfile = readProfile();
      setSavedDraft(nextProfile);
      setDraft(nextProfile);
    });
  }, []);

  useEffect(() => {
    let active = true;
    if (draft.photoSource !== "uploaded" || !draft.uploadedPhotoId) {
      return;
    }

    readReferencePhotoUrl(draft.uploadedPhotoId)
      .then((url) => {
        if (active) setUploadedUrl(url);
      })
      .catch(() => {
        if (active) setError("Could not load uploaded profile photo.");
      });

    return () => {
      active = false;
    };
  }, [draft.photoSource, draft.uploadedPhotoId]);

  useEffect(() => {
    const element = cropRef.current;
    if (!element || typeof ResizeObserver === "undefined") return;

    const updateSize = () => {
      const rect = element.getBoundingClientRect();
      setViewportSize({ height: rect.height, width: rect.width });
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(element);
    return () => observer.disconnect();
  }, [photoPath]);

  function persist(nextProfile: UserProfile) {
    setSaveState("saving");
    setError("");
    window.setTimeout(() => {
      try {
        const savedProfile = { ...nextProfile, updatedAt: new Date().toISOString() };
        saveProfile(savedProfile);
        setSavedDraft(savedProfile);
        setDraft(savedProfile);
        onProfileSaved?.(savedProfile);
        setSaveState("saved");
        window.setTimeout(() => setSaveState("idle"), 1500);
      } catch {
        setError("Profile could not be saved.");
        setSaveState("idle");
      }
    }, 180);
  }

  function saveCurrent() {
    persist(draft);
  }

  function selectPreset() {
    const nextProfile = {
      ...draft,
      photoSource: "preset" as const,
      presetPhotoPath: PROFILE_PRESET_PHOTO_PATH,
      uploadedPhotoId: null,
      photoPositionX: 50,
      photoPositionY: 50,
      photoZoom: 1,
    };
    setDraft(nextProfile);
    setUploadedUrl(null);
  }

  async function uploadPhoto(file: File | undefined) {
    if (!file) return;
    setSaveState("saving");
    setError("");

    try {
      const uploadedPhotoId = await saveProfilePhoto(file);
      const url = await readReferencePhotoUrl(uploadedPhotoId);
      const nextProfile = {
        ...draft,
        photoSource: "uploaded" as const,
        presetPhotoPath: null,
        uploadedPhotoId,
        photoPositionX: 50,
        photoPositionY: 50,
        photoZoom: 1,
      };
      setDraft(nextProfile);
      setUploadedUrl(url);
      setSaveState("idle");
    } catch {
      setError("Profile photo could not be saved.");
      setSaveState("idle");
    }
  }

  function removePhoto() {
    const nextProfile = {
      ...draft,
      photoSource: "none" as const,
      presetPhotoPath: null,
      uploadedPhotoId: null,
      photoPositionX: 50,
      photoPositionY: 50,
      photoZoom: 1,
    };
    setDraft(nextProfile);
    setUploadedUrl(null);
  }

  function updateCropFromPointer(event: PointerEvent<HTMLDivElement>) {
    if (!photoPath || !cropGeometry || !dragStartRef.current) return;
    const start = dragStartRef.current;
    const position = dragDeltaToProfilePosition({
      deltaX: event.clientX - start.clientX,
      deltaY: event.clientY - start.clientY,
      geometry: cropGeometry,
      profile: {
        photoPositionX: start.positionX,
        photoPositionY: start.positionY,
        photoZoom: draft.photoZoom,
      },
    });
    setDraft((current) => ({
      ...current,
      ...position,
    }));
  }

  function resetCrop() {
    setDraft((current) => ({
      ...current,
      photoPositionX: 50,
      photoPositionY: 50,
      photoZoom: 1,
    }));
  }

  function cancel() {
    setDraft(savedDraft);
    setError("");
  }

  return (
    <section className="profile-editor-surface">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="profile-editor-title">Your profile</h2>
          <p className="profile-editor-helper mt-1">
            Optional, private to this browser.
          </p>
        </div>
        <span aria-live="polite" className="text-sm font-semibold text-stone-600">
          {saveState === "saving" ? "Saving…" : saveState === "saved" ? "✓ Saved" : ""}
        </span>
      </div>

      <div className="profile-editor-grid mt-4">
        <div className="profile-photo-panel">
          <div
            aria-label="Drag to position profile photo"
            className={`profile-photo-crop relative grid touch-none select-none place-items-center overflow-hidden rounded-full bg-stone-100 text-sm font-semibold text-stone-500 ring-1 ring-stone-200 ${
              photoPath ? "cursor-grab" : ""
            } ${isDragging ? "cursor-grabbing" : ""}`}
            onPointerCancel={() => {
              dragStartRef.current = null;
              setIsDragging(false);
            }}
            onPointerDown={(event) => {
              if (!photoPath || !cropGeometry) return;
              event.currentTarget.setPointerCapture(event.pointerId);
              dragStartRef.current = {
                clientX: event.clientX,
                clientY: event.clientY,
                positionX: draft.photoPositionX,
                positionY: draft.photoPositionY,
              };
              setIsDragging(true);
            }}
            onPointerMove={(event) => {
              if (isDragging) updateCropFromPointer(event);
            }}
            onPointerUp={(event) => {
              if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                event.currentTarget.releasePointerCapture(event.pointerId);
              }
              dragStartRef.current = null;
              setIsDragging(false);
            }}
            ref={cropRef}
            role={photoPath ? "img" : undefined}
          >
            {photoPath ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                alt={
                  draft.displayName.trim()
                    ? `${draft.displayName.trim()} profile photo`
                    : "Profile photo"
                }
                className="absolute max-w-none"
                draggable={false}
                onLoad={(event) =>
                  setImageSize({
                    height: event.currentTarget.naturalHeight,
                    width: event.currentTarget.naturalWidth,
                  })
                }
                src={photoPath}
                style={profilePhotoImageStyle(draft, cropGeometry)}
              />
            ) : (
              <span>No photo</span>
            )}
          </div>
          {photoPath && (
            <label className="w-full">
              <span className="flex items-center justify-between gap-3 profile-editor-label">
                <span>Zoom</span>
                <span className="font-semibold text-stone-500">
                  {draft.photoZoom.toFixed(2)}×
                </span>
              </span>
              <input
                className="mt-2 w-full accent-[var(--accent)]"
                max="2.5"
                min="1"
                aria-valuenow={Number(draft.photoZoom.toFixed(2))}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    photoZoom: clampProfileZoom(Number(event.target.value)),
                  }))
                }
                step="0.05"
                type="range"
                value={draft.photoZoom}
              />
            </label>
          )}
          {photoPath && (
            <div className="grid w-full gap-3">
              <label>
                <span className="flex items-center justify-between gap-3 profile-editor-label">
                  <span>Horizontal position</span>
                  {cropTransform?.overflowX === 0 && (
                    <span className="text-xs font-semibold text-stone-400">
                      No side overflow
                    </span>
                  )}
                </span>
                <input
                  className="mt-2 w-full accent-[var(--accent)]"
                  disabled={cropTransform?.overflowX === 0}
                  max="100"
                  min="0"
                  aria-valuenow={
                    cropTransform?.overflowX === 0 ? 50 : draft.photoPositionX
                  }
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      photoPositionX:
                        cropTransform?.overflowX === 0
                          ? 50
                          : clampProfilePosition(Number(event.target.value)),
                    }))
                  }
                  step="1"
                  type="range"
                  value={cropTransform?.overflowX === 0 ? 50 : draft.photoPositionX}
                />
              </label>
              <label>
                <span className="flex items-center justify-between gap-3 profile-editor-label">
                  <span>Vertical position</span>
                  {cropTransform?.overflowY === 0 && (
                    <span className="text-xs font-semibold text-stone-400">
                      No vertical overflow
                    </span>
                  )}
                </span>
                <input
                  className="mt-2 w-full accent-[var(--accent)]"
                  disabled={cropTransform?.overflowY === 0}
                  max="100"
                  min="0"
                  aria-valuenow={
                    cropTransform?.overflowY === 0 ? 50 : draft.photoPositionY
                  }
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      photoPositionY:
                        cropTransform?.overflowY === 0
                          ? 50
                          : clampProfilePosition(Number(event.target.value)),
                    }))
                  }
                  step="1"
                  type="range"
                  value={cropTransform?.overflowY === 0 ? 50 : draft.photoPositionY}
                />
              </label>
              {cropTransform?.overflowX === 0 && cropTransform.overflowY === 0 && (
                <p className="profile-editor-helper">
                  Increase zoom to reposition the image.
                </p>
              )}
            </div>
          )}
          <div className="grid w-full gap-2">
            {draft.photoSource === "preset" && (
              <p className="justify-self-center rounded-full bg-stone-200 px-2.5 py-1 text-xs font-semibold text-stone-700">
                Preset photo selected
              </p>
            )}
            <div className="profile-photo-actions">
              <label className="btn btn-secondary-outline cursor-pointer">
                Replace photo
                <input
                  accept="image/*"
                  capture="environment"
                  className="sr-only"
                  onChange={(event) => uploadPhoto(event.target.files?.[0])}
                  type="file"
                />
              </label>
              <button className="btn btn-secondary-outline" onClick={selectPreset} type="button">
                Use preset
              </button>
              <button className="btn btn-destructive" onClick={removePhoto} type="button">
                Remove photo
              </button>
              <button className="btn btn-secondary-outline" onClick={resetCrop} type="button">
                Reset position
              </button>
            </div>
          </div>
        </div>

        <div className="profile-fields-panel">
          <label>
            <span className="profile-editor-label">
              Display name, optional
            </span>
            <input
              className="profile-text-input"
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  displayName: event.target.value,
                }))
              }
              value={draft.displayName}
            />
          </label>
          {profileDetails}
          <label>
            <span className="profile-editor-label">Current focus</span>
            <select
              className="profile-text-input bg-white"
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  currentFocus: event.target.value as UserProfile["currentFocus"],
                }))
              }
              value={draft.currentFocus}
            >
              <option value="none">No specific goal</option>
              <option value="maintain-routine">Maintain current routine</option>
              <option value="general-fitness">Improve general fitness</option>
              <option value="strength-muscle">
                Support strength and muscle development
              </option>
              <option value="gradual-weight-change">
                Support gradual weight change
              </option>
            </select>
            <p className="profile-editor-helper mt-2">
              This does not automatically change nutrition targets or create a calorie
              deficit or surplus.
            </p>
          </label>
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              className="btn btn-primary-dark"
              disabled={saveState === "saving"}
              onClick={saveCurrent}
              type="button"
            >
              {saveState === "saving"
                ? "Saving…"
                : saveState === "saved"
                  ? "✓ Saved"
                  : "Save profile"}
            </button>
            <button className="btn btn-tertiary-text" onClick={cancel} type="button">
              Cancel
            </button>
          </div>
        </div>
      </div>
      {error && <p className="mt-3 text-sm font-medium text-red-700">{error}</p>}
    </section>
  );
}

function AppearanceSettings({
  onCancel,
  onAppearanceSaved,
  onCalendarSaved,
}: {
  onCancel: () => void;
  onAppearanceSaved?: (appearance: AppearancePreferences) => void;
  onCalendarSaved?: (preferences: CalendarPreferences) => void;
}) {
  const [draft, setDraft] = useState<AppearancePreferences>(() => DEFAULT_APPEARANCE);
  const [calendarDraft, setCalendarDraft] = useState<CalendarPreferences>(
    DEFAULT_CALENDAR_PREFERENCES,
  );
  const [savedAppearance, setSavedAppearance] =
    useState<AppearancePreferences>(DEFAULT_APPEARANCE);
  const [backgroundMessage, setBackgroundMessage] = useState("");
  const [activeBackgroundId, setActiveBackgroundId] = useState(DEFAULT_BACKGROUND_ID);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const dimOptions = [
    { label: "Light", value: 20 },
    { label: "Medium", value: 40 },
    { label: "Strong", value: 60 },
  ];

  useEffect(() => {
    queueMicrotask(() => {
      const nextAppearance = readAppearance();
      setDraft(nextAppearance);
      setSavedAppearance(nextAppearance);
      applyAppearance(nextAppearance);
      setActiveBackgroundId(resolveAppearanceBackgroundId(nextAppearance));
      setCalendarDraft(readCalendarPreferences());
    });
  }, []);

  function updateAppearance(next: AppearancePreferences) {
    setDraft(next);
    applyAppearance(next);
    setActiveBackgroundId(resolveAppearanceBackgroundId(next));
    setBackgroundMessage("");
    setSaveState("idle");
  }

  function persist(nextAppearance: AppearancePreferences) {
    setSaveState("saving");
    const preparedAppearance =
      nextAppearance.backgroundMode === "automatic" &&
      !nextAppearance.rotationStartTimestamp
        ? {
            ...nextAppearance,
            background:
              nextAppearance.selectedBackgroundId || DEFAULT_BACKGROUND_ID,
            rotationStartTimestamp: new Date().toISOString(),
          }
        : nextAppearance;
    const savedAppearance = { ...preparedAppearance, updatedAt: new Date().toISOString() };
    const savedCalendar = {
      ...calendarDraft,
      updatedAt: new Date().toISOString(),
    };
    saveAppearance(savedAppearance);
    saveCalendarPreferences(savedCalendar);
    setDraft(savedAppearance);
    setSavedAppearance(savedAppearance);
    setActiveBackgroundId(resolveAppearanceBackgroundId(savedAppearance));
    setCalendarDraft(savedCalendar);
    onAppearanceSaved?.(savedAppearance);
    onCalendarSaved?.(savedCalendar);
    setSaveState("saved");
    window.setTimeout(() => {
      setSaveState("idle");
      onCancel();
    }, 700);
  }

  function resetAppearance() {
    const nextAppearance = {
      ...DEFAULT_APPEARANCE,
      updatedAt: new Date().toISOString(),
    };
    updateAppearance(nextAppearance);
    persist(nextAppearance);
  }

  function cancel() {
    setDraft(savedAppearance);
    applyAppearance(savedAppearance);
    setActiveBackgroundId(resolveAppearanceBackgroundId(savedAppearance));
    onCancel();
  }

  function setBackgroundMode(mode: AppearancePreferences["backgroundMode"]) {
    if (mode === "fixed") {
      const nextFixedBackgroundId =
        activeBackgroundId !== "none" ? activeBackgroundId : draft.selectedBackgroundId;
      updateAppearance({
        ...draft,
        background: nextFixedBackgroundId,
        backgroundMode: "fixed",
        selectedBackgroundId: nextFixedBackgroundId,
      });
      return;
    }

    const enabledBackgroundIds = orderedEnabledBackgroundIds(
      draft.enabledBackgroundIds,
    );
    updateAppearance({
      ...draft,
      background: draft.selectedBackgroundId,
      backgroundMode: "automatic",
      enabledBackgroundIds,
      rotationStartTimestamp: draft.rotationStartTimestamp ?? new Date().toISOString(),
    });
  }

  function selectFixedBackground(backgroundId: string | "none") {
    updateAppearance({
      ...draft,
      background: backgroundId,
      backgroundMode: "fixed",
      selectedBackgroundId:
        backgroundId === "none" ? draft.selectedBackgroundId : backgroundId,
    });
  }

  function toggleRotationBackground(backgroundId: string) {
    const enabled = new Set(orderedEnabledBackgroundIds(draft.enabledBackgroundIds));
    if (enabled.has(backgroundId)) {
      if (enabled.size <= 1) {
        setBackgroundMessage("At least one background must remain enabled.");
        return;
      }
      enabled.delete(backgroundId);
    } else {
      enabled.add(backgroundId);
    }
    const enabledBackgroundIds = orderedEnabledBackgroundIds([...enabled]);
    updateAppearance({
      ...draft,
      background:
        enabledBackgroundIds.includes(draft.selectedBackgroundId)
          ? draft.background
          : enabledBackgroundIds[0],
      enabledBackgroundIds,
      selectedBackgroundId:
        enabledBackgroundIds.includes(draft.selectedBackgroundId)
          ? draft.selectedBackgroundId
          : enabledBackgroundIds[0],
    });
  }

  function changeBackgroundNow() {
    const nextBackgroundId = nextRotatingBackgroundId({
      currentBackgroundId: activeBackgroundId || draft.selectedBackgroundId,
      enabledBackgroundIds: draft.enabledBackgroundIds,
    });
    updateAppearance({
      ...draft,
      background: nextBackgroundId,
      backgroundMode: "automatic",
      rotationStartTimestamp: new Date().toISOString(),
      selectedBackgroundId: nextBackgroundId,
    });
  }

  return (
    <section className="wc-section wc-section-padded">
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-lg font-semibold text-stone-950">Appearance</h2>
        <span aria-live="polite" className="text-sm font-semibold text-emerald-700">
          {saveState === "saved" ? "✓ Saved" : ""}
        </span>
      </div>

      <fieldset className="mt-4">
        <legend className="text-sm font-medium text-stone-700">Accent colour</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {(Object.keys(accentThemes) as AccentTheme[]).map((themeKey) => {
            const theme = accentThemes[themeKey];
            const selected = draft.accentTheme === themeKey;
            return (
              <button
                aria-pressed={selected}
                className={`min-h-12 rounded-md border px-3 text-left text-sm font-semibold ${
                  selected
                    ? "border-stone-950 ring-2 ring-[var(--focus-ring)]"
                    : "border-stone-300"
                }`}
                key={themeKey}
                onClick={() =>
                  updateAppearance({
                    ...draft,
                    accentTheme: themeKey,
                  })
                }
                type="button"
              >
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="h-4 w-4 rounded-full"
                    style={{ backgroundColor: theme.accent }}
                  />
                  {theme.label}
                  {selected && <span className="text-xs text-stone-500">Selected</span>}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="mt-5">
        <legend className="text-sm font-medium text-stone-700">Background</legend>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {[
            ["fixed", "Fixed"],
            ["automatic", "Automatic rotation"],
          ].map(([mode, label]) => (
            <button
              aria-pressed={draft.backgroundMode === mode}
              className={`btn ${
                draft.backgroundMode === mode
                  ? "btn-primary-accent"
                  : "btn-secondary-outline"
              }`}
              key={mode}
              onClick={() =>
                setBackgroundMode(mode as AppearancePreferences["backgroundMode"])
              }
              type="button"
            >
              {label}
            </button>
          ))}
        </div>

        {draft.backgroundMode === "fixed" && (
          <button
            aria-pressed={draft.background === "none"}
            className={`mt-3 min-h-10 rounded-md border px-3 text-sm font-semibold ${
              draft.background === "none"
                ? "border-stone-950 ring-2 ring-[var(--focus-ring)]"
                : "border-stone-300 text-stone-800"
            }`}
            onClick={() => selectFixedBackground("none")}
            type="button"
          >
            No background
          </button>
        )}

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {BUILT_IN_BACKGROUNDS.map((background) => {
            const included = draft.enabledBackgroundIds.includes(background.id);
            const fixedSelected =
              draft.backgroundMode === "fixed" &&
              draft.background !== "none" &&
              draft.selectedBackgroundId === background.id;
            const automaticActive =
              draft.backgroundMode === "automatic" &&
              activeBackgroundId === background.id;
            const selected =
              draft.backgroundMode === "automatic"
                ? included
                : fixedSelected;
            return (
              <button
                aria-pressed={selected}
                className={`rounded-md border p-2 text-left text-sm font-semibold ${
                  selected
                    ? "border-stone-950 ring-2 ring-[var(--focus-ring)]"
                    : "border-stone-300"
                }`}
                key={background.id}
                onClick={() =>
                  draft.backgroundMode === "automatic"
                    ? toggleRotationBackground(background.id)
                    : selectFixedBackground(background.id)
                }
                type="button"
              >
                <span className="grid h-16 place-items-center overflow-hidden rounded bg-stone-100 text-xs text-stone-500">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    alt=""
                    className="h-full w-full object-cover"
                    loading="lazy"
                    src={background.src}
                  />
                </span>
                <span className="mt-2 flex items-start justify-between gap-2">
                  <span>
                    {background.name}
                    {fixedSelected && (
                      <span className="ml-2 text-xs text-stone-500">Selected</span>
                    )}
                    {automaticActive && (
                      <span className="ml-2 text-xs text-stone-500">Active</span>
                    )}
                  </span>
                  {draft.backgroundMode === "automatic" && (
                    <span
                      aria-hidden="true"
                      className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded border text-xs ${
                        included
                          ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                          : "border-stone-300 bg-white text-transparent"
                      }`}
                    >
                      ✓
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
        {backgroundMessage && (
          <p aria-live="polite" className="mt-2 text-sm font-medium text-amber-800">
            {backgroundMessage}
          </p>
        )}
        {draft.backgroundMode === "automatic" && (
          <div className="mt-4 rounded-md border border-stone-200 bg-stone-50 p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-stone-950">Change every</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {BACKGROUND_INTERVAL_OPTIONS.map((hours) => (
                    <button
                      aria-pressed={draft.rotationIntervalHours === hours}
                      className={`btn min-h-9 px-3 text-sm ${
                        draft.rotationIntervalHours === hours
                          ? "btn-primary-accent"
                          : "btn-secondary-outline"
                      }`}
                      key={hours}
                      onClick={() =>
                        updateAppearance({
                          ...draft,
                          rotationIntervalHours: hours,
                        })
                      }
                      type="button"
                    >
                      {hours} h
                    </button>
                  ))}
                </div>
              </div>
              <button
                className="btn btn-tertiary-text"
                onClick={changeBackgroundNow}
                type="button"
              >
                Change now
              </button>
            </div>
          </div>
        )}
      </fieldset>

      <fieldset className="mt-5">
        <legend className="text-sm font-medium text-stone-700">Background dimming</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {dimOptions.map((option) => (
            <button
              aria-pressed={draft.backgroundDimPercent === option.value}
              className={`min-h-11 rounded-md border px-3 text-sm font-semibold ${
                draft.backgroundDimPercent === option.value
                  ? "accent-selected"
                  : "border-stone-300 text-stone-800"
              }`}
              key={option.value}
              onClick={() =>
                updateAppearance({
                  ...draft,
                  backgroundDimPercent: option.value,
                })
              }
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="mt-5">
        <legend className="text-sm font-medium text-stone-700">Panel style</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {[
            ["solid", "Solid"],
            ["soft", "Soft transparency"],
            ["glass", "Glass"],
          ].map(([value, label]) => (
            <button
              aria-pressed={draft.panelTransparency === value}
              className={`min-h-11 rounded-md border px-3 text-sm font-semibold ${
                draft.panelTransparency === value
                  ? "accent-selected"
                  : "border-stone-300 text-stone-800"
              }`}
              key={value}
              onClick={() =>
                updateAppearance({
                  ...draft,
                  panelTransparency:
                    value as AppearancePreferences["panelTransparency"],
                })
              }
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      <section className="mt-5 border-t border-stone-200 pt-5">
        <h2 className="text-lg font-semibold text-stone-950">Calendar</h2>
        <div className="mt-3">
          <ChoiceGroup<CalendarPreferences["weekStartsOn"]>
            label="Week starts on"
            onChange={(weekStartsOn) =>
              setCalendarDraft((current) => ({ ...current, weekStartsOn }))
            }
            options={[
              { value: "monday", label: "Monday" },
              { value: "sunday", label: "Sunday" },
            ]}
            value={calendarDraft.weekStartsOn}
          />
        </div>
      </section>

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          className="btn btn-primary-dark"
          onClick={() => persist(draft)}
          type="button"
        >
          {saveState === "saving"
            ? "Saving…"
            : saveState === "saved"
              ? "✓ Saved"
              : "Save preferences"}
        </button>
        <button
          className="btn btn-secondary-outline"
          onClick={resetAppearance}
          type="button"
        >
          Reset appearance
        </button>
        <button className="btn btn-tertiary-text" onClick={cancel} type="button">
          Cancel
        </button>
      </div>
    </section>
  );
}

export default function SettingsPage() {
  const suggestedSectionRef = useRef<HTMLElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [openSection, setOpenSection] = useState<SettingsSection>(null);
  const [mode, setMode] = useState<TargetMode>("custom");
  const [personalProfile, setPersonalProfile] = useState<UserProfile>(() => ({
    displayName: "",
    photoSource: "none",
    presetPhotoPath: null,
    uploadedPhotoId: null,
    photoPositionX: 50,
    photoPositionY: 50,
    photoZoom: 1,
    currentFocus: "none",
    updatedAt: "",
  }));
  const [appearanceSummary, setAppearanceSummary] =
    useState<AppearancePreferences>(DEFAULT_APPEARANCE);
  const [hydrationSummary, setHydrationSummary] =
    useState<HydrationPreferences>(DEFAULT_HYDRATION_PREFERENCES);
  const [calendarSummary, setCalendarSummary] =
    useState<CalendarPreferences>(DEFAULT_CALENDAR_PREFERENCES);
  const [savedTargets, setSavedTargets] = useState<NutritionTargets>(
    DEFAULT_NUTRITION_TARGETS,
  );
  const [targetDraft, setTargetDraft] = useState<TargetDraft>(
    targetToDraft(DEFAULT_NUTRITION_TARGETS, DEFAULT_HYDRATION_PREFERENCES),
  );
  const [targetErrors, setTargetErrors] = useState<
    Partial<Record<keyof TargetDraft, string>>
  >({});
  const [suggestedDraft, setSuggestedDraft] = useState<TargetDraft>(
    targetToDraft(DEFAULT_NUTRITION_TARGETS, DEFAULT_HYDRATION_PREFERENCES),
  );
  const [profile, setProfile] = useState<RecommendationProfile>(
    DEFAULT_RECOMMENDATION_PROFILE,
  );
  const [profileErrors, setProfileErrors] = useState<
    Partial<Record<ProfileErrorField, string>>
  >({});
  const [recommendation, setRecommendation] =
    useState<RecommendationResult | null>(null);
  const [recommendationMessage, setRecommendationMessage] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [calculationSuccess, setCalculationSuccess] = useState("");
  const [saveError, setSaveError] = useState("");
  const [isCalculating, setIsCalculating] = useState(false);
  const [customSaveState, setCustomSaveState] = useState<SaveState>("idle");
  const [suggestedSaveState, setSuggestedSaveState] = useState<SaveState>("idle");
  const [backupPreview, setBackupPreview] = useState<{
    preview: WellCanvasBackupPreview;
    storage: Record<string, string>;
  } | null>(null);

  useEffect(() => {
    queueMicrotask(() => {
      let nextTargets = DEFAULT_NUTRITION_TARGETS;
      let nextProfile = DEFAULT_RECOMMENDATION_PROFILE;

      try {
        const parsedTargets = JSON.parse(
          window.localStorage.getItem(NUTRITION_TARGETS_STORAGE_KEY) ?? "null",
        );
        if (isNutritionTargets(parsedTargets)) {
          nextTargets = parsedTargets;
        }
      } catch {
        nextTargets = DEFAULT_NUTRITION_TARGETS;
      }

      try {
        const parsedProfile = JSON.parse(
          window.localStorage.getItem(RECOMMENDATION_PROFILE_STORAGE_KEY) ?? "null",
        );
        nextProfile = {
          ...DEFAULT_RECOMMENDATION_PROFILE,
          ...(parsedProfile && typeof parsedProfile === "object" ? parsedProfile : {}),
        };
      } catch {
        nextProfile = DEFAULT_RECOMMENDATION_PROFILE;
      }

      const nextHydration = readHydrationPreferences();
      setSavedTargets(nextTargets);
      setTargetDraft(targetToDraft(nextTargets, nextHydration));
      setProfile(nextProfile);
      setPersonalProfile(readProfile());
      setAppearanceSummary(readAppearance());
      setHydrationSummary(nextHydration);
      setCalendarSummary(readCalendarPreferences());
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (loaded) {
      window.localStorage.setItem(
        RECOMMENDATION_PROFILE_STORAGE_KEY,
        JSON.stringify(profile),
      );
    }
  }, [loaded, profile]);

  const profileAge = useMemo(() => parseNumber(profile.ageYears), [profile.ageYears]);
  const profileHeight = useMemo(() => parseNumber(profile.heightCm), [profile.heightCm]);
  const profileWeight = useMemo(() => parseNumber(profile.weightKg), [profile.weightKg]);

  function updateTargetDraft(field: keyof TargetDraft, value: string) {
    setTargetDraft((current) => ({ ...current, [field]: value }));
    setTargetErrors((current) => ({ ...current, [field]: undefined }));
    setConfirmation("");
    setSaveError("");
  }

  function updateProfile(nextProfile: Partial<RecommendationProfile>) {
    setProfile((current) => ({ ...current, ...nextProfile }));
    setRecommendation(null);
    setRecommendationMessage("");
    setCalculationSuccess("");
    setProfileErrors({});
    setConfirmation("");
    setSaveError("");
  }

  function focusField(fieldId: string) {
    window.requestAnimationFrame(() => {
      document.getElementById(fieldId)?.focus();
    });
  }

  function saveTargets() {
    if (customSaveState === "saving") {
      return;
    }

    const errors = validateTargetDraft(targetDraft);
    setTargetErrors(errors);

    if (Object.keys(errors).length > 0) {
      setConfirmation("");
      focusField(`custom-${Object.keys(errors)[0]}`);
      return;
    }

    setCustomSaveState("saving");
    setSaveError("");
    window.setTimeout(() => {
      try {
        const source =
          savedTargets.source === "recommended" ||
          savedTargets.source === "recommended-edited"
            ? "recommended-edited"
            : "custom";
        const nextTargets = makeTargetsFromDraft(targetDraft, source);
        const nextHydration = makeHydrationPreferencesFromDraft(
          targetDraft,
          hydrationSummary,
        );

        setSavedTargets(nextTargets);
        setHydrationSummary(nextHydration);
        window.localStorage.setItem(
          NUTRITION_TARGETS_STORAGE_KEY,
          JSON.stringify(nextTargets),
        );
        window.dispatchEvent(new CustomEvent(NUTRITION_TARGETS_CHANGED_EVENT));
        saveHydrationPreferences(nextHydration);
        setConfirmation("Targets saved");
        setCustomSaveState("saved");
        window.setTimeout(() => {
          setCustomSaveState("idle");
          setOpenSection(null);
        }, 700);
      } catch {
        setSaveError("Targets could not be saved. Try again.");
        setCustomSaveState("idle");
      }
    }, 180);
  }

  function calculateStartingTargets() {
    if (isCalculating) {
      return;
    }

    setRecommendation(null);
    setRecommendationMessage("");
    setCalculationSuccess("");
    setProfileErrors({});
    setConfirmation("");
    setSaveError("");
    setIsCalculating(true);

    if (profile.standardMayNotApply) {
      setProfileErrors({
        standardMayNotApply:
          "Custom targets can still be entered. No medical details are needed.",
      });
      setRecommendationMessage(
        "Standard recommendations may not apply. Custom targets can still be entered and saved.",
      );
      setIsCalculating(false);
      focusField("profile-standardMayNotApply");
      return;
    }

    if (Number.isFinite(profileAge) && profileAge < 18) {
      setProfileErrors({
        ageYears:
          "Automatic numerical targets are intended for adults aged 18 or older.",
      });
      setRecommendationMessage(
        "Automatic numerical targets are intended for adults. Energy and nutrient needs during growth vary, and custom targets remain available.",
      );
      setIsCalculating(false);
      focusField("profile-ageYears");
      return;
    }

    const amountValue =
      profile.exerciseAmountMode === "sessions"
        ? parseNumber(profile.sessionsPerWeek)
        : parseNumber(profile.hoursPerWeek);

    const nextProfileErrors: Partial<Record<ProfileErrorField, string>> = {};

    if (!Number.isFinite(profileAge)) {
      nextProfileErrors.ageYears = "Enter age in years.";
    }
    if (!Number.isFinite(profileHeight)) {
      nextProfileErrors.heightCm = "Enter height in cm.";
    }
    if (!Number.isFinite(profileWeight)) {
      nextProfileErrors.weightKg = "Enter weight in kg.";
    }
    if (!Number.isFinite(amountValue)) {
      nextProfileErrors[
        profile.exerciseAmountMode === "sessions"
          ? "sessionsPerWeek"
          : "hoursPerWeek"
      ] = "Enter exercise amount.";
    }

    if (Object.keys(nextProfileErrors).length > 0) {
      setProfileErrors(nextProfileErrors);
      setRecommendationMessage("Enter the missing information.");
      setIsCalculating(false);
      focusField(`profile-${Object.keys(nextProfileErrors)[0]}`);
      return;
    }

    if (profileAge < 0) {
      nextProfileErrors.ageYears = "Age cannot be negative.";
    }
    if (profileHeight < 0) {
      nextProfileErrors.heightCm = "Height cannot be negative.";
    }
    if (profileWeight < 0) {
      nextProfileErrors.weightKg = "Weight cannot be negative.";
    }
    if (amountValue < 0) {
      nextProfileErrors[
        profile.exerciseAmountMode === "sessions"
          ? "sessionsPerWeek"
          : "hoursPerWeek"
      ] = "Exercise amount cannot be negative.";
    }

    if (Object.keys(nextProfileErrors).length > 0) {
      setProfileErrors(nextProfileErrors);
      setRecommendationMessage("Values cannot be negative.");
      setIsCalculating(false);
      focusField(`profile-${Object.keys(nextProfileErrors)[0]}`);
      return;
    }

    window.setTimeout(() => {
      const result = calculateRecommendations({
        ageYears: profileAge,
        heightCm: profileHeight,
        weightKg: profileWeight,
        dailyMovement: profile.dailyMovement,
        exerciseType: profile.exerciseType,
        exerciseAmountMode: profile.exerciseAmountMode,
        exerciseAmount: amountValue,
        energyProfile: profile.energyProfile,
      });

      setRecommendation(result);
      setSuggestedDraft(recommendationToDraft(result));
      setCalculationSuccess(
        "Starting targets calculated. Review the preview below.",
      );
      setIsCalculating(false);
      window.requestAnimationFrame(() => {
        suggestedSectionRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
        suggestedSectionRef.current?.focus();
      });
    }, 180);
  }

  function suggestedDraftMatchesRecommendation() {
    if (!recommendation) {
      return false;
    }

    const draftTargets = makeTargetsFromDraft(suggestedDraft, "recommended");
    return (
      draftTargets.caloriesKcal === recommendation.targets.caloriesKcal &&
      draftTargets.proteinG === recommendation.targets.proteinG &&
      draftTargets.fibreG === recommendation.targets.fibreG &&
      draftTargets.saturatedFatLimitG ===
        recommendation.targets.saturatedFatLimitG &&
      draftTargets.sodiumLimitMg === recommendation.targets.sodiumLimitMg
    );
  }

  function saveSuggestedTargets() {
    if (suggestedSaveState === "saving" || !recommendation) {
      return;
    }

    const errors = validateTargetDraft(suggestedDraft);

    if (Object.keys(errors).length > 0) {
      setConfirmation("");
      setSaveError("Recommended targets could not be saved. Adjust them manually first.");
      return;
    }

    setSuggestedSaveState("saving");
    setSaveError("");
    window.setTimeout(() => {
      try {
        const nextTargets = makeTargetsFromDraft(
          suggestedDraft,
          suggestedDraftMatchesRecommendation()
            ? "recommended"
            : "recommended-edited",
        );
        const nextHydration = makeHydrationPreferencesFromDraft(
          suggestedDraft,
          hydrationSummary,
        );

        setSavedTargets(nextTargets);
        setHydrationSummary(nextHydration);
        setTargetDraft(targetToDraft(nextTargets, nextHydration));
        window.localStorage.setItem(
          NUTRITION_TARGETS_STORAGE_KEY,
          JSON.stringify(nextTargets),
        );
        window.dispatchEvent(new CustomEvent(NUTRITION_TARGETS_CHANGED_EVENT));
        saveHydrationPreferences(nextHydration);
        setConfirmation("Targets saved");
        setSuggestedSaveState("saved");
        window.setTimeout(() => {
          setSuggestedSaveState("idle");
          setOpenSection(null);
        }, 700);
      } catch {
        setSaveError("Suggested targets could not be saved. Try again.");
        setSuggestedSaveState("idle");
      }
    }, 180);
  }

  function exportWellCanvasBackup() {
    const zip = createWellCanvasBackup();
    downloadBlob(zip, `WellCanvas-backup-${dateStamp()}.zip`);
    setConfirmation("WellCanvas backup ready.");
  }

  async function previewBackupImport(file: File | null) {
    if (!file) return;
    try {
      const backup = await readWellCanvasBackup(file);
      setBackupPreview(backup);
      setConfirmation("Backup ready to review.");
    } catch (error) {
      setBackupPreview(null);
      setSaveError(error instanceof Error ? error.message : "Backup could not be read.");
    }
  }

  function restoreBackup() {
    if (!backupPreview) return;
    if (!window.confirm("Replace current WellCanvas data with this backup?")) return;
    try {
      restoreWellCanvasBackup(backupPreview.storage);
      setBackupPreview(null);
      setConfirmation("WellCanvas backup restored. Reloading…");
      window.setTimeout(() => window.location.reload(), 700);
    } catch {
      setSaveError("Backup restore failed. Your previous data was not changed.");
    }
  }

  return (
    <div
      className={`wc-page mx-auto flex w-full flex-col ${
        openSection === "profile" ? "max-w-[800px]" : "max-w-2xl"
      }`}
    >
      <PageHeader title="Settings" />

      <div aria-live="polite" className="sr-only">
        {calculationSuccess || saveError || recommendationMessage}
      </div>
      <ToastBridge message={confirmation} />
      <ToastBridge message={saveError} type="error" />
      <ToastBridge message={calculationSuccess} type="information" />

      <SettingsSummaryCard
        actions={
          <button
            aria-expanded={openSection === "profile"}
            className="btn btn-secondary-outline"
            onClick={() =>
              setOpenSection((current) =>
                current === "profile" ? null : "profile",
              )
            }
            type="button"
          >
            Edit
          </button>
        }
        isOpen={openSection === "profile"}
        expandedClassName="settings-profile-expanded"
        summary={
          <ProfileCardSummary
            personalProfile={personalProfile}
            profile={profile}
          />
        }
        title="Profile"
      >
        <ProfileSettings
          onProfileSaved={(savedProfile) => {
            setPersonalProfile(savedProfile);
            setConfirmation("Profile saved.");
          }}
          profileDetails={
            <div className="profile-details-stack">
              <div className="profile-metric-grid">
              <ProfileMetricField
                error={profileErrors.ageYears}
                id="profile-card-ageYears"
                label="Age"
                onChange={(value) => updateProfile({ ageYears: value })}
                value={profile.ageYears}
                unit="years"
              />
              <ProfileMetricField
                error={profileErrors.heightCm}
                id="profile-card-heightCm"
                label="Height"
                onChange={(value) => updateProfile({ heightCm: value })}
                step="0.1"
                value={profile.heightCm}
                unit="cm"
              />
              <ProfileMetricField
                error={profileErrors.weightKg}
                id="profile-card-weightKg"
                label="Weight"
                onChange={(value) => updateProfile({ weightKg: value })}
                step="0.1"
                value={profile.weightKg}
                unit="kg"
              />
            </div>
            <div className="profile-choice-compact">
              <ChoiceGroup
                label="Energy equation"
                onChange={(value) => updateProfile({ energyProfile: value })}
                options={energyProfileOptions}
                value={profile.energyProfile}
              />
            </div>
            </div>
          }
        />
      </SettingsSummaryCard>

      <SettingsSummaryCard
        actions={
          <>
            <button
              aria-expanded={openSection === "targets" && mode === "custom"}
              className="btn btn-secondary-outline"
              onClick={() => {
                if (openSection === "targets" && mode === "custom") {
                  setOpenSection(null);
                  return;
                }
                setMode("custom");
                setOpenSection("targets");
              }}
              type="button"
            >
              Set my own
            </button>
            <button
              aria-expanded={openSection === "targets" && mode === "recommended"}
              className="btn btn-tertiary-text"
              onClick={() => {
                if (openSection === "targets" && mode === "recommended") {
                  setOpenSection(null);
                  return;
                }
                setMode("recommended");
                setOpenSection("targets");
              }}
              type="button"
            >
              Use recommended
            </button>
          </>
        }
        className="settings-targets-card"
        isOpen={openSection === "targets"}
        summary={compactTargetsSummary(savedTargets, hydrationSummary)}
        title="Daily targets"
      >
      {mode === "custom" ? (
        <section className="rounded-md bg-stone-50 p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <NumberField
              error={targetErrors.caloriesKcal}
              id="custom-caloriesKcal"
              label="Daily calories"
              onChange={(value) => updateTargetDraft("caloriesKcal", value)}
              value={targetDraft.caloriesKcal}
              unit="kcal"
            />
            <NumberField
              error={targetErrors.proteinG}
              id="custom-proteinG"
              label="Protein"
              onChange={(value) => updateTargetDraft("proteinG", value)}
              step="0.1"
              value={targetDraft.proteinG}
              unit="g"
            />
            <NumberField
              error={targetErrors.fibreG}
              id="custom-fibreG"
              label="Fibre"
              onChange={(value) => updateTargetDraft("fibreG", value)}
              step="0.1"
              value={targetDraft.fibreG}
              unit="g"
            />
            <NumberField
              error={targetErrors.hydrationMl}
              id="custom-hydrationMl"
              label="Hydration"
              onChange={(value) => updateTargetDraft("hydrationMl", value)}
              step="50"
              value={targetDraft.hydrationMl}
              unit="ml"
            />
            <NumberField
              error={targetErrors.saturatedFatLimitG}
              id="custom-saturatedFatLimitG"
              label="Saturated fat limit"
              onChange={(value) => updateTargetDraft("saturatedFatLimitG", value)}
              step="0.1"
              value={targetDraft.saturatedFatLimitG}
              unit="g"
            />
            <NumberField
              error={targetErrors.sodiumLimitMg}
              id="custom-sodiumLimitMg"
              label="Sodium upper limit"
              onChange={(value) => updateTargetDraft("sodiumLimitMg", value)}
              value={targetDraft.sodiumLimitMg}
              unit="mg"
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              className="btn btn-primary-dark"
              disabled={customSaveState === "saving"}
              onClick={saveTargets}
              type="button"
            >
              {customSaveState === "saving" && <Spinner />}
              {customSaveState === "saving"
                ? "Saving…"
                : customSaveState === "saved"
                  ? "✓ Saved"
                  : "Save targets"}
            </button>
            <button
              className="btn btn-tertiary-text"
              onClick={() => setOpenSection(null)}
              type="button"
            >
              Cancel
            </button>
          </div>
        </section>
      ) : (
        <div className="grid gap-3">
          <section className="rounded-md bg-stone-50 p-3">
            <h2 className="text-lg font-semibold text-stone-950">
              Personal information
            </h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <NumberField
                error={profileErrors.ageYears}
                id="profile-ageYears"
                label="Age"
                onChange={(value) => updateProfile({ ageYears: value })}
                value={profile.ageYears}
                unit="years"
              />
              <NumberField
                error={profileErrors.heightCm}
                id="profile-heightCm"
                label="Height"
                onChange={(value) => updateProfile({ heightCm: value })}
                step="0.1"
                value={profile.heightCm}
                unit="cm"
              />
              <NumberField
                error={profileErrors.weightKg}
                id="profile-weightKg"
                label="Weight"
                onChange={(value) => updateProfile({ weightKg: value })}
                step="0.1"
                value={profile.weightKg}
                unit="kg"
              />
            </div>
            <label className="mt-4 flex items-start gap-3 rounded-md bg-stone-50 p-3 text-sm text-stone-700">
              <input
                checked={profile.standardMayNotApply}
                className="mt-1 h-4 w-4"
                id="profile-standardMayNotApply"
                onChange={(event) =>
                  updateProfile({ standardMayNotApply: event.target.checked })
                }
                type="checkbox"
              />
              <span>Standard recommendations may not apply to me</span>
            </label>
            {profile.standardMayNotApply && (
              <p className="mt-3 text-sm text-stone-500">
                Custom targets can still be entered. No medical details are needed.
              </p>
            )}
            {profileErrors.standardMayNotApply && (
              <p className="mt-3 text-sm font-medium text-stone-600">
                {profileErrors.standardMayNotApply}
              </p>
            )}
          </section>

          <section className="rounded-md bg-stone-50 p-3">
            <h2 className="text-lg font-semibold text-stone-950">Activity</h2>
            <div className="mt-3 grid gap-3">
              <ChoiceGroup
                label="Daily movement"
                onChange={(value) => updateProfile({ dailyMovement: value })}
                options={movementOptions}
                value={profile.dailyMovement}
              />
              <ChoiceGroup
                label="Exercise type"
                onChange={(value) => updateProfile({ exerciseType: value })}
                options={exerciseOptions}
                value={profile.exerciseType}
              />
              <ChoiceGroup<ExerciseAmountMode>
                label="Exercise amount input mode"
                onChange={(value) => updateProfile({ exerciseAmountMode: value })}
                options={[
                  { value: "sessions", label: "Sessions per week" },
                  { value: "hours", label: "Hours per week" },
                ]}
                value={profile.exerciseAmountMode}
              />
              {profile.exerciseAmountMode === "sessions" ? (
                <NumberField
                  error={profileErrors.sessionsPerWeek}
                  id="profile-sessionsPerWeek"
                  label="Sessions per week"
                  onChange={(value) => updateProfile({ sessionsPerWeek: value })}
                  step="1"
                  value={profile.sessionsPerWeek}
                  unit="sessions"
                />
              ) : (
                <NumberField
                  error={profileErrors.hoursPerWeek}
                  id="profile-hoursPerWeek"
                  label="Hours per week"
                  onChange={(value) => updateProfile({ hoursPerWeek: value })}
                  step="0.1"
                  value={profile.hoursPerWeek}
                  unit="hours"
                />
              )}
            </div>
          </section>

          <section className="rounded-md bg-stone-50 p-3">
            <h2 className="text-lg font-semibold text-stone-950">
              Energy estimate
            </h2>
            <div className="mt-4">
              <ChoiceGroup
                label="Energy-equation profile"
                onChange={(value) => updateProfile({ energyProfile: value })}
                options={energyProfileOptions}
                value={profile.energyProfile}
              />
            </div>
            <button
              className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-stone-900 px-5 text-base font-semibold text-white disabled:cursor-not-allowed disabled:opacity-75"
              disabled={isCalculating}
              onClick={calculateStartingTargets}
              type="button"
            >
              {isCalculating && <Spinner />}
              {isCalculating ? "Calculating..." : "Calculate recommendations"}
            </button>
            {recommendationMessage && (
              <p
                aria-live="polite"
                className="mt-3 rounded-md bg-stone-50 p-3 text-sm text-stone-600"
              >
                {recommendationMessage}
              </p>
            )}
          </section>

          {recommendation && (
            <section
              className="wc-section wc-section-padded outline-none"
              ref={suggestedSectionRef}
              tabIndex={-1}
            >
              <h2 className="text-lg font-semibold text-stone-950">
                Recommended starting targets
              </h2>
              <div className="mt-3 grid gap-2 rounded-md bg-stone-50 p-3 text-sm sm:grid-cols-2">
                <p>Calories <strong>{suggestedDraft.caloriesKcal || "Not estimated"} kcal</strong></p>
                <p>Protein <strong>{suggestedDraft.proteinG} g</strong></p>
                <p>Fibre <strong>{suggestedDraft.fibreG} g</strong></p>
                <p>Hydration <strong>{(Number(suggestedDraft.hydrationMl) / 1000).toFixed(1)} L</strong></p>
                <p>Saturated fat limit <strong>{suggestedDraft.saturatedFatLimitG} g</strong></p>
                <p>Sodium limit <strong>{formatNumber(Number(suggestedDraft.sodiumLimitMg))} mg</strong></p>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  className="btn btn-primary-dark"
                  disabled={suggestedSaveState === "saving"}
                  onClick={saveSuggestedTargets}
                  type="button"
                >
                  {suggestedSaveState === "saving" && <Spinner />}
                  {suggestedSaveState === "saving"
                    ? "Saving…"
                    : suggestedSaveState === "saved"
                      ? "✓ Saved"
                      : "Use these targets"}
                </button>
                <button
                  className="btn btn-secondary-outline"
                  onClick={() => {
                    setTargetDraft(suggestedDraft);
                    setMode("custom");
                  }}
                  type="button"
                >
                  Adjust manually
                </button>
                <button
                  className="btn btn-tertiary-text"
                  onClick={() => setOpenSection(null)}
                  type="button"
                >
                  Cancel
                </button>
              </div>
            </section>
          )}
        </div>
      )}
      </SettingsSummaryCard>

      <SettingsSummaryCard
        actions={
          <button
            aria-expanded={openSection === "appearance"}
            className="btn btn-secondary-outline"
            onClick={() =>
              setOpenSection((current) =>
                current === "appearance" ? null : "appearance",
              )
            }
            type="button"
          >
            Edit
          </button>
        }
        isOpen={openSection === "appearance"}
        summary={
          <>
            <p>{compactAppearanceSummary(appearanceSummary)}</p>
            <p className="mt-0.5">{compactCalendarSummary(calendarSummary)}</p>
          </>
        }
        title="Appearance and calendar"
      >
        <AppearanceSettings
          onAppearanceSaved={(savedAppearance) => {
            setAppearanceSummary(savedAppearance);
            setConfirmation("Preferences saved.");
          }}
          onCalendarSaved={setCalendarSummary}
          onCancel={() => setOpenSection(null)}
        />
      </SettingsSummaryCard>

      <section className="wc-section wc-section-padded shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-stone-950">
              Data portability
            </h2>
            <p className="mt-1 text-sm text-stone-500">
              Private backup of WellCanvas profile, preferences, library and local history.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-secondary-outline" onClick={exportWellCanvasBackup} type="button">
              Export my WellCanvas
            </button>
            <label className="btn btn-tertiary-text cursor-pointer">
              Import WellCanvas backup
              <input
                accept=".zip,application/zip"
                className="sr-only"
                onChange={(event) => {
                  void previewBackupImport(event.target.files?.[0] ?? null);
                  event.currentTarget.value = "";
                }}
                type="file"
              />
            </label>
          </div>
        </div>
        {backupPreview && (
          <div className="mt-4 rounded-md border border-stone-200 bg-stone-50 p-3">
            <h3 className="text-sm font-semibold text-stone-950">
              WellCanvas backup
            </h3>
            <p className="mt-1 text-sm text-stone-600">
              {new Date(backupPreview.preview.exportedAt).toLocaleDateString()}
            </p>
            <div className="mt-3 grid gap-2 text-sm text-stone-700 sm:grid-cols-2">
              <p>Reusable food items: {backupPreview.preview.itemCount}</p>
              <p>Food, hydration and activity history: {backupPreview.preview.logCount}</p>
              <p>Contents: {backupPreview.preview.contents.join(", ")}</p>
              <p>Restore mode: replaces current WellCanvas local data</p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button className="btn btn-primary-dark" onClick={restoreBackup} type="button">
                Restore backup
              </button>
              <button
                className="btn btn-tertiary-text"
                onClick={() => setBackupPreview(null)}
                type="button"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="wc-section wc-section-padded shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-stone-950">
              About WellCanvas
            </h2>
            <p className="mt-1 text-sm text-stone-500">
              Local-first · No registration · MIT licensed
            </p>
          </div>
          <Link className="btn btn-secondary-outline shrink-0" href="/about">
            About
          </Link>
        </div>
      </section>
    </div>
  );
}
