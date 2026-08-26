import { makeId } from "@/lib/food-log";
import type { FoodReferencePhotoMetadata } from "@/lib/food-library";

export const REFERENCE_PHOTO_DB_NAME = "health-tracker-pwa.reference-photos";
export const REFERENCE_PHOTO_STORE_NAME = "photos";

const DB_VERSION = 1;
const MAX_DIMENSION = 1600;
const PROFILE_MAX_DIMENSION = 800;

function openDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(REFERENCE_PHOTO_DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(REFERENCE_PHOTO_STORE_NAME)) {
        db.createObjectStore(REFERENCE_PHOTO_STORE_NAME, { keyPath: "id" });
      }
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

async function compressImage(file: File, maxDimension = MAX_DIMENSION) {
  const dataUrl = await readFileAsDataUrl(file);
  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.onerror = () => reject(new Error("Could not read image."));
    image.onload = () => resolve();
    image.src = dataUrl;
  });

  const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not prepare image preview.");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not compress image."))),
      file.type.startsWith("image/") ? file.type : "image/jpeg",
      0.82,
    );
  });
}

export async function saveReferencePhoto({
  file,
  foodItemId,
  mealTemplateId,
}: {
  file: File;
  foodItemId: string | null;
  mealTemplateId: string | null;
}) {
  const blob = await compressImage(file);
  const db = await openDb();
  const now = new Date().toISOString();
  const metadata: FoodReferencePhotoMetadata = {
    id: makeId("reference-photo"),
    foodItemId,
    mealTemplateId,
    createdAt: now,
    fileName: file.name,
    mimeType: blob.type || file.type || "image/jpeg",
    reviewStatus: "pending",
  };

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(REFERENCE_PHOTO_STORE_NAME, "readwrite");
    tx.objectStore(REFERENCE_PHOTO_STORE_NAME).put({ ...metadata, blob });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();

  return metadata;
}

export async function saveProfilePhoto(file: File) {
  const blob = await compressImage(file, PROFILE_MAX_DIMENSION);
  const db = await openDb();
  const now = new Date().toISOString();
  const record = {
    id: makeId("profile-photo"),
    createdAt: now,
    fileName: file.name,
    mimeType: blob.type || file.type || "image/jpeg",
    reviewStatus: "reviewed" as const,
    kind: "profile-photo",
    blob,
  };

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(REFERENCE_PHOTO_STORE_NAME, "readwrite");
    tx.objectStore(REFERENCE_PHOTO_STORE_NAME).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();

  return record.id;
}

export async function readReferencePhotoUrl(id: string) {
  const db = await openDb();
  const record = await new Promise<{ blob?: Blob } | undefined>((resolve, reject) => {
    const tx = db.transaction(REFERENCE_PHOTO_STORE_NAME, "readonly");
    const request = tx.objectStore(REFERENCE_PHOTO_STORE_NAME).get(id);
    request.onsuccess = () => resolve(request.result as { blob?: Blob } | undefined);
    request.onerror = () => reject(request.error);
  });
  db.close();

  return record?.blob ? URL.createObjectURL(record.blob) : null;
}

export async function deleteReferencePhoto(id: string) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(REFERENCE_PHOTO_STORE_NAME, "readwrite");
    tx.objectStore(REFERENCE_PHOTO_STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function markReferencePhotoReviewed(id: string) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(REFERENCE_PHOTO_STORE_NAME, "readwrite");
    const store = tx.objectStore(REFERENCE_PHOTO_STORE_NAME);
    const request = store.get(id);
    request.onsuccess = () => {
      const record = request.result;
      if (record) {
        store.put({ ...record, reviewStatus: "reviewed" });
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}
