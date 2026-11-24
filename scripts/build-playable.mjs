#!/usr/bin/env node
/**
 * Deterministic standalone HTML builder & parity verifier for 《尘缘问道 · 剑阵万象》.
 * Pure Node ESM (zero external dependencies).
 *
 * Usage:
 *   node scripts/build-playable.mjs               # Build web/public/playable-v2.html
 *   node scripts/build-playable.mjs --check       # Verify byte-for-byte parity in memory
 *   node scripts/build-playable.mjs --out <path>  # Write isolated test build to <path>
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const REPO_ROOT = path.resolve(__dirname, "..");

const DEFAULT_OUT_REL = "web/public/playable-v2.html";
const TEMPLATE_REL = "src/template.html";
const STYLE_REL = "src/styles/main.css";
const BODY_REL = "src/markup/body.html";
const ART_INDEX_REL = "src/assets/art-index.json";

const PROTECTED_RGBA_KEYS_REQUIRED = [
  "item_rough_jade",
  "pet_fox",
  "pet_roc",
  "pet_sword",
  "pet_turtle"
];

/**
 * Topological assembly order for pure ESM modules inlined inside the single runtime IIFE.
 * Each module is independently importable in Node (`node --test`) and stripped of top-level
 * ESM `import` / `export` syntax when assembled into `web/public/playable-v2.html`.
 */
export const ESM_MODULE_ORDER = [
  "src/rules/utils.mjs",
  "src/config/combat-params.mjs",
  "src/config/realms-items.mjs",
  "src/config/progression-data.mjs",
  "src/rules/gear-rules.mjs",
  "src/rules/combat-stats.mjs",
  "src/rules/economy-rules.mjs",
  "src/rules/scoring-rules.mjs",
  "src/state/save-rules.mjs"
];

const RUNTIME_PREAMBLE_REL = "src/runtime/preamble.js";
const RUNTIME_MAIN_REL = "src/runtime/main.js";
const RUNTIME_DEBUG_FACADE_REL = "src/runtime/debug-facade.js";
const RUNTIME_BOOT_REL = "src/runtime/boot.js";

