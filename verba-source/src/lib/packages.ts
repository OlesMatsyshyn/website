import { withBasePath } from "@/lib/deployment";
import type { CoursePackage, CustomPackageContent, FormExercise, PackageCatalog, PackageCatalogItem, WordPair, WordSet } from "@/lib/types";

const DB_NAME = "verba-packages";
const DB_VERSION = 2;
const STORE_NAME = "packages";
const CUSTOM_STORE_NAME = "custom-content";
const ACTIVE_PACKAGE_KEY = "verba.activePackage.v1";
const PACKAGE_ASSET_CACHE = "verba-package-assets-v2";

export async function loadCatalog(): Promise<PackageCatalog> {
  const response = await fetch(withBasePath("/packages/catalog.json"));
  if (!response.ok) {
    throw new Error("Could not load package catalog.");
  }
  const catalog = (await response.json()) as PackageCatalog;
  if (!Array.isArray(catalog.packages)) {
    throw new Error("Package catalog is malformed.");
  }
  return catalog;
}

export async function downloadPackage(item: PackageCatalogItem): Promise<CoursePackage> {
  const response = await fetch(withBasePath(`/${item.path}`));
  if (!response.ok) {
    throw new Error(`Could not download ${item.title}.`);
  }
  const coursePackage = normalizePackage(await response.json());
  if (coursePackage.metadata.id !== item.id) {
    throw new Error("Downloaded package did not match the catalog entry.");
  }
  await cachePackageAssets(coursePackage);
  await saveInstalledPackage(coursePackage);
  return coursePackage;
}

export async function readInstalledPackages(): Promise<CoursePackage[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve((request.result as unknown[]).map(normalizePackage));
    request.onerror = () => reject(request.error);
  });
}

export async function readInstalledPackage(packageId: string): Promise<CoursePackage | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).get(packageId);
    request.onsuccess = () => resolve(request.result ? normalizePackage(request.result) : null);
    request.onerror = () => reject(request.error);
  });
}

export async function saveInstalledPackage(coursePackage: CoursePackage): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(coursePackage);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function removeInstalledPackage(packageId: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).delete(packageId);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function readAllCustomContent(): Promise<Record<string, CustomPackageContent>> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(CUSTOM_STORE_NAME, "readonly");
    const request = transaction.objectStore(CUSTOM_STORE_NAME).getAll();
    request.onsuccess = () => {
      const entries = (request.result as unknown[]).map(normalizeCustomContent);
      resolve(Object.fromEntries(entries.map((entry) => [entry.packageId, entry])));
    };
    request.onerror = () => reject(request.error);
  });
}

export async function readCustomContent(packageId: string): Promise<CustomPackageContent> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(CUSTOM_STORE_NAME, "readonly");
    const request = transaction.objectStore(CUSTOM_STORE_NAME).get(packageId);
    request.onsuccess = () => resolve(normalizeCustomContent(request.result ?? { packageId }));
    request.onerror = () => reject(request.error);
  });
}

export async function saveCustomContent(content: CustomPackageContent): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(CUSTOM_STORE_NAME, "readwrite");
    transaction.objectStore(CUSTOM_STORE_NAME).put(normalizeCustomContent(content));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function appendCustomContent(packageId: string, additions: Partial<Omit<CustomPackageContent, "packageId">>) {
  const current = await readCustomContent(packageId);
  const next = normalizeCustomContent({
    packageId,
    words: [...current.words, ...(additions.words ?? [])],
    texts: [...current.texts, ...(additions.texts ?? [])],
    forms: [...current.forms, ...(additions.forms ?? [])],
    wordSets: mergeWordSets(current.wordSets, additions.wordSets ?? []),
  });
  await saveCustomContent(next);
  return next;
}

export async function createLocalPackage(title: string, language = title, languageCode = "local", variant = "Local") {
  const id = makeLocalId("package").replace("custom-package", "local");
  const coursePackage = normalizePackage({
    metadata: {
      id,
      language,
      languageCode,
      variant,
      level: 0,
      title,
      description: "Local package stored on this device.",
      version: 1,
      wordCount: 0,
      textCount: 0,
      formCount: 0,
      source: "local",
    },
    words: [],
    texts: [],
    forms: [],
  });
  await saveInstalledPackage(coursePackage);
  await saveCustomContent({ packageId: id, words: [], texts: [], forms: [], wordSets: [] });
  return coursePackage;
}

export async function deleteLocalPackage(packageId: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME, CUSTOM_STORE_NAME], "readwrite");
    transaction.objectStore(STORE_NAME).delete(packageId);
    transaction.objectStore(CUSTOM_STORE_NAME).delete(packageId);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export function mergeCustomContent(coursePackage: CoursePackage, custom: CustomPackageContent | undefined): CoursePackage {
  const normalizedCustom = normalizeCustomContent(custom ?? { packageId: coursePackage.metadata.id });
  const merged = normalizePackage({
    ...coursePackage,
    metadata: coursePackage.metadata,
    words: [...coursePackage.words, ...normalizedCustom.words],
    texts: [...coursePackage.texts, ...normalizedCustom.texts],
    forms: [...coursePackage.forms, ...normalizedCustom.forms],
  });
  return {
    ...merged,
    metadata: {
      ...merged.metadata,
      source: coursePackage.metadata.source,
    },
  };
}

export function readActivePackageId() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(ACTIVE_PACKAGE_KEY) ?? "";
}

export function saveActivePackageId(packageId: string) {
  if (typeof window === "undefined") return;
  if (packageId) {
    window.localStorage.setItem(ACTIVE_PACKAGE_KEY, packageId);
  } else {
    window.localStorage.removeItem(ACTIVE_PACKAGE_KEY);
  }
}

