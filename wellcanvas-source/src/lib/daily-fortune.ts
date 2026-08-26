import { dailyFortunes, type DailyFortune } from "@/data/daily-fortunes";

export type DailyFortuneState = {
  browserSeed: string;
  currentDateKey: string | null;
  currentFortuneId: string | null;
  revealedAt: string | null;
  recentFortuneIds: string[];
};

export const DAILY_FORTUNE_STORAGE_KEY =
  "health-tracker-pwa.daily-fortune.v1";

function canUseStorage() {
  return typeof window !== "undefined";
}

function makeBrowserSeed() {
  if (typeof window === "undefined") {
    return "server-fortune-seed";
  }
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }
  return `fortune-seed-${Date.now().toString(36)}-${Math.floor(
    Math.random() * 1_000_000,
  ).toString(36)}`;
}

function normalizeState(value: Partial<DailyFortuneState> | null): DailyFortuneState {
  return {
    browserSeed:
      typeof value?.browserSeed === "string" && value.browserSeed.trim()
        ? value.browserSeed
        : makeBrowserSeed(),
    currentDateKey:
      typeof value?.currentDateKey === "string" ? value.currentDateKey : null,
    currentFortuneId:
      typeof value?.currentFortuneId === "string" ? value.currentFortuneId : null,
    revealedAt: typeof value?.revealedAt === "string" ? value.revealedAt : null,
    recentFortuneIds: Array.isArray(value?.recentFortuneIds)
      ? value.recentFortuneIds
          .filter((id): id is string => typeof id === "string")
          .slice(0, 30)
      : [],
  };
}

export function readDailyFortuneState(): DailyFortuneState {
  if (!canUseStorage()) {
    return normalizeState(null);
  }

  try {
    const raw = window.localStorage.getItem(DAILY_FORTUNE_STORAGE_KEY);
    return normalizeState(raw ? (JSON.parse(raw) as Partial<DailyFortuneState>) : null);
  } catch {
    return normalizeState(null);
  }
}

export function saveDailyFortuneState(state: DailyFortuneState) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(DAILY_FORTUNE_STORAGE_KEY, JSON.stringify(state));
}

function stableHash(input: string) {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function fortuneById(id: string | null): DailyFortune | null {
  if (!id) return null;
  return dailyFortunes.find((fortune) => fortune.id === id) ?? null;
}

function selectFortuneId(browserSeed: string, dateKey: string, recentIds: string[]) {
  const recent = new Set(recentIds);
  let index = stableHash(`${browserSeed}|${dateKey}`) % dailyFortunes.length;

  for (let attempts = 0; attempts < dailyFortunes.length; attempts += 1) {
    const fortune = dailyFortunes[index];
    if (!recent.has(fortune.id)) {
      return fortune.id;
    }
    index = (index + 1) % dailyFortunes.length;
  }

  return dailyFortunes[index].id;
}

export function syncDailyFortuneDate(dateKey: string) {
  const state = readDailyFortuneState();
  if (state.currentDateKey === dateKey) {
    saveDailyFortuneState(state);
    return state;
  }

  const nextState: DailyFortuneState = {
    ...state,
    currentDateKey: dateKey,
    currentFortuneId: null,
    revealedAt: null,
    recentFortuneIds: state.recentFortuneIds.slice(0, 30),
  };
  saveDailyFortuneState(nextState);
  return nextState;
}

export function getRevealedDailyFortune(dateKey: string) {
  const state = syncDailyFortuneDate(dateKey);
  if (!state.revealedAt) return null;
  return fortuneById(state.currentFortuneId);
}

export function revealDailyFortune(dateKey: string) {
  const state = syncDailyFortuneDate(dateKey);
  const existingFortune =
    state.revealedAt && state.currentFortuneId
      ? fortuneById(state.currentFortuneId)
      : null;

  if (existingFortune) {
    return {
      fortune: existingFortune,
      state,
    };
  }

  const fortuneId = selectFortuneId(
    state.browserSeed,
    dateKey,
    state.recentFortuneIds,
  );
  const nextState: DailyFortuneState = {
    ...state,
    currentDateKey: dateKey,
    currentFortuneId: fortuneId,
    revealedAt: new Date().toISOString(),
    recentFortuneIds: [
      fortuneId,
      ...state.recentFortuneIds.filter((id) => id !== fortuneId),
    ].slice(0, 30),
  };
  saveDailyFortuneState(nextState);

  return {
    fortune: fortuneById(fortuneId) ?? dailyFortunes[0],
    state: nextState,
  };
}
