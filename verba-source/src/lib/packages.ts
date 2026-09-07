import { withBasePath } from "@/lib/deployment";
import type { CoursePackage, FormExercise, PackageCatalog, PackageCatalogItem, WordPair } from "@/lib/types";

const DB_NAME = "verba-packages";
const DB_VERSION = 1;
const STORE_NAME = "packages";
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
    })),
    ...(candidate.reference ? { reference: candidate.reference } : {}),
  };
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
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