export function termForWord(word: WordPair) {
  return word.term ?? word.ro ?? "";
}

export function translationForWord(word: WordPair) {
  return word.translation ?? word.en ?? "";
}

export function formBefore(form: FormExercise) {
  return form.before ?? form.prefix ?? "";
}

export function normalizePackage(value: unknown): CoursePackage {
  const candidate = value as Partial<CoursePackage>;
  if (!candidate.metadata?.id || !candidate.metadata.title) {
    throw new Error("Package metadata is missing.");
  }
  if (!Array.isArray(candidate.words) || !Array.isArray(candidate.texts) || !Array.isArray(candidate.forms)) {
    throw new Error("Package content is incomplete.");
  }

  return {
    metadata: {
      ...candidate.metadata,
      wordCount: candidate.words.length,
      textCount: candidate.texts.length,
      formCount: candidate.forms.length,
    },
    words: candidate.words.map((word) => ({
      ...word,
      term: termForWord(word),
      translation: translationForWord(word),
    })),
    texts: candidate.texts,
    forms: candidate.forms.map((form) => ({
      ...form,
      type: form.type ?? "form",
      before: formBefore(form),
      after: form.after ?? "",
      result: form.result ?? `${formBefore(form)}${form.answer ?? ""}${form.after ?? ""}`,
      note: form.note ?? "",
    })),
    ...(candidate.reference ? { reference: candidate.reference } : {}),
  };
}

function normalizeCustomContent(value: unknown): CustomPackageContent {
  const candidate = value as Partial<CustomPackageContent>;
  return {
    packageId: candidate.packageId ?? "",
    words: Array.isArray(candidate.words)
      ? candidate.words.map((word) => ({
          ...word,
          id: word.id ?? makeLocalId("word"),
          term: termForWord(word),
          translation: translationForWord(word),
          custom: true,
        }))
      : [],
    texts: Array.isArray(candidate.texts)
      ? candidate.texts.map((item) => ({
          id: item.id ?? makeLocalId("text"),
          title: item.title ?? "Custom text",
          text: item.text,
          translation: item.translation ?? "",
          translationLanguage: item.translationLanguage ?? "English",
          custom: true,
        }))
      : [],
    forms: Array.isArray(candidate.forms)
      ? candidate.forms.map((item) => normalizeCustomForm(item))
      : [],
    wordSets: Array.isArray(candidate.wordSets)
      ? candidate.wordSets.map((item) => normalizeWordSet(item, candidate.packageId ?? "")).filter((item) => item.title)
      : [],
  };
}

function normalizeWordSet(item: Partial<WordSet>, packageId: string): WordSet {
  const uniqueWordIds = Array.from(new Set((Array.isArray(item.wordIds) ? item.wordIds : []).filter((id): id is string => typeof id === "string" && Boolean(id.trim()))));
  return {
    id: item.id ?? makeLocalId("set"),
    packageId: item.packageId ?? packageId,
    title: item.title?.trim() ?? "",
    wordIds: uniqueWordIds,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

function mergeWordSets(current: WordSet[], additions: WordSet[]) {
  const byTitle = new Map(current.map((set) => [set.title.trim().toLocaleLowerCase(), { ...set, wordIds: [...set.wordIds] }]));
  additions.forEach((set) => {
    const key = set.title.trim().toLocaleLowerCase();
    if (!key) return;
    const existing = byTitle.get(key);
    if (!existing) {
      byTitle.set(key, { ...set, wordIds: Array.from(new Set(set.wordIds)) });
      return;
    }
    byTitle.set(key, {
      ...existing,
      updatedAt: new Date().toISOString(),
      wordIds: Array.from(new Set([...existing.wordIds, ...set.wordIds])),
    });
  });
  return Array.from(byTitle.values());
}

function normalizeCustomForm(item: Partial<FormExercise>): FormExercise {
  const before = formBefore(item as FormExercise);
  const after = item.after ?? "";
  const answer = item.answer ?? "";
  return {
    id: item.id ?? makeLocalId("form"),
    type: item.type ?? "form",
    prompt: item.prompt ?? "",
    before,
    answer,
    after,
    result: item.result ?? `${before}${answer}${after}`,
    note: item.note ?? "",
    custom: true,
  };
}

function makeLocalId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `custom-${prefix}-${crypto.randomUUID()}`;
  return `custom-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function cachePackageAssets(coursePackage: CoursePackage) {
  if (typeof window === "undefined") return;
  const urls = referencedAssetUrls(coursePackage);
  if (!urls.length) return;

  if ("caches" in window) {
    const cache = await caches.open(PACKAGE_ASSET_CACHE);
    await Promise.all(
      urls.map(async (url) => {
        const response = await fetch(url, { cache: "reload" });
        if (!response.ok) throw new Error(`Could not cache package asset: ${url}`);
        await cache.put(url, response.clone());
      }),
    );
    return;
  }

  await Promise.all(
    urls.map(async (url) => {
      const response = await fetch(url, { cache: "reload" });
      if (!response.ok) throw new Error(`Could not download package asset: ${url}`);
    }),
  );
}

function referencedAssetUrls(coursePackage: CoursePackage) {
  const asset = coursePackage.reference?.flag?.asset;
  if (!asset) return [];
  const rawSrc = typeof asset === "string" ? asset : asset.src;
  if (!rawSrc || /^https?:\/\//i.test(rawSrc)) return [];
  const src = rawSrc.startsWith("/") ? rawSrc : `/${rawSrc}`;
  return [withBasePath(src)];
}

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB is not available in this browser."));
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "metadata.id" });
      }
      if (!db.objectStoreNames.contains(CUSTOM_STORE_NAME)) {
        db.createObjectStore(CUSTOM_STORE_NAME, { keyPath: "packageId" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
