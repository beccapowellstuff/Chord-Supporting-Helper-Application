const http = require("http");
const fs = require("fs");
const path = require("path");

const rootDir = process.cwd();
const port = Number(process.argv[2] || 4173);
const musicDemosDir = path.join(rootDir, "Music Demos");

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".wav": "audio/wav"
};

function resolvePath(urlPathname) {
  const decodedPath = decodeURIComponent(urlPathname.split("?")[0]);
  const relativePath = decodedPath === "/" ? "/index.html" : decodedPath;
  const fullPath = path.join(rootDir, relativePath);
  const normalizedRoot = path.resolve(rootDir);
  const normalizedFullPath = path.resolve(fullPath);

  if (!normalizedFullPath.startsWith(normalizedRoot)) {
    return null;
  }

  return normalizedFullPath;
}

const server = http.createServer((req, res) => {
  const requestUrl = req.url || "/";

  if (requestUrl.split("?")[0] === "/__music-demos") {
    fs.readdir(musicDemosDir, { withFileTypes: true }, (readError, entries) => {
      if (readError) {
        res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ demos: [] }));
        return;
      }

      const demos = entries
        .filter(entry => entry.isFile() && path.extname(entry.name).toLowerCase() === ".json")
        .map(entry => ({
          fileName: entry.name,
          path: `./Music%20Demos/${encodeURIComponent(entry.name)}`,
          label: entry.name.replace(/\.json$/i, "")
        }))
        .sort((a, b) => a.fileName.localeCompare(b.fileName));

      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ demos }));
    });
    return;
  }

  const targetPath = resolvePath(requestUrl);

  if (!targetPath) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.stat(targetPath, (statError, stats) => {
    if (statError || !stats.isFile()) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    const ext = path.extname(targetPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    res.writeHead(200, { "Content-Type": contentType });
    fs.createReadStream(targetPath).pipe(res);
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Static test server running at http://127.0.0.1:${port}`);
});

function shutdown() {
  server.close(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
