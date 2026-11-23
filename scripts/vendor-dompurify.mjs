#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkg = path.join(root, "node_modules/dompurify");
const version = JSON.parse(fs.readFileSync(path.join(pkg, "package.json"))).version;
const lock = JSON.parse(fs.readFileSync(path.join(root, "package-lock.json")));
const locked = lock.packages["node_modules/dompurify"];
if (version !== locked.version) throw new Error("Installed DOMPurify differs from package-lock.json; run npm ci.");
const output = path.join(root, "web/public/vendor");
const check = process.argv.includes("--check");
const entries = [["dist/purify.min.js", "purify.min.js"], ["dist/purify.min.js.map", "purify.min.js.map"], ["LICENSE", "DOMPurify-LICENSE.txt"], ["LICENSE-MPL", "DOMPurify-LICENSE-MPL.txt"]];
const manifest = { name: "DOMPurify", version, source: "https://github.com/cure53/DOMPurify", package: locked.resolved, integrity: locked.integrity, license: "MPL-2.0 OR Apache-2.0", files: [] };
for (const [from, to] of entries) {
  const bytes = fs.readFileSync(path.join(pkg, from));
  manifest.files.push({ path: to, sha256: createHash("sha256").update(bytes).digest("hex") });
  if (check) {
    if (!fs.readFileSync(path.join(output, to)).equals(bytes)) throw new Error(`Vendored file changed: ${to}`);
  } else {
    fs.mkdirSync(output, { recursive: true });
    fs.writeFileSync(path.join(output, to), bytes);
  }
}
const bytes = JSON.stringify(manifest, null, 2) + "\n";
const manifestPath = path.join(output, "dompurify-manifest.json");
if (check) {
  if (fs.readFileSync(manifestPath, "utf8") !== bytes) throw new Error("DOMPurify provenance manifest changed.");
} else fs.writeFileSync(manifestPath, bytes);
console.log(`DOMPurify ${version}: ${check ? "verified" : "copied"} ${entries.length} files and provenance manifest.`);
