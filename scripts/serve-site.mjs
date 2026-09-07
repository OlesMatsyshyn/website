import { createServer } from "node:http";
import { existsSync, statSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const portIndex = args.indexOf("--port");
const baseIndex = args.indexOf("--base");
const port = Number(process.env.PORT || (portIndex >= 0 ? args[portIndex + 1] : "") || 4173);
const basePath = (baseIndex >= 0 ? args[baseIndex + 1] : "/website").replace(/\/$/, "");
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".webp": "image/webp",
};

function resolveRequestPath(requestUrl) {
  let urlPath = decodeURIComponent((requestUrl || "/").split("?")[0]);
  if (urlPath === basePath) {
    urlPath = `${basePath}/`;
  }
  if (urlPath.startsWith(`${basePath}/`)) {
    urlPath = urlPath.slice(basePath.length);
  }
  if (urlPath === "/") {
    urlPath = "/index.html";
  }
  let filePath = path.resolve(repoRoot, `.${urlPath}`);
  if (existsSync(filePath) && statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, "index.html");
  }
  return filePath;
}

const server = createServer((request, response) => {
  const filePath = resolveRequestPath(request.url);
  if (!filePath.toLowerCase().startsWith(repoRoot.toLowerCase() + path.sep)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }
  if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
    response.writeHead(404);
    response.end("Not found");
    return;
  }
  response.writeHead(200, {
    "Content-Type": mimeTypes[path.extname(filePath)] || "application/octet-stream",
  });
  response.end(readFileSync(filePath));
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Website: http://127.0.0.1:${port}${basePath}/`);
  console.log(`Verba:   http://127.0.0.1:${port}${basePath}/Verba/`);
  console.log("Press Ctrl+C to stop.");
});