function sha256Hex(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function readUtf8Strict(relPath) {
  const absPath = path.join(REPO_ROOT, relPath);
  const buf = fs.readFileSync(absPath);
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    throw new Error(`UTF-8 BOM is forbidden in source file: ${relPath}`);
  }
  return buf.toString("utf8").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function stripTrailingNewline(text) {
  return text.endsWith("\n") ? text.slice(0, -1) : text;
}

function replaceLiteralSentinel(template, token, payload, label) {
  const parts = template.split(token);
  if (parts.length !== 2) {
    throw new Error(`Expected exactly 1 sentinel ${token} in ${label}, found ${parts.length - 1}`);
  }
  return parts[0] + payload + parts[1];
}

export function parseWebpHeader(buf, label) {
  if (!Buffer.isBuffer(buf) || buf.length < 30) {
    throw new Error(`Truncated WebP payload (${buf ? buf.length : 0} bytes): ${label}`);
  }
  if (buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WEBP") {
    throw new Error(`Invalid RIFF/WEBP header: ${label}`);
  }
  const fourcc = buf.toString("ascii", 12, 16);
  let width = 0;
  let height = 0;
  let hasAlpha = false;
  if (fourcc === "VP8X") {
    const flags = buf[20];
    hasAlpha = Boolean(flags & 0x10);
    width = 1 + (buf[24] | (buf[25] << 8) | (buf[26] << 16));
    height = 1 + (buf[27] | (buf[28] << 8) | (buf[29] << 16));
  } else if (fourcc === "VP8 ") {
    width = (buf[26] | (buf[27] << 8)) & 0x3fff;
    height = (buf[28] | (buf[29] << 8)) & 0x3fff;
    hasAlpha = false;
  } else if (fourcc === "VP8L") {
    const bits = buf.readUInt32LE(21);
    width = (bits & 0x3fff) + 1;
    height = ((bits >> 14) & 0x3fff) + 1;
    hasAlpha = Boolean((bits >> 28) & 1);
  } else {
    throw new Error(`Unsupported WebP chunk "${fourcc}": ${label}`);
  }
  return { format: fourcc.trim(), width, height, hasAlpha };
}

/**
 * Strips top-level ESM `import ... from "...";` (single-line or multi-line) and leading
 * top-level `export ` keywords (`export const|let|var|function|async function`), then indents
 * every non-empty line by 2 spaces so `scripts/art-manifest.mjs` resolves top-level symbols
 * cleanly inside the single runtime IIFE.
 */
export function transformEsmForIife(source, relPath) {
  let text = source.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (/<\/script/i.test(text)) {
    throw new Error(`Forbidden "</script" sequence found in ${relPath}`);
  }
  // Remove top-level single-line or multi-line `import ... from "...";` statements
  text = text.replace(/^import[\s\S]*?from\s+["'][^"']+["'];?\s*\n?/gm, "");
  // Reject re-exports (`export { ... }` or `export default`) so assembled IIFE stays flat
  if (/^export\s+(?:default\b|\{|\*)/m.test(text)) {
    throw new Error(`Unsupported export form (default/braced/star) in ${relPath}; use named export const/let/function.`);
  }
  // Strip top-level `export ` modifier on declarations
  text = text.replace(/^export\s+(?=(?:const|let|var|async\s+function|function)\b)/gm, "");
  // Trim leading/trailing blank lines
  text = text.replace(/^\n+/, "").replace(/\n+$/, "");
  // Indent every non-empty line by 2 spaces
  return text
    .split("\n")
    .map((line) => (line.length === 0 ? "" : "  " + line))
    .join("\n");
}

function loadAndValidateArtIndex() {
  const raw = readUtf8Strict(ART_INDEX_REL);
  const index = JSON.parse(raw);
  if (!index || index.schemaVersion !== 1 || !Array.isArray(index.assets)) {
    throw new Error(`Invalid ${ART_INDEX_REL}: expected schemaVersion 1 and assets array`);
  }
  if (!Array.isArray(index.protectedRgbaKeys)) {
    throw new Error(`Invalid ${ART_INDEX_REL}: missing protectedRgbaKeys array`);
  }
  for (const reqKey of PROTECTED_RGBA_KEYS_REQUIRED) {
    if (!index.protectedRgbaKeys.includes(reqKey)) {
      throw new Error(`${ART_INDEX_REL} missing required protected RGBA key: ${reqKey}`);
    }
  }
  if (index.assets.length !== 115) {
    throw new Error(`Expected 115 assets in ${ART_INDEX_REL}, found ${index.assets.length}`);
  }

  const protectedSet = new Set(index.protectedRgbaKeys);
  const seenKeys = new Set();
  const artLines = ["const ART = {"];
  const verifiedAssets = [];

  for (let i = 0; i < index.assets.length; i++) {
    const entry = index.assets[i];
    if (!entry || typeof entry.key !== "string" || typeof entry.file !== "string") {
      throw new Error(`Malformed asset entry at index ${i} in ${ART_INDEX_REL}`);
    }
    if (seenKeys.has(entry.key)) {
      throw new Error(`Duplicate asset key "${entry.key}" in ${ART_INDEX_REL}`);
    }
    seenKeys.add(entry.key);

    const absAsset = path.join(REPO_ROOT, entry.file);
    if (!fs.existsSync(absAsset)) {
      throw new Error(`Missing runtime asset file: ${entry.file}`);
    }
    const buf = fs.readFileSync(absAsset);
    if (buf.length !== entry.bytes) {
      throw new Error(`Asset byte mismatch for ${entry.key}: expected ${entry.bytes}, got ${buf.length}`);
    }
    const actualSha = sha256Hex(buf);
    if (actualSha !== entry.sha256) {
      throw new Error(`Asset SHA-256 mismatch for ${entry.key}: expected ${entry.sha256}, got ${actualSha}`);
    }
    if (entry.mime !== "image/webp") {
      throw new Error(`Unexpected mime "${entry.mime}" for ${entry.key} (expected image/webp)`);
    }
    const webp = parseWebpHeader(buf, `${entry.file} (${entry.key})`);
    if (webp.width < 16 || webp.height < 16) {
      throw new Error(`WebP dimensions too small for ${entry.key}: ${webp.width}x${webp.height}`);
    }
    if (protectedSet.has(entry.key) && (webp.format !== "VP8X" || !webp.hasAlpha)) {
      throw new Error(`Protected RGBA sprite "${entry.key}" lost VP8X alpha channel (${webp.format}, alpha=${webp.hasAlpha})`);
    }

    const b64 = buf.toString("base64");
    const comma = i < index.assets.length - 1 ? "," : "";
    artLines.push(`  "${entry.key}": "data:${entry.mime};base64,${b64}"${comma}`);
    verifiedAssets.push({ ...entry, webp });
  }

  artLines.push("};");
  return { index, verifiedAssets, artBlock: artLines.join("\n") };
}

function validateBuiltHtml(html, expectedAssets, protectedRgbaKeys) {
  if (html.includes("\r")) {
    throw new Error("Built HTML contains CR characters (must be LF only)");
  }
  if (!html.endsWith("\n") || html.endsWith("\n\n")) {
    throw new Error("Built HTML must end with exactly one trailing LF");
  }

  // 1. Strictly 1 <script> tag and it MUST be bare <script> (no attributes)
  const allScriptOpens = html.match(/<script\b[^>]*>/gi) || [];
  if (allScriptOpens.length !== 1) {
    throw new Error(`Expected strictly 1 <script> tag in built HTML, found ${allScriptOpens.length}`);
  }
  if (allScriptOpens[0] !== "<script>") {
    throw new Error(`Expected bare "<script>" tag (no attributes), found "${allScriptOpens[0]}"`);
  }
  const scriptMatches = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  if (scriptMatches.length !== 1) {
    throw new Error(`Failed to extract single bare <script>...</script> block (found ${scriptMatches.length})`);
  }
  const scriptBody = scriptMatches[0][1];

  // 2. Compile scriptBody via vm.Script (0 syntax errors)
  new vm.Script(scriptBody, { filename: "web/public/playable-v2.html#script-0" });

  // 3. Zero external network / CDN dependencies
  const headAndBody = html.replace(/<script>[\s\S]*?<\/script>/g, "");
  const styleMatches = [...headAndBody.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)];
  for (const sm of styleMatches) {
    const css = sm[1];
    if (/@import\b/i.test(css)) {
      throw new Error("Forbidden CSS @import found in built HTML");
    }
    if (/url\(\s*['"]?\s*(?:https?:|\/\/)/i.test(css)) {
      throw new Error("Forbidden external CSS url() found in built HTML");
    }
  }
  // Check external <link href=...>, <script src=...>, media tags
  const extLinkRe = /<link\b[^>]*\bhref\s*=\s*["']\s*(?:https?:|\/\/)/gi;
  if (extLinkRe.test(headAndBody)) {
    throw new Error("Forbidden external <link href> found in built HTML");
  }
  const extMediaRe = /<(?:script|img|audio|video|source|iframe|embed|object)\b[^>]*\b(?:src|data)\s*=\s*["']\s*(?:https?:|\/\/)/gi;
  if (extMediaRe.test(headAndBody)) {
    throw new Error("Forbidden external media/script src/data URL found in built HTML");
  }

  // 4. Re-parse const ART = { ... }; from built HTML and verify 100% SHA-256 & 5 protected RGBA
  const lines = html.split("\n");
  const artStartIdx = lines.findIndex((l) => /^const ART = \{\s*$/.test(l));
  let artEndIdx = -1;
  if (artStartIdx >= 0) {
    for (let i = artStartIdx + 1; i < lines.length; i++) {
      if (/^\};\s*$/.test(lines[i])) {
        artEndIdx = i;
        break;
      }
    }
  }
  if (artStartIdx < 0 || artEndIdx < 0) {
    throw new Error("Failed to re-parse column-0 'const ART = {' ... '};' block in built HTML");
  }

  const entryRe = /^\s*"([^"]+)":\s*"data:image\/([a-zA-Z0-9+.-]+);base64,([A-Za-z0-9+/=]+)",?\s*$/;
  const expectedByKey = new Map(expectedAssets.map((a) => [a.key, a]));
  const protectedSet = new Set(protectedRgbaKeys);
  const parsedKeys = [];
  for (let i = artStartIdx + 1; i < artEndIdx; i++) {
    const m = lines[i].match(entryRe);
    if (!m) {
      throw new Error(`Malformed ART entry at built HTML line ${i + 1}`);
    }
    const [, key, subtype, b64] = m;
    const expected = expectedByKey.get(key);
    if (!expected) {
      throw new Error(`Unexpected ART key "${key}" in built HTML`);
    }
    const decoded = Buffer.from(b64, "base64");
    const actualSha = sha256Hex(decoded);
    if (decoded.length !== expected.bytes || actualSha !== expected.sha256) {
      throw new Error(`Built HTML ART mismatch for "${key}"`);
    }
    if (`image/${subtype}` !== expected.mime) {
      throw new Error(`Built HTML ART mime mismatch for "${key}"`);
    }
    if (protectedSet.has(key)) {
      const wp = parseWebpHeader(decoded, `built:${key}`);
      if (wp.format !== "VP8X" || !wp.hasAlpha) {
        throw new Error(`Built HTML lost VP8X alpha on protected key "${key}"`);
      }
    }
    parsedKeys.push(key);
  }
  if (parsedKeys.length !== expectedAssets.length) {
    throw new Error(`Built HTML ART count mismatch: expected ${expectedAssets.length}, got ${parsedKeys.length}`);
  }

  return {
    scriptBytes: Buffer.byteLength(scriptBody, "utf8"),
    artCount: parsedKeys.length
  };
}

export function assemblePlayableHtml() {
  const template = readUtf8Strict(TEMPLATE_REL);
  const css = stripTrailingNewline(readUtf8Strict(STYLE_REL));
  const body = stripTrailingNewline(readUtf8Strict(BODY_REL));

  if (/<\/style/i.test(css)) {
    throw new Error(`Forbidden "</style" sequence found in ${STYLE_REL}`);
  }

  const { index, verifiedAssets, artBlock } = loadAndValidateArtIndex();

  const preamble = stripTrailingNewline(readUtf8Strict(RUNTIME_PREAMBLE_REL));
  const mainRuntime = stripTrailingNewline(readUtf8Strict(RUNTIME_MAIN_REL));
  const bootRuntime = stripTrailingNewline(readUtf8Strict(RUNTIME_BOOT_REL));

  const facadeAbs = path.join(REPO_ROOT, RUNTIME_DEBUG_FACADE_REL);
  const debugFacade = fs.existsSync(facadeAbs)
    ? stripTrailingNewline(readUtf8Strict(RUNTIME_DEBUG_FACADE_REL))
    : "";

  for (const [label, chunk] of [
    [RUNTIME_PREAMBLE_REL, preamble],
    [RUNTIME_MAIN_REL, mainRuntime],
    [RUNTIME_DEBUG_FACADE_REL, debugFacade],
    [RUNTIME_BOOT_REL, bootRuntime]
  ]) {
    if (/<\/script/i.test(chunk)) {
      throw new Error(`Forbidden "</script" sequence found in ${label}`);
    }
  }

  const inlinedModules = ESM_MODULE_ORDER.map((relPath) => {
    const raw = readUtf8Strict(relPath);
    const bodyText = transformEsmForIife(raw, relPath);
    return `  // --- [module] ${relPath} ---\n${bodyText}`;
  });

  const iifeParts = [
    '(function() {',
    '  "use strict";',
    "",
    preamble
  ];
  if (inlinedModules.length > 0) {
    iifeParts.push("");
    iifeParts.push(inlinedModules.join("\n\n"));
    iifeParts.push("");
  }
  iifeParts.push(mainRuntime);
  if (debugFacade.trim().length > 0) {
    iifeParts.push(debugFacade);
  }
  iifeParts.push(bootRuntime);
  iifeParts.push("})();");

  const scriptBlock = iifeParts.join("\n");

  let html = template;
  html = replaceLiteralSentinel(html, "__INLINE_STYLE__", css, TEMPLATE_REL);
  html = replaceLiteralSentinel(html, "__INLINE_BODY__", body, TEMPLATE_REL);
  html = replaceLiteralSentinel(html, "__INLINE_ART__", artBlock, TEMPLATE_REL);
  html = replaceLiteralSentinel(html, "__INLINE_SCRIPT__", scriptBlock, TEMPLATE_REL);

  const stats = validateBuiltHtml(html, verifiedAssets, index.protectedRgbaKeys);
  const buf = Buffer.from(html, "utf8");
  return {
    html,
    buf,
    sha256: sha256Hex(buf),
    bytes: buf.length,
    artCount: stats.artCount,
    moduleCount: ESM_MODULE_ORDER.length,
    scriptBytes: stats.scriptBytes
  };
}

function parseCliArgs(argv) {
  let check = false;
  let outPath = null;
  let help = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--check") {
      check = true;
    } else if (arg === "--out") {
      if (i + 1 >= argv.length || !argv[i + 1] || argv[i + 1].startsWith("--")) {
        throw { code: 2, message: "Missing value for --out <path>" };
      }
      outPath = argv[++i];
    } else if (arg.startsWith("--out=")) {
      const val = arg.slice("--out=".length);
      if (!val) throw { code: 2, message: "Empty value for --out=" };
      outPath = val;
    } else if (arg === "--help" || arg === "-h") {
      help = true;
    } else {
      throw { code: 2, message: `Unknown option: ${arg}` };
    }
  }

  if (check && outPath) {
    throw { code: 2, message: "--check and --out cannot be combined" };
  }

  return { check, outPath, help };
}

function findFirstDiffLocation(bufA, bufB) {
  const minLen = Math.min(bufA.length, bufB.length);
  for (let i = 0; i < minLen; i++) {
    if (bufA[i] !== bufB[i]) {
      const prefix = bufA.subarray(0, i).toString("utf8");
      const line = prefix.split("\n").length;
      return { offset: i, line };
    }
  }
  return { offset: minLen, line: bufA.subarray(0, minLen).toString("utf8").split("\n").length };
}

function main() {
  let opts;
  try {
    opts = parseCliArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`[build-playable] ${err.message || err}`);
    process.exit(err.code || 2);
  }

  if (opts.help) {
    console.log("Usage: node scripts/build-playable.mjs [--check | --out <path>]");
    process.exit(0);
  }

  const built = assemblePlayableHtml();
  const targetPath = opts.outPath
    ? path.resolve(process.cwd(), opts.outPath)
    : path.join(REPO_ROOT, DEFAULT_OUT_REL);

  if (opts.check) {
    if (!fs.existsSync(targetPath)) {
      console.error(`[build-playable] --check FAILED: target missing: ${path.relative(REPO_ROOT, targetPath)}`);
      process.exit(1);
    }
    const diskBuf = fs.readFileSync(targetPath);
    if (Buffer.compare(built.buf, diskBuf) !== 0) {
      const diff = findFirstDiffLocation(built.buf, diskBuf);
      console.error(
        `[build-playable] --check FAILED: ${path.relative(REPO_ROOT, targetPath)} is out of sync with src/.\n` +
        `  Built: ${built.bytes} bytes (sha256=${built.sha256})\n` +
        `  Disk:  ${diskBuf.length} bytes (sha256=${sha256Hex(diskBuf)})\n` +
        `  First diff at byte ${diff.offset} (approx line ${diff.line}). Run "npm run build" to update.`
      );
      process.exit(1);
    }
    console.log(
      `build-playable OK (--check): ${path.relative(REPO_ROOT, targetPath)} matches src/ byte-for-byte ` +
      `(${built.bytes} bytes, ${built.artCount} WebP assets, ${built.moduleCount} ESM modules, sha256=${built.sha256.slice(0, 12)}).`
    );
    return;
  }

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, built.buf);
  console.log(
    `build-playable OK: wrote ${path.relative(REPO_ROOT, targetPath)} ` +
    `(${built.bytes} bytes, ${built.artCount} WebP assets, ${built.moduleCount} ESM modules, sha256=${built.sha256.slice(0, 12)}).`
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main();
}
