import {
  activeRotatingBackgroundId,
  backgroundNameForId,
  backgroundSrcForId,
  BUILT_IN_BACKGROUNDS,
  BUILT_IN_BACKGROUND_IDS,
  DEFAULT_BACKGROUND_ID,
  DEFAULT_ROTATION_INTERVAL_HOURS,
  legacyBackgroundToNatureId,
  nextRotatingBackgroundId,
  normalizeEnabledBackgroundIds,
  normalizeRotationIntervalHours,
  orderedEnabledBackgroundIds,
  preloadBackground,
  type BackgroundRotationMode,
} from "@/lib/backgrounds";
import { withBasePath } from "@/lib/deployment";

export const PROFILE_STORAGE_KEY = "health-tracker-pwa.profile.v1";
export const APPEARANCE_STORAGE_KEY = "health-tracker-pwa.appearance.v1";
export const PROFILE_PRESET_PHOTO_PATH = withBasePath("/icons/wellcanvas-ui.png");

export type UserProfile = {
  displayName: string;
  photoSource: "none" | "preset" | "uploaded";
  presetPhotoPath: string | null;
  uploadedPhotoId: string | null;
  photoPositionX: number;
  photoPositionY: number;
  photoZoom: number;
  currentFocus:
    | "none"
    | "maintain-routine"
    | "general-fitness"
    | "strength-muscle"
    | "gradual-weight-change";
  updatedAt: string;
};

export type AccentTheme =
  | "neutral"
  | "graphite"
  | "ocean"
  | "forest"
  | "amber"
  | "berry";

export type BackgroundChoice = "none" | string;

export type AppearancePreferences = {
  accentTheme: AccentTheme;
  background: BackgroundChoice;
  backgroundMode: BackgroundRotationMode;
  backgroundDimPercent: number;
  enabledBackgroundIds: string[];
  panelTransparency: "solid" | "soft" | "glass";
  rotationIntervalHours: number;
  rotationStartTimestamp: string | null;
  selectedBackgroundId: string;
  updatedAt: string;
};

export const DEFAULT_PROFILE: UserProfile = {
  displayName: "",
  photoSource: "none",
  presetPhotoPath: null,
  uploadedPhotoId: null,
  photoPositionX: 50,
  photoPositionY: 50,
  photoZoom: 1,
  currentFocus: "none",
  updatedAt: "",
};

export const DEFAULT_APPEARANCE: AppearancePreferences = {
  accentTheme: "neutral",
  background: "none",
  backgroundMode: "fixed",
  backgroundDimPercent: 40,
  enabledBackgroundIds: BUILT_IN_BACKGROUND_IDS,
  panelTransparency: "solid",
  rotationIntervalHours: DEFAULT_ROTATION_INTERVAL_HOURS,
  rotationStartTimestamp: null,
  selectedBackgroundId: DEFAULT_BACKGROUND_ID,
  updatedAt: "",
};

export const accentThemes: Record<
  AccentTheme,
  {
    label: string;
    accent: string;
    accentHover: string;
    accentSoft: string;
    accentContrast: string;
    focusRing: string;
  }
> = {
  neutral: {
    label: "Neutral",
    accent: "#292524",
    accentHover: "#1c1917",
    accentSoft: "#f5f5f4",
    accentContrast: "#ffffff",
    focusRing: "#78716c",
  },
  graphite: {
    label: "Graphite",
    accent: "#334155",
    accentHover: "#1e293b",
    accentSoft: "#f1f5f9",
    accentContrast: "#ffffff",
    focusRing: "#64748b",
  },
  ocean: {
    label: "Ocean",
    accent: "#0f766e",
    accentHover: "#115e59",
    accentSoft: "#ccfbf1",
    accentContrast: "#ffffff",
    focusRing: "#14b8a6",
  },
  forest: {
    label: "Forest",
    accent: "#166534",
    accentHover: "#14532d",
    accentSoft: "#dcfce7",
    accentContrast: "#ffffff",
    focusRing: "#22c55e",
  },
  amber: {
    label: "Amber",
    accent: "#92400e",
    accentHover: "#78350f",
    accentSoft: "#fef3c7",
    accentContrast: "#ffffff",
    focusRing: "#f59e0b",
  },
  berry: {
    label: "Berry",
    accent: "#9f1239",
    accentHover: "#881337",
    accentSoft: "#ffe4e6",
    accentContrast: "#ffffff",
    focusRing: "#fb7185",
  },
};

