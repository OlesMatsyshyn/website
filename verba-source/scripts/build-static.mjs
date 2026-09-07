import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const mode = process.argv[2] || "github-pages";
const basePaths = {
  "local-site": "/Verba",
  "github-pages": "/website/Verba",
};

if (!Object.hasOwn(basePaths, mode)) {
  console.error("Usage: node scripts/build-static.mjs <local-site|github-pages>");
  process.exit(1);
}

const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(sourceRoot, "..");
const outDir = path.join(sourceRoot, "out");
const deployDir = path.join(repoRoot, "Verba");
const nextCli = path.join(sourceRoot, "node_modules", "next", "dist", "bin", "next");

if (!outDir.startsWith(sourceRoot + path.sep)) {
  throw new Error("Refusing to clean outside the expected Verba source path.");
}

rmSync(outDir, { recursive: true, force: true });

const build = spawnSync(process.execPath, [nextCli, "build"], {
  cwd: sourceRoot,
  env: {
    ...process.env,
    NEXT_PUBLIC_VERBA_BASE_PATH: basePaths[mode],
  },
  stdio: "inherit",
});

if (build.status !== 0) {
  if (build.error) {
    console.error(build.error);
  }
  process.exit(build.status ?? 1);
}

if (!outDir.startsWith(sourceRoot + path.sep) || !deployDir.startsWith(repoRoot + path.sep)) {
  throw new Error("Refusing to sync outside the expected Verba workspace paths.");
}

mkdirSync(deployDir, { recursive: true });
for (const entry of readdirSync(deployDir)) {
  rmSync(path.join(deployDir, entry), { recursive: true, force: true });
}

if (!existsSync(outDir)) {
  throw new Error("Next build did not create an out directory.");
}

injectServiceWorkerCoreAssets();

cpSync(outDir, deployDir, { recursive: true });
console.log(`Synced ${path.relative(repoRoot, outDir)} to ${path.relative(repoRoot, deployDir)} using base path ${basePaths[mode]}.`);

function injectServiceWorkerCoreAssets() {
  const basePath = basePaths[mode];
  const indexPath = path.join(outDir, "index.html");
  const workerPath = path.join(outDir, "sw.js");

  if (!existsSync(indexPath) || !existsSync(workerPath)) {
    return;
  }

  const html = readFileSync(indexPath, "utf8");
  const coreAssets = new Set([
    "./",
    "./manifest.webmanifest",
    "./icons/verba.svg",
    "./icons/verba-192.png",
    "./icons/verba-512.png",
    "./packages/catalog.json",
  ]);
  const assetPattern = /(?:src|href)="([^"]+)"/g;
  let match;

  while ((match = assetPattern.exec(html)) !== null) {
    const assetPath = match[1];
    if (!assetPath.startsWith(`${basePath}/`)) continue;
    const relativePath = `.${assetPath.slice(basePath.length)}`;
    if (
      relativePath.startsWith("./_next/") ||
      relativePath.startsWith("./icons/") ||
      relativePath === "./manifest.webmanifest"
    ) {
      coreAssets.add(relativePath);
    }
  }

  const worker = readFileSync(workerPath, "utf8");
  const assetList = JSON.stringify([...coreAssets], null, 2);
  const updatedWorker = worker.replace(/const CORE_ASSETS = \[[\s\S]*?\];/, `const CORE_ASSETS = ${assetList};`);

  if (updatedWorker === worker) {
    throw new Error("Could not inject service-worker core assets.");
  }

  writeFileSync(workerPath, updatedWorker);
}
