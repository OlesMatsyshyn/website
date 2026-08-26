import { createZip, decodeZipJson, readZip, type ZipInputFile } from "@/lib/zip";

import { WELLCANVAS_VERSION } from "@/lib/version";

const APP_STORAGE_PREFIX = "health-tracker-pwa.";

export type WellCanvasBackupManifest = {
  format: "wellcanvas-backup";
  schemaVersion: 1;
  appVersion: string;
  exportedAt: string;
  contents: string[];
};

export type WellCanvasBackupPreview = {
  exportedAt: string;
  contents: string[];
  itemCount: number;
  logCount: number;
};

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function dateStamp(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function localStorageSnapshot() {
  const values: Record<string, string> = {};
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (key?.startsWith(APP_STORAGE_PREFIX)) {
      values[key] = window.localStorage.getItem(key) ?? "";
    }
  }
  return values;
}

function countJsonArray(storage: Record<string, string>, key: string) {
  try {
    const value = JSON.parse(storage[key] ?? "[]");
    return Array.isArray(value) ? value.length : 0;
  } catch {
    return 0;
  }
}

export function createWellCanvasBackup() {
  const exportedAt = new Date().toISOString();
  const storage = localStorageSnapshot();
  const manifest: WellCanvasBackupManifest = {
    format: "wellcanvas-backup",
    schemaVersion: 1,
    appVersion: WELLCANVAS_VERSION,
    exportedAt,
    contents: ["localStorage"],
  };
  return createZip([
    { path: "manifest.json", data: JSON.stringify(manifest, null, 2) },
    { path: "settings.json", data: JSON.stringify(storage, null, 2) },
  ]);
}

export async function readWellCanvasBackup(file: File) {
  const files = await readZip(file);
  const manifest = decodeZipJson<WellCanvasBackupManifest>(files, "manifest.json");
  if (manifest.format !== "wellcanvas-backup" || manifest.schemaVersion !== 1) {
    throw new Error("This is not a supported WellCanvas backup.");
  }
  const storage = decodeZipJson<Record<string, string>>(files, "settings.json");
  const preview: WellCanvasBackupPreview = {
    exportedAt: manifest.exportedAt,
    contents: manifest.contents,
    itemCount:
      countJsonArray(storage, "health-tracker-pwa.food-items.v1") +
      countJsonArray(storage, "health-tracker-pwa.meal-templates.v1"),
    logCount:
      countJsonArray(storage, "health-tracker-pwa.food-log-entries.v1") +
      countJsonArray(storage, "health-tracker-pwa.hydration-entries.v1") +
      countJsonArray(storage, "health-tracker-pwa.activity-entries.v1"),
  };
  return { preview, storage };
}

export function restoreWellCanvasBackup(storage: Record<string, string>) {
  const nextEntries = Object.entries(storage).filter(([key]) =>
    key.startsWith(APP_STORAGE_PREFIX),
  );
  for (const [key, value] of nextEntries) {
    window.localStorage.setItem(key, value);
  }
}

export function jsonZipFile(path: string, value: unknown): ZipInputFile {
  return { path, data: JSON.stringify(value, null, 2) };
}
