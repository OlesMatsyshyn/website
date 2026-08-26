export type FoodSearchCandidate = {
  brand?: string | null;
  collectionName?: string | null;
  description?: string | null;
  fallbackText?: Array<string | null | undefined>;
  name: string;
  servingLabel?: string | null;
};

export function normalizeFoodSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’'`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function wholeWordMatch(value: string, query: string) {
  return value.split(" ").includes(query);
}

function scoreName(name: string, query: string) {
  const normalizedName = normalizeFoodSearchText(name);
  if (!normalizedName || !query) return 0;
  if (normalizedName === query) return 1000;
  if (normalizedName.startsWith(query)) return 800;
  if (wholeWordMatch(normalizedName, query)) return 650;
  if (normalizedName.includes(query)) return 500;
  return 0;
}

function scoreStarts(value: string | null | undefined, query: string, score: number) {
  const normalizedValue = normalizeFoodSearchText(value ?? "");
  return normalizedValue === query || normalizedValue.startsWith(query) ? score : 0;
}

function scoreContains(value: string | null | undefined, query: string, score: number) {
  const normalizedValue = normalizeFoodSearchText(value ?? "");
  return normalizedValue.includes(query) ? score : 0;
}

export function scoreFoodSearchCandidate(
  query: string,
  candidate: FoodSearchCandidate,
) {
  const normalizedQuery = normalizeFoodSearchText(query);
  if (!normalizedQuery) return 0;

  return Math.max(
    scoreName(candidate.name, normalizedQuery),
    scoreStarts(candidate.collectionName, normalizedQuery, 300),
    scoreStarts(candidate.brand, normalizedQuery, 280),
    scoreContains(candidate.servingLabel, normalizedQuery, 150),
    scoreContains(candidate.description, normalizedQuery, 50),
    ...(candidate.fallbackText ?? []).map((value) =>
      scoreContains(value, normalizedQuery, 50),
    ),
  );
}
