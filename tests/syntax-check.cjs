const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const rootDir = process.cwd();
const targets = [
  "index.html",
  "open-browser.js",
  "playwright.config.js",
  "js",
  "tests"
];

const ignoredDirectories = new Set([
  "node_modules",
  "playwright-report",
  "test-results"
]);

function collectJavaScriptFiles(targetPath, output) {
  const absolutePath = path.join(rootDir, targetPath);
  if (!fs.existsSync(absolutePath)) {
    return;
  }

  const stats = fs.statSync(absolutePath);
  if (stats.isDirectory()) {
    for (const entry of fs.readdirSync(absolutePath, { withFileTypes: true })) {
      if (entry.isDirectory() && ignoredDirectories.has(entry.name)) {
        continue;
      }
      collectJavaScriptFiles(path.join(targetPath, entry.name), output);
    }
    return;
  }

  if (absolutePath.endsWith(".js") || absolutePath.endsWith(".cjs") || absolutePath.endsWith(".mjs")) {
    output.push(absolutePath);
  }
}

const files = [];
targets.forEach(target => collectJavaScriptFiles(target, files));

let hasFailure = false;

for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], {
    stdio: "inherit"
  });

  if (result.status !== 0) {
    hasFailure = true;
  }
}

if (hasFailure) {
  process.exit(1);
}

console.log(`Syntax check passed for ${files.length} JavaScript files.`);
