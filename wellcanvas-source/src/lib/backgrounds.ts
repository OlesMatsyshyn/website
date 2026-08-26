import { withBasePath } from "@/lib/deployment";

export type BuiltInBackground = {
  id: string;
  name: string;
  src: string;
};

export type BackgroundRotationMode = "fixed" | "automatic";

export const DEFAULT_ROTATION_INTERVAL_HOURS = 6;

export const BACKGROUND_INTERVAL_OPTIONS = [1, 3, 6, 12, 24] as const;

export const BUILT_IN_BACKGROUNDS: BuiltInBackground[] = [
  {
    id: "nature-01",
    name: "Misty alpine lake",
    src: withBasePath("/backgrounds/nature-01.png"),
  },
  {
    id: "nature-02",
    name: "Savanna sunset",
    src: withBasePath("/backgrounds/nature-02.png"),
  },
  {
    id: "nature-03",
    name: "Mountain meadow lake",
    src: withBasePath("/backgrounds/nature-03.png"),
  },
  {
    id: "nature-04",
    name: "Tropical river valley",
    src: withBasePath("/backgrounds/nature-04.png"),
  },
  {
    id: "nature-05",
    name: "Karst river mist",
    src: withBasePath("/backgrounds/nature-05.png"),
  },
  {
    id: "nature-06",
    name: "Sunny coastal cliffs",
    src: withBasePath("/backgrounds/nature-06.png"),
  },
  {
    id: "nature-07",
    name: "Island lagoon",
    src: withBasePath("/backgrounds/nature-07.png"),
  },
  {
    id: "nature-08",
    name: "Highland lake",
    src: withBasePath("/backgrounds/nature-08.png"),
  },
  {
    id: "nature-09",
    name: "Northern forest lake",
    src: withBasePath("/backgrounds/nature-09.png"),
  },
  {
    id: "nature-10",
    name: "Golden karst river",
    src: withBasePath("/backgrounds/nature-10.png"),
  },
  {
    id: "nature-11",
    name: "Palm coast sunrise",
    src: withBasePath("/backgrounds/nature-11.png"),
  },
];

export const DEFAULT_BACKGROUND_ID = BUILT_IN_BACKGROUNDS[0]?.id ?? "nature-01";

export const BUILT_IN_BACKGROUND_IDS = BUILT_IN_BACKGROUNDS.map(
  (background) => background.id,
);

const backgroundById = new Map(
  BUILT_IN_BACKGROUNDS.map((background) => [background.id, background]),
);

const legacyBackgroundIds = new Set([
  "background-1",
  "background-2",
  "background-3",
  "background-4",
  "background-5",
]);

export function isBuiltInBackgroundId(value: unknown): value is string {
  return typeof value === "string" && backgroundById.has(value);
}

export function legacyBackgroundToNatureId(value: unknown) {
  return typeof value === "string" && legacyBackgroundIds.has(value)
    ? DEFAULT_BACKGROUND_ID
    : null;
}

export function backgroundSrcForId(id: string | null | undefined) {
  return id ? backgroundById.get(id)?.src ?? null : null;
}

export function backgroundNameForId(id: string | null | undefined) {
  return id ? backgroundById.get(id)?.name ?? null : null;
}

export function normalizeEnabledBackgroundIds(value: unknown) {
  const ids = Array.isArray(value)
    ? value.filter((id): id is string => isBuiltInBackgroundId(id))
    : BUILT_IN_BACKGROUND_IDS;
  const uniqueIds = [...new Set(ids)];
  return uniqueIds.length > 0 ? uniqueIds : [DEFAULT_BACKGROUND_ID];
}

export function normalizeRotationIntervalHours(value: unknown) {
  return typeof value === "number" &&
    BACKGROUND_INTERVAL_OPTIONS.includes(
      value as (typeof BACKGROUND_INTERVAL_OPTIONS)[number],
    )
    ? value
    : DEFAULT_ROTATION_INTERVAL_HOURS;
}

export function orderedEnabledBackgroundIds(enabledBackgroundIds: string[]) {
  const enabled = new Set(enabledBackgroundIds);
  const ordered = BUILT_IN_BACKGROUND_IDS.filter((id) => enabled.has(id));
  return ordered.length > 0 ? ordered : [DEFAULT_BACKGROUND_ID];
}

function rotateOrderFromSelected(ordered: string[], selectedBackgroundId: string) {
  const selectedIndex = ordered.indexOf(selectedBackgroundId);
  if (selectedIndex <= 0) return ordered;
  return [...ordered.slice(selectedIndex), ...ordered.slice(0, selectedIndex)];
}

export function activeRotatingBackgroundId({
  enabledBackgroundIds,
  intervalHours,
  nowMs = Date.now(),
  rotationStartTimestamp,
  selectedBackgroundId,
}: {
  enabledBackgroundIds: string[];
  intervalHours: number;
  nowMs?: number;
  rotationStartTimestamp: string | null;
  selectedBackgroundId: string;
}) {
  const ordered = rotateOrderFromSelected(
    orderedEnabledBackgroundIds(enabledBackgroundIds),
    selectedBackgroundId,
  );
  if (ordered.length <= 1) return ordered[0] ?? selectedBackgroundId;

  const startMs = rotationStartTimestamp
    ? Date.parse(rotationStartTimestamp)
    : Number.NaN;
  if (!Number.isFinite(startMs)) {
    return ordered.includes(selectedBackgroundId)
      ? selectedBackgroundId
      : ordered[0] ?? selectedBackgroundId;
  }

  const intervalMs = Math.max(intervalHours, 1) * 60 * 60 * 1000;
  const elapsedIntervals = Math.max(Math.floor((nowMs - startMs) / intervalMs), 0);
  return ordered[elapsedIntervals % ordered.length] ?? selectedBackgroundId;
}

export function millisecondsUntilNextBackgroundBoundary({
  intervalHours,
  nowMs = Date.now(),
  rotationStartTimestamp,
}: {
  intervalHours: number;
  nowMs?: number;
  rotationStartTimestamp: string | null;
}) {
  const startMs = rotationStartTimestamp
    ? Date.parse(rotationStartTimestamp)
    : Number.NaN;
  if (!Number.isFinite(startMs)) return null;

  const intervalMs = Math.max(intervalHours, 1) * 60 * 60 * 1000;
  const elapsed = Math.max(nowMs - startMs, 0);
  const nextBoundary = startMs + (Math.floor(elapsed / intervalMs) + 1) * intervalMs;
  return Math.max(nextBoundary - nowMs + 250, 250);
}

export function nextRotatingBackgroundId({
  currentBackgroundId,
  enabledBackgroundIds,
}: {
  currentBackgroundId: string;
  enabledBackgroundIds: string[];
}) {
  const ordered = orderedEnabledBackgroundIds(enabledBackgroundIds);
  if (ordered.length <= 1) return ordered[0] ?? currentBackgroundId;
  const currentIndex = ordered.indexOf(currentBackgroundId);
  return ordered[(currentIndex + 1 + ordered.length) % ordered.length] ?? ordered[0];
}

export function preloadBackground(src: string | null) {
  if (!src || typeof window === "undefined") return;
  const image = new Image();
  image.src = src;
}
