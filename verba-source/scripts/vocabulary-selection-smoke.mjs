function stableShuffle(items, salt = "") {
  return [...items].sort((a, b) => scoreFor(a, salt) - scoreFor(b, salt));
}

function selectFromVocabularyRotation(eligibleIds, count, state, weakness = {}, salt = "vocabulary", skipIds = []) {
  const eligible = uniqueStrings(eligibleIds);
  if (!eligible.length || count <= 0) {
    return { ids: [], state: { pending: [], recent: [], cycle: state?.cycle ?? 0 }, reviewCount: 0 };
  }

  let cycle = state?.cycle ?? 0;
  const eligibleSet = new Set(eligible);
  const recentLimit = Math.min(eligible.length, Math.max(count * 3, 60));
  const recent = uniqueStrings(state?.recent ?? []).filter((id) => eligibleSet.has(id)).slice(0, recentLimit);
  let used = uniqueStrings(state?.used ?? []).filter((id) => eligibleSet.has(id));
  let pending = uniqueStrings(state?.pending ?? []).filter((id) => eligibleSet.has(id));

  const known = new Set([...used, ...pending]);
  const newIds = eligible.filter((id) => !known.has(id));
  if (newIds.length) pending = [...stableShuffle(newIds, `new-${salt}-${cycle}`), ...pending];

  pending = promoteWeakPending(pending, weakness, count, salt);

  const selected = [];
  const selectedInPass = new Set();
  const skipSet = new Set(skipIds);
  const deferred = [];
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

  return {
    ids: selected,
    state: {
      pending: [...deferred, ...pending],
      recent: uniqueStrings([...selected].reverse().concat(recent)).filter((id) => eligibleSet.has(id)).slice(0, recentLimit),
      used: uniqueStrings([...used, ...selected]).filter((id) => eligibleSet.has(id)),
      cycle,
    },
    reviewCount: selected.filter((id) => (weakness[id] ?? 0) > 0).length,
  };
}

function scoreFor(item, salt) {
  const text = `${item}:${salt}`;
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function uniqueStrings(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function promoteWeakPending(pending, weakness, count, salt) {
  const reviewBudget = Math.min(Math.max(0, Math.floor(count * 0.2)), 4, Math.max(0, count - 1));
  if (!reviewBudget) return pending;
  const weakIds = stableShuffle(
    pending.filter((id) => (weakness[id] ?? 0) > 0),
    `weak-rotation-${salt}`,
  )
    .sort((a, b) => (weakness[b] ?? 0) - (weakness[a] ?? 0))
    .slice(0, reviewBudget);
  const weakSet = new Set(weakIds);
  return [...weakIds, ...pending.filter((id) => !weakSet.has(id))];
}

function buildRotationRefill(eligible, recent, cycle, salt) {
  const recentRank = new Map(recent.map((id, index) => [id, index]));
  return stableShuffle(eligible, `rotation-${salt}-${cycle}`).sort((a, b) => recentPenalty(a, recentRank, recent.length) - recentPenalty(b, recentRank, recent.length));
}

function recentPenalty(id, recentRank, recentLength) {
  const rank = recentRank.get(id);
  if (rank === undefined || !recentLength) return 0;
  return 1 + (recentLength - rank) / recentLength;
}

function ids(size) {
  return Array.from({ length: size }, (_, index) => `word-${index + 1}`);
}

function overlap(left, right) {
  const rightSet = new Set(right);
  return left.filter((id) => rightSet.has(id)).length;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function runNormalSessions(poolSize, questionCount, sessionCount, weakness = {}) {
  const eligible = ids(poolSize);
  let state;
  const sessions = [];
  for (let session = 0; session < sessionCount; session += 1) {
    const result = selectFromVocabularyRotation(eligible, questionCount, state, weakness, "smoke");
    state = result.state;
    sessions.push(result);
  }
  return sessions;
}

const largeSessions = runNormalSessions(500, 20, 10);
largeSessions.forEach((session, index) => {
  assert(new Set(session.ids).size === session.ids.length, `large session ${index + 1} contains duplicate targets`);
});
const largeOverlaps = largeSessions.slice(1).map((session, index) => overlap(largeSessions[index].ids, session.ids));
assert(Math.max(...largeOverlaps) === 0, `large consecutive-session overlap was ${Math.max(...largeOverlaps)}, expected 0`);
assert(
  new Set(largeSessions.flatMap((session) => session.ids)).size === 200,
  `large sessions covered ${new Set(largeSessions.flatMap((session) => session.ids)).size} unique words, expected 200; lengths ${largeSessions.map((session) => session.ids.length).join(", ")}`,
);

const smallSessions = runNormalSessions(30, 20, 4);
smallSessions.forEach((session, index) => {
  assert(new Set(session.ids).size === session.ids.length, `small session ${index + 1} contains duplicate targets`);
});
const smallOverlaps = smallSessions.slice(1).map((session, index) => overlap(smallSessions[index].ids, session.ids));
assert(Math.min(...smallOverlaps) > 0, "small-pool overlap should occur when mathematically unavoidable");
assert(Math.max(...smallOverlaps) <= 10, `small-pool overlap was too high: ${Math.max(...smallOverlaps)}`);

const weakIds = Object.fromEntries(ids(5).map((id) => [id, 50]));
const weakSessions = runNormalSessions(500, 20, 5, weakIds);
const weakCounts = weakSessions.map((session) => session.reviewCount);
assert(Math.max(...weakCounts) <= 4, `normal weak review exceeded cap: ${Math.max(...weakCounts)}`);
assert(weakCounts.reduce((sum, value) => sum + value, 0) < 20, "weak items dominated normal sessions");

const weakPractice = stableShuffle(ids(500), "weak-explicit").sort((a, b) => (weakIds[b] ?? 0) - (weakIds[a] ?? 0)).slice(0, 20);
assert(overlap(Object.keys(weakIds), weakPractice.slice(0, 5)) === 5, "explicit weak practice did not prioritize weak items");

console.log(JSON.stringify({
  largePool: {
    sessions: largeSessions.length,
    questionCount: 20,
    consecutiveOverlaps: largeOverlaps,
    uniqueCoverage: new Set(largeSessions.flatMap((session) => session.ids)).size,
  },
  smallPool: {
    sessions: smallSessions.length,
    questionCount: 20,
    consecutiveOverlaps: smallOverlaps,
  },
  weakInfluence: {
    normalReviewCounts: weakCounts,
    explicitWeakInFirstFive: overlap(Object.keys(weakIds), weakPractice.slice(0, 5)),
  },
}, null, 2));