export const backgroundOptions: Record<
  string,
  { label: string; path: string | null }
> = {
  none: { label: "No background", path: null },
  ...Object.fromEntries(
    BUILT_IN_BACKGROUNDS.map((background) => [
      background.id,
      { label: background.name, path: background.src },
    ]),
  ),
};

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object");
}

export function normalizeProfile(value: unknown): UserProfile {
  if (!isObject(value)) return DEFAULT_PROFILE;

  const photoSource =
    value.photoSource === "preset" ||
    value.photoSource === "uploaded" ||
    value.photoSource === "none"
      ? value.photoSource
      : "none";

  return {
    displayName:
      typeof value.displayName === "string" ? value.displayName : "",
    photoSource,
    presetPhotoPath:
      typeof value.presetPhotoPath === "string" ? value.presetPhotoPath : null,
    uploadedPhotoId:
      typeof value.uploadedPhotoId === "string" ? value.uploadedPhotoId : null,
    photoPositionX:
      typeof value.photoPositionX === "number" && Number.isFinite(value.photoPositionX)
        ? Math.min(Math.max(value.photoPositionX, 0), 100)
        : 50,
    photoPositionY:
      typeof value.photoPositionY === "number" && Number.isFinite(value.photoPositionY)
        ? Math.min(Math.max(value.photoPositionY, 0), 100)
        : 50,
    photoZoom:
      typeof value.photoZoom === "number" && Number.isFinite(value.photoZoom)
        ? Math.min(Math.max(value.photoZoom, 1), 2.5)
        : 1,
    currentFocus:
      value.currentFocus === "maintain-routine" ||
      value.currentFocus === "general-fitness" ||
      value.currentFocus === "strength-muscle" ||
      value.currentFocus === "gradual-weight-change"
        ? value.currentFocus
        : "none",
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : "",
  };
}

export function normalizeAppearance(value: unknown): AppearancePreferences {
  if (!isObject(value)) return DEFAULT_APPEARANCE;

  const accentTheme =
    typeof value.accentTheme === "string" && value.accentTheme in accentThemes
      ? (value.accentTheme as AccentTheme)
      : DEFAULT_APPEARANCE.accentTheme;
  const legacyBackground = legacyBackgroundToNatureId(value.background);
  const selectedLegacyBackground = legacyBackgroundToNatureId(
    value.selectedBackgroundId,
  );
  const rawSelectedBackgroundId =
    typeof value.selectedBackgroundId === "string" &&
    backgroundSrcForId(value.selectedBackgroundId)
      ? value.selectedBackgroundId
      : selectedLegacyBackground ?? null;
  const background =
    value.background === "none"
      ? "none"
      : typeof value.background === "string" && backgroundSrcForId(value.background)
        ? value.background
        : legacyBackground ?? DEFAULT_APPEARANCE.background;
  const selectedBackgroundId =
    rawSelectedBackgroundId ??
    (background !== "none" && backgroundSrcForId(background)
      ? background
      : DEFAULT_APPEARANCE.selectedBackgroundId);
  const backgroundMode =
    value.backgroundMode === "automatic" || value.backgroundMode === "fixed"
      ? value.backgroundMode
      : DEFAULT_APPEARANCE.backgroundMode;
  const enabledBackgroundIds = normalizeEnabledBackgroundIds(
    value.enabledBackgroundIds,
  );
  const panelTransparency =
    value.panelTransparency === "soft" ||
    value.panelTransparency === "glass" ||
    value.panelTransparency === "solid"
      ? value.panelTransparency
      : DEFAULT_APPEARANCE.panelTransparency;
  const backgroundDimPercent =
    typeof value.backgroundDimPercent === "number" &&
    Number.isFinite(value.backgroundDimPercent)
      ? Math.min(Math.max(value.backgroundDimPercent, 0), 80)
      : DEFAULT_APPEARANCE.backgroundDimPercent;

  return {
    accentTheme,
    background,
    backgroundMode,
    backgroundDimPercent,
    enabledBackgroundIds,
    panelTransparency,
    rotationIntervalHours: normalizeRotationIntervalHours(
      value.rotationIntervalHours,
    ),
    rotationStartTimestamp:
      typeof value.rotationStartTimestamp === "string"
        ? value.rotationStartTimestamp
        : null,
    selectedBackgroundId,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : "",
  };
}

