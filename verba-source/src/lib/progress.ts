const STORAGE_KEY = "verba.progress.v2";
const LEGACY_STORAGE_KEY = "verba.progress.v1";

export type PracticeKind = "match" | "text" | "forms";

export type ItemProgress = {
  attempts: number;
  correct: number;
  incorrect: number;
  mistakes: number;
  earlyMatches?: number;
  lateMatches?: number;
  confidence?: number;
  lastPracticed: string | null;
};

export type PackageProgress = {
  match: Record<string, ItemProgress>;
  text: Record<string, ItemProgress>;
  forms: Record<string, ItemProgress>;
};

export type VerbaProgress = {
  version: 2;
  packages: Record<string, PackageProgress>;
};

const emptyPackageProgress = (): PackageProgress => ({
  match: {},
  text: {},
  forms: {},
});

export function emptyProgress(): VerbaProgress {
  return {
    version: 2,
    packages: {},
  };
}

export function readProgress(): VerbaProgress {
  if (typeof window === "undefined") return emptyProgress();

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return migrateLegacyProgress();
    const parsed = JSON.parse(raw) as Partial<VerbaProgress>;
    return {
      version: 2,
      packages: normalizePackages(parsed.packages),
    };
  } catch {
    return emptyProgress();
  }
}

export function saveProgress(progress: VerbaProgress) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

export function recordAttempt(
  progress: VerbaProgress,
  packageId: string,
  kind: PracticeKind,
  itemId: string,
  wasCorrect: boolean,
): VerbaProgress {
  const packageProgress = progress.packages[packageId] ?? emptyPackageProgress();
  const current = packageProgress[kind]?.[itemId] ?? {
    attempts: 0,
    correct: 0,
    incorrect: 0,
    mistakes: 0,
    lastPracticed: null,
  };

  return {
    ...progress,
    packages: {
      ...progress.packages,
      [packageId]: {
        ...packageProgress,
        [kind]: {
          ...packageProgress[kind],
          [itemId]: {
            attempts: current.attempts + 1,
            correct: current.correct + (wasCorrect ? 1 : 0),
            incorrect: current.incorrect + (wasCorrect ? 0 : 1),
            mistakes: current.mistakes + (wasCorrect ? 0 : 1),
            lastPracticed: new Date().toISOString(),
          },
        },
      },
    },
  };
}

export function recordMatchAttempt(
  progress: VerbaProgress,
  packageId: string,
  itemId: string,
  wasCorrect: boolean,
  rank: number,
  total: number,
): VerbaProgress {
  const packageProgress = progress.packages[packageId] ?? emptyPackageProgress();
  const current = packageProgress.match[itemId] ?? {
    attempts: 0,
    correct: 0,
    incorrect: 0,
    mistakes: 0,
    earlyMatches: 0,
    lateMatches: 0,
    confidence: 0,
    lastPracticed: null,
  };
  const signal = matchConfidenceSignal(wasCorrect, rank, total);

  return {
    ...progress,
    packages: {
      ...progress.packages,
      [packageId]: {
        ...packageProgress,
        match: {
          ...packageProgress.match,
          [itemId]: {
            ...current,
            attempts: current.attempts + 1,
            correct: current.correct + (wasCorrect ? 1 : 0),
            incorrect: current.incorrect + (wasCorrect ? 0 : 1),
            mistakes: current.mistakes + (wasCorrect ? 0 : 1),
            earlyMatches: (current.earlyMatches ?? 0) + (signal.timing === "early" ? 1 : 0),
            lateMatches: (current.lateMatches ?? 0) + (signal.timing === "late" ? 1 : 0),
            confidence: Math.max(-20, Math.min(20, (current.confidence ?? 0) + signal.confidenceDelta)),
            lastPracticed: new Date().toISOString(),
          },
        },
      },
    },
  };
}

export function weakItems(progress: VerbaProgress, packageId: string, kind: PracticeKind) {
  return Object.entries((progress.packages[packageId] ?? emptyPackageProgress())[kind])
    .filter(([, item]) => item.mistakes > 0 || (item.confidence ?? 0) < 0 || (item.lateMatches ?? 0) > (item.earlyMatches ?? 0))
    .sort(([, a], [, b]) => itemWeaknessScore(b) - itemWeaknessScore(a))
    .map(([id]) => id);
}

export function progressTotals(progress: VerbaProgress, packageId: string) {
  const groups = progress.packages[packageId] ?? emptyPackageProgress();
  const all = [...Object.values(groups.match), ...Object.values(groups.text), ...Object.values(groups.forms)];
  return all.reduce(
    (total, item) => ({
      attempts: total.attempts + item.attempts,
      correct: total.correct + item.correct,
      incorrect: total.incorrect + item.incorrect,
      weak: total.weak + (item.mistakes > 0 ? 1 : 0),
    }),
    { attempts: 0, correct: 0, incorrect: 0, weak: 0 },
  );
}

function normalizePackages(packages: unknown): Record<string, PackageProgress> {
  if (!packages || typeof packages !== "object") return {};
  return Object.fromEntries(
    Object.entries(packages as Record<string, Partial<PackageProgress>>).map(([packageId, value]) => [
      packageId,
      {
        ...emptyPackageProgress(),
        ...value,
      },
    ]),
  );
}

export function itemWeaknessScore(item: ItemProgress | undefined) {
  if (!item) return 0;
  return item.mistakes * 4 + (item.lateMatches ?? 0) * 1.25 - (item.earlyMatches ?? 0) * 0.4 - (item.confidence ?? 0);
}

function matchConfidenceSignal(wasCorrect: boolean, rank: number, total: number) {
  if (!wasCorrect) return { confidenceDelta: -3, timing: "late" as const };
  if (total <= 1) return { confidenceDelta: 0.5, timing: "early" as const };

  const position = (rank - 1) / (total - 1);
  if (rank === total) return { confidenceDelta: -1, timing: "late" as const };
  if (position <= 0.34) return { confidenceDelta: 1.2, timing: "early" as const };
  if (position >= 0.67) return { confidenceDelta: -0.45, timing: "late" as const };
  return { confidenceDelta: 0.25, timing: "middle" as const };
}

function migrateLegacyProgress(): VerbaProgress {
  if (typeof window === "undefined") return emptyProgress();
  try {
    const raw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return emptyProgress();
    const legacy = JSON.parse(raw) as {
      languages?: {
        romanian?: {
          match?: Record<string, ItemProgress>;
          text?: Record<string, ItemProgress>;
          endings?: Record<string, ItemProgress>;
        };
      };
    };
    const romanian = legacy.languages?.romanian;
    if (!romanian) return emptyProgress();
    const migrated: VerbaProgress = {
      version: 2,
      packages: {
        "romanian-starter": {
          match: romanian.match ?? {},
          text: romanian.text ?? {},
          forms: romanian.endings ?? {},
        },
      },
    };
    saveProgress(migrated);
    return migrated;
  } catch {
    return emptyProgress();
  }
}
