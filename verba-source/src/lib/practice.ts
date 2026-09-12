import type { CharacterSubstitutions } from "@/lib/types";

export function stableShuffle<T extends { id?: string } | string>(items: T[], salt = "") {
  return [...items].sort((a, b) => {
    const left = scoreFor(a, salt);
    const right = scoreFor(b, salt);
    return left - right;
  });
}

export function sampleStable<T extends { id: string }>(items: T[], count: number, salt: string) {
  return stableShuffle(items, salt).slice(0, Math.min(count, items.length));
}

export type VocabularyRotationState = {
  pending: string[];
  recent: string[];
  used?: string[];
  cycle: number;
  updatedAt?: string;
};

export type VocabularyRotationSelection = {
  ids: string[];
  state: VocabularyRotationState;
  reviewCount: number;
};

export function selectFromVocabularyRotation(
  eligibleIds: string[],
  count: number,
  state: VocabularyRotationState | undefined,
  weakness: Record<string, number> = {},
  salt = "vocabulary",
  skipIds: string[] = [],
): VocabularyRotationSelection {
  const eligible = uniqueStrings(eligibleIds);
  if (!eligible.length || count <= 0) {
    return {
      ids: [],
      state: { pending: [], recent: [], cycle: state?.cycle ?? 0, updatedAt: new Date().toISOString() },
      reviewCount: 0,
    };
  }

  let cycle = state?.cycle ?? 0;
  const eligibleSet = new Set(eligible);
  const recentLimit = Math.min(eligible.length, Math.max(count * 3, 60));
  const recent = uniqueStrings(state?.recent ?? []).filter((id) => eligibleSet.has(id)).slice(0, recentLimit);
  let used = uniqueStrings(state?.used ?? []).filter((id) => eligibleSet.has(id));
  let pending = uniqueStrings(state?.pending ?? []).filter((id) => eligibleSet.has(id));

  const known = new Set([...used, ...pending]);
  const newIds = eligible.filter((id) => !known.has(id));
  if (newIds.length) {
    pending = [...stableShuffle(newIds, `new-${salt}-${cycle}`), ...pending];
  }

  pending = promoteWeakPending(pending, weakness, count, salt);

  const selected: string[] = [];
  const selectedInPass = new Set<string>();
  const skipSet = new Set(skipIds);
  const deferred: string[] = [];
  let guard = 0;
  const maxGuard = Math.max(eligible.length * Math.max(count, 1) * 4, 100);

  while (selected.length < count && guard < maxGuard) {
    guard += 1;
    if (!pending.length) {
      cycle += 1;
      used = [];
      pending = promoteWeakPending(buildRotationRefill(eligible, recent, cycle, salt), weakness, count, salt);
    }

    const nextId = pending.shift();
    if (!nextId) continue;
    if (skipSet.has(nextId)) {
      deferred.push(nextId);
      continue;
    }

    if (selectedInPass.has(nextId) && selectedInPass.size < eligible.length) continue;
    if (selectedInPass.size >= eligible.length) selectedInPass.clear();

    selected.push(nextId);
    selectedInPass.add(nextId);
  }

  const nextRecent = uniqueStrings([...selected].reverse().concat(recent)).filter((id) => eligibleSet.has(id)).slice(0, recentLimit);

  return {
    ids: selected,
    state: {
      pending: [...deferred, ...pending],
      recent: nextRecent,
      used: uniqueStrings([...used, ...selected]).filter((id) => eligibleSet.has(id)),
      cycle,
      updatedAt: new Date().toISOString(),
    },
    reviewCount: selected.filter((id) => (weakness[id] ?? 0) > 0).length,
  };
}

export function insertLater<T>(items: T[], item: T, distance = 4) {
  const next = [...items];
  const index = Math.min(distance, next.length);
  next.splice(index, 0, item);
  return next;
}

function scoreFor<T extends { id?: string } | string>(item: T, salt: string) {
  const text = `${typeof item === "string" ? item : item.id ?? JSON.stringify(item)}:${salt}`;
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function promoteWeakPending(pending: string[], weakness: Record<string, number>, count: number, salt: string) {
  const reviewBudget = Math.min(Math.max(0, Math.floor(count * 0.2)), 4, Math.max(0, count - 1));
  if (!reviewBudget) return pending;
  const weakIds = stableShuffle(
    pending.filter((id) => (weakness[id] ?? 0) > 0),
    `weak-rotation-${salt}`,
  )
    .sort((a, b) => (weakness[b] ?? 0) - (weakness[a] ?? 0))
    .slice(0, reviewBudget);

  if (!weakIds.length) return pending;
  const weakSet = new Set(weakIds);
  return [...weakIds, ...pending.filter((id) => !weakSet.has(id))];
}

function buildRotationRefill(eligible: string[], recent: string[], cycle: number, salt: string) {
  const recentRank = new Map(recent.map((id, index) => [id, index]));
  return stableShuffle(eligible, `rotation-${salt}-${cycle}`).sort((a, b) => {
    const left = recentPenalty(a, recentRank, recent.length);
    const right = recentPenalty(b, recentRank, recent.length);
    if (left !== right) return left - right;
    return 0;
  });
}

function recentPenalty(id: string, recentRank: Map<string, number>, recentLength: number) {
  const rank = recentRank.get(id);
  if (rank === undefined || !recentLength) return 0;
  return 1 + (recentLength - rank) / recentLength;
}

export function accuracy(correct: number, attempts: number) {
  if (!attempts) return 0;
  return Math.round((correct / attempts) * 100);
}

export function answerMatches(input: string, answer: string, tolerant: boolean, substitutions: CharacterSubstitutions = {}) {
  const normalizedInput = input.trim();
  const normalizedAnswer = answer.trim();
  if (normalizedInput === normalizedAnswer) return true;
  if (!tolerant) return false;
  return matchesWithSubstitutions(normalizedInput, normalizedAnswer, substitutions);
}

function matchesWithSubstitutions(input: string, answer: string, substitutions: CharacterSubstitutions) {
  const normalizedInput = input.toLocaleLowerCase();
  const normalizedAnswer = answer.toLocaleLowerCase();

  function visit(inputIndex: number, answerIndex: number): boolean {
    if (inputIndex === normalizedInput.length && answerIndex === normalizedAnswer.length) return true;
    if (inputIndex > normalizedInput.length || answerIndex >= normalizedAnswer.length) return false;

    const expected = normalizedAnswer[answerIndex];
    if (normalizedInput[inputIndex] === expected && visit(inputIndex + 1, answerIndex + 1)) {
      return true;
    }

    return (substitutions[expected] ?? []).some((accepted) => {
      const normalizedAccepted = accepted.toLocaleLowerCase();
      return normalizedInput.startsWith(normalizedAccepted, inputIndex) && visit(inputIndex + normalizedAccepted.length, answerIndex + 1);
    });
  }

  return visit(0, 0);
}