export function readProfile() {
  try {
    return normalizeProfile(
      JSON.parse(window.localStorage.getItem(PROFILE_STORAGE_KEY) ?? "null"),
    );
  } catch {
    return DEFAULT_PROFILE;
  }
}

export function saveProfile(profile: UserProfile) {
  window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
  window.dispatchEvent(new CustomEvent("health-tracker-profile-change"));
}

export function readAppearance() {
  try {
    return normalizeAppearance(
      JSON.parse(window.localStorage.getItem(APPEARANCE_STORAGE_KEY) ?? "null"),
    );
  } catch {
    return DEFAULT_APPEARANCE;
  }
}

export function saveAppearance(appearance: AppearancePreferences) {
  window.localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(appearance));
  window.dispatchEvent(new CustomEvent("health-tracker-appearance-change"));
}

export function applyAppearance(appearance: AppearancePreferences) {
  const theme = accentThemes[appearance.accentTheme] ?? accentThemes.neutral;
  const root = document.documentElement;
  const enabledBackgroundIds = orderedEnabledBackgroundIds(
    appearance.enabledBackgroundIds,
  );
  const activeBackgroundId =
    appearance.backgroundMode === "automatic"
      ? activeRotatingBackgroundId({
          enabledBackgroundIds,
          intervalHours: appearance.rotationIntervalHours,
          rotationStartTimestamp: appearance.rotationStartTimestamp,
          selectedBackgroundId: appearance.selectedBackgroundId,
        })
      : appearance.background === "none"
        ? null
        : appearance.selectedBackgroundId;
  const background = backgroundSrcForId(activeBackgroundId);
  const backgroundCss = background ? `url("${background}")` : "none";
  const backgroundElement = document.querySelector<HTMLElement>(".app-background");
  const previousBackgroundCss = backgroundElement
    ? window.getComputedStyle(backgroundElement).backgroundImage
    : "none";
  const nextBackground =
    appearance.backgroundMode === "automatic"
      ? backgroundSrcForId(
          nextRotatingBackgroundId({
            currentBackgroundId: activeBackgroundId ?? appearance.selectedBackgroundId,
            enabledBackgroundIds,
          }),
        )
      : null;

  root.style.setProperty("--accent", theme.accent);
  root.style.setProperty("--accent-hover", theme.accentHover);
  root.style.setProperty("--accent-soft", theme.accentSoft);
  root.style.setProperty("--accent-contrast", theme.accentContrast);
  root.style.setProperty("--focus-ring", theme.focusRing);
  root.style.setProperty("--app-background-image", backgroundCss);
  fadePreviousBackground(previousBackgroundCss, backgroundCss);
  root.dataset.backgroundId = activeBackgroundId ?? "none";
  root.dataset.backgroundName =
    backgroundNameForId(activeBackgroundId) ?? "No background";
  root.style.setProperty(
    "--background-dim-opacity",
    String(appearance.backgroundDimPercent / 100),
  );
  root.dataset.panel = appearance.panelTransparency;
  preloadBackground(background);
  preloadBackground(nextBackground);
}

function fadePreviousBackground(previousBackgroundCss: string, nextBackgroundCss: string) {
  if (
    previousBackgroundCss === nextBackgroundCss ||
    previousBackgroundCss === "none" ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    return;
  }

  const overlay = document.createElement("div");
  overlay.setAttribute("aria-hidden", "true");
  overlay.className = "app-background-fade";
  overlay.style.backgroundImage = previousBackgroundCss;
  document.body.append(overlay);
  window.requestAnimationFrame(() => overlay.classList.add("is-fading"));
  window.setTimeout(() => overlay.remove(), 750);
}
