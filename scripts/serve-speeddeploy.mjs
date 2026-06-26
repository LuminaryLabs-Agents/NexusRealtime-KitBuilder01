import http from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";

const port = Number(process.env.PORT ?? 5173);
const root = resolve(process.cwd());
const appRoot = join(root, "apps", "speeddeploy-fleet-dashboard");

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp"
};

function sendText(response, status, text, type = "text/plain; charset=utf-8") {
  response.writeHead(status, { "content-type": type });
  response.end(text);
}

function resolveRequestPath(url) {
  const parsed = new URL(url, `http://localhost:${port}`);
  const pathname = decodeURIComponent(parsed.pathname);

  if (pathname === "/" || pathname === "") {
    return join(appRoot, "index.html");
  }

  const stripped = pathname.replace(/^\/+/, "");
  const candidate = normalize(join(root, stripped));

  if (!candidate.startsWith(root)) {
    return null;
  }

  return candidate;
}

const server = http.createServer((request, response) => {
  const filePath = resolveRequestPath(request.url ?? "/");

  if (!filePath) {
    sendText(response, 403, "Forbidden");
    return;
  }

  let target = filePath;
  if (existsSync(target) && statSync(target).isDirectory()) {
    target = join(target, "index.html");
  }

  if (!existsSync(target) || !statSync(target).isFile()) {
    sendText(response, 404, `File not found: ${request.url}`);
    return;
  }

  response.writeHead(200, {
    "content-type": contentTypes[extname(target)] ?? "application/octet-stream",
    "cache-control": "no-store"
  });

  createReadStream(target).pipe(response);
});

server.listen(port, () => {
  console.log(`SpeedDeploy dashboard: http://localhost:${port}`);
  console.log(`Direct app path:       http://localhost:${port}/apps/speeddeploy-fleet-dashboard/`);
});
