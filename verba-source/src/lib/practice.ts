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
