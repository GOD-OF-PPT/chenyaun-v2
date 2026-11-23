#!/usr/bin/env node
/**
 * Art Provenance & Checksum Manifest Generator / Checker
 *
 * Parses inline `const ART = { ... };` base64 assets and other inline `data:image/`
 * assets in `web/public/playable-v2.html`, reconciles disk source files under
 * `web/public/art/`, and generates deterministic `docs/art-manifest.md`.
 *
 * Usage:
 *   node scripts/art-manifest.mjs          # Regenerate docs/art-manifest.md
 *   node scripts/art-manifest.mjs --check  # Exit 0 if docs/art-manifest.md is up to date, else 1
 *   node scripts/art-manifest.mjs --json   # Print structured JSON summary + records to stdout
 *   node scripts/art-manifest.mjs --html <path> [--check | --json]
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");

const HTML_REL = "web/public/playable-v2.html";
const ART_DIR_REL = "web/public/art";
const MANIFEST_REL = "docs/art-manifest.md";

const DEFAULT_HTML_PATH = path.join(REPO_ROOT, HTML_REL);
const ART_DIR_PATH = path.join(REPO_ROOT, ART_DIR_REL);
const MANIFEST_PATH = path.join(REPO_ROOT, MANIFEST_REL);

const DEFAULT_LEGACY_ORIGIN =
  "Legacy baseline imported in commit 5699ee8 (2026-11-20); original creation tool/author not recorded in repository history.";
const DEFAULT_LEGACY_LICENSE = "Unrecorded — requires repository owner confirmation";

const DEFAULT_FAVICON_ORIGIN = "In-repo inline SVG added in commit 8be43a0 (PR #1)";
const DEFAULT_FAVICON_LICENSE =
  "Repository license (unrecorded — requires repository owner confirmation)";

const IGNORED_OBJECT_PROPS = new Set([
  "hasOwnProperty",
  "toString",
  "valueOf",
  "constructor",
  "propertyIsEnumerable",
  "isPrototypeOf",
  "toLocaleString",
]);

/**
 * Per-asset provenance overrides for future art additions or updates.
 *
 * Whenever a milestone adds or modifies an art asset (per AGENTS.md):
 * 1. Save the source file under `web/public/art/<version>/`.
 * 2. Add an entry here keyed by the `ART` key (or `favicon_svg` / `other:<sha256-12>`)
 *    with explicit `{ origin, license, notes? }`.
 * 3. Re-run `npm run art:manifest` and verify with `npm run art:manifest:check`.
 *
 * @type {Record<string, { origin?: string, license?: string, notes?: string }>}
 */
const PROVENANCE_OVERRIDES = {};

function sha256Hex(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function formatNumber(n) {
  return n.toLocaleString("en-US");
}

function escapeMdCell(str) {
  return String(str).replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

function walkFilesSorted(rootDir, baseDir = rootDir) {
  if (!fs.existsSync(rootDir)) return [];
  const results = [];
  const entries = fs.readdirSync(rootDir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkFilesSorted(fullPath, baseDir));
    } else if (entry.isFile()) {
      const relPosix = path.relative(baseDir, fullPath).split(path.sep).join("/");
      results.push({ fullPath, relPosix });
    }
  }
  results.sort((a, b) => (a.relPosix < b.relPosix ? -1 : a.relPosix > b.relPosix ? 1 : 0));
  return results;
}

function parseArtBlock(lines, htmlLabel) {
  let artStartIdx = -1;
  let artEndIdx = -1;

  for (let i = 0; i < lines.length; i++) {
    if (artStartIdx === -1) {
      if (/^const ART = \{\s*$/.test(lines[i])) {
        artStartIdx = i;
      }
    } else if (/^\};\s*$/.test(lines[i])) {
      artEndIdx = i;
      break;
    }
  }

  if (artStartIdx === -1 || artEndIdx === -1) {
    throw new Error(`Could not locate 'const ART = {' ... '};' block in ${htmlLabel}`);
  }

  const entryRe = /^\s*"([^"]+)":\s*"(data:image\/([a-zA-Z0-9+.-]+);base64,([A-Za-z0-9+/=]+))",?\s*$/;
  const seenKeys = new Set();
  const inlineAssets = [];

  for (let i = artStartIdx + 1; i < artEndIdx; i++) {
    const lineNum = i + 1;
    const rawLine = lines[i];
    if (rawLine.trim() === "") continue;

    const match = rawLine.match(entryRe);
    if (!match) {
      throw new Error(`Malformed ART entry at ${htmlLabel}:${lineNum}`);
    }

    const [, key, , subtype, b64] = match;
    if (seenKeys.has(key)) {
      throw new Error(`Duplicate ART key "${key}" at ${htmlLabel}:${lineNum}`);
    }
    if (b64.length === 0 || b64.length % 4 !== 0) {
      throw new Error(`Invalid base64 length for ART key "${key}" at ${htmlLabel}:${lineNum}`);
    }

    const decoded = Buffer.from(b64, "base64");
    if (decoded.length === 0) {
      throw new Error(`Empty decoded payload for ART key "${key}" at ${htmlLabel}:${lineNum}`);
    }

    seenKeys.add(key);
    const override = PROVENANCE_OVERRIDES[key] || {};
    inlineAssets.push({
      index: inlineAssets.length + 1,
      key,
      defLine: lineNum,
      mime: `image/${subtype}`,
      bytes: decoded.length,
      sha256: sha256Hex(decoded),
      origin: override.origin || DEFAULT_LEGACY_ORIGIN,
      license: override.license || DEFAULT_LEGACY_LICENSE,
      notes: override.notes || "",
    });
  }

  return {
    artStartLine: artStartIdx + 1,
    artEndLine: artEndIdx + 1,
    inlineAssets,
  };
}

function stripLineCommentForScan(line) {
  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;
  let escaped = false;
  for (let i = 0; i < line.length - 1; i++) {
    const ch = line[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\" && (inSingle || inDouble || inTemplate)) {
      escaped = true;
      continue;
    }
    if (!inDouble && !inTemplate && ch === "'") {
      inSingle = !inSingle;
      continue;
    }
    if (!inSingle && !inTemplate && ch === '"') {
      inDouble = !inDouble;
      continue;
    }
    if (!inSingle && !inDouble && ch === "`") {
      inTemplate = !inTemplate;
      continue;
    }
    if (!inSingle && !inDouble && !inTemplate && ch === "/" && line[i + 1] === "/") {
      return line.slice(0, i);
    }
  }
  return line;
}

function scanOutsideArtBlock(lines, artStartLine, artEndLine, inlineAssets) {
  const keySet = new Set(inlineAssets.map((a) => a.key));
  const usageLinesByKey = new Map();
  const usageSymbolsByKey = new Map();
  for (const a of inlineAssets) {
    usageLinesByKey.set(a.key, new Set());
    usageSymbolsByKey.set(a.key, new Set());
  }

  let preloadLine = null;
  let preloadSymbol = "preloadSprites";
  const otherInlineAssets = [];
  const missingReferences = [];

  const dotAccessRe = /\b(ART|IMG_CACHE)\.([A-Za-z0-9_]+)\b/g;
  const quotedLiteralRe = /(?:"([A-Za-z0-9_-]+)"|'([A-Za-z0-9_-]+)'|`([A-Za-z0-9_-]+)`)/g;
  const dataImageRe =
    /"data:image\/([a-zA-Z0-9+.-]+)(;base64)?,([^"]+)"|'data:image\/([a-zA-Z0-9+.-]+)(;base64)?,([^']+)'/g;

  let inScript = false;
  let inBlockComment = false;
  let currentSymbol = "HTML/head";

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const line = lines[i];

    if (line.includes("<script>")) {
      inScript = true;
      currentSymbol = "script:top-level";
    } else if (line.includes("</script>")) {
      inScript = false;
      currentSymbol = "HTML";
    }

    if (lineNum >= artStartLine && lineNum <= artEndLine) continue;

    if (inScript) {
      const fnMatch = line.match(/^(?:  )?(?:async\s+)?function\s+([A-Za-z0-9_$]+)\s*\(/);
      const declMatch = line.match(/^(?:  )?(const|let|var)\s+([A-Za-z0-9_$]+)\s*=/);
      if (fnMatch) {
        currentSymbol = `function ${fnMatch[1]}`;
      } else if (declMatch) {
        currentSymbol = `${declMatch[1]} ${declMatch[2]}`;
      }
    }

    if (preloadLine === null && line.includes("Object.entries(ART)")) {
      preloadLine = lineNum;
      preloadSymbol = currentSymbol.replace(/^function\s+/, "") || "preloadSprites";
    }

    if (line.includes("data:image/")) {
      dataImageRe.lastIndex = 0;
      let dm;
      while ((dm = dataImageRe.exec(line)) !== null) {
        const subtype = dm[1] || dm[4];
        const isBase64 = dm[2] || dm[5];
        const payload = dm[3] || dm[6];
        let decodedBuf;
        if (isBase64) {
          decodedBuf = Buffer.from(payload, "base64");
        } else {
          try {
            decodedBuf = Buffer.from(decodeURIComponent(payload), "utf8");
          } catch {
            decodedBuf = Buffer.from(payload, "utf8");
          }
        }
        const sha256 = sha256Hex(decodedBuf);
        const isSvgFavicon = subtype === "svg+xml" && line.includes('rel="icon"');
        const stableKey = isSvgFavicon ? "favicon_svg" : `other:${sha256.slice(0, 12)}`;
        const override = PROVENANCE_OVERRIDES[stableKey] || {};
        otherInlineAssets.push({
          key: stableKey,
          line: lineNum,
          mime: `image/${subtype}`,
          encoding: isBase64 ? "base64" : "url-encoded",
          bytes: decodedBuf.length,
          sha256,
          context: isSvgFavicon ? 'HTML `<link rel="icon">` inline SVG favicon' : "Inline data URI",
          origin:
            override.origin ||
            (isSvgFavicon ? DEFAULT_FAVICON_ORIGIN : DEFAULT_LEGACY_ORIGIN),
          license:
            override.license ||
            (isSvgFavicon ? DEFAULT_FAVICON_LICENSE : DEFAULT_LEGACY_LICENSE),
        });
      }
    }

    if (inScript) {
      let codeLine = line;
      if (inBlockComment) {
        const endIdx = codeLine.indexOf("*/");
        if (endIdx === -1) continue;
        codeLine = codeLine.slice(endIdx + 2);
        inBlockComment = false;
      }
      const trimmed = codeLine.trimStart();
      if (trimmed.startsWith("//")) continue;
      if (trimmed.startsWith("/*")) {
        const endIdx = codeLine.indexOf("*/", codeLine.indexOf("/*") + 2);
        if (endIdx === -1) {
          inBlockComment = true;
          continue;
        }
        codeLine = codeLine.slice(0, codeLine.indexOf("/*")) + codeLine.slice(endIdx + 2);
      }
      codeLine = stripLineCommentForScan(codeLine);

      dotAccessRe.lastIndex = 0;
      let m;
      while ((m = dotAccessRe.exec(codeLine)) !== null) {
        const container = m[1];
        const key = m[2];
        if (keySet.has(key)) {
          usageLinesByKey.get(key).add(lineNum);
          usageSymbolsByKey.get(key).add(currentSymbol);
        } else if (!IGNORED_OBJECT_PROPS.has(key)) {
          missingReferences.push({
            container,
            key,
            line: lineNum,
            symbol: currentSymbol,
          });
        }
      }

      quotedLiteralRe.lastIndex = 0;
      while ((m = quotedLiteralRe.exec(codeLine)) !== null) {
        const token = m[1] || m[2] || m[3];
        if (token && keySet.has(token)) {
          usageLinesByKey.get(token).add(lineNum);
          usageSymbolsByKey.get(token).add(currentSymbol);
        }
      }
    }
  }

  for (const asset of inlineAssets) {
    const sortedLines = Array.from(usageLinesByKey.get(asset.key)).sort((a, b) => a - b);
    const sortedSymbols = Array.from(usageSymbolsByKey.get(asset.key)).sort((a, b) =>
      a < b ? -1 : a > b ? 1 : 0
    );
    asset.usageLines = sortedLines;
    asset.usageSymbols = sortedSymbols;
    asset.preloadOnly = sortedSymbols.length === 0;
    asset.usageDisplay =
      sortedSymbols.length > 0
        ? sortedSymbols.map((sym) => `\`${sym}\``).join(", ")
        : `preload-only (\`${preloadSymbol}\`)`;
  }

  return { preloadLine, preloadSymbol, otherInlineAssets, missingReferences };
}

function reconcileDiskFiles(inlineAssets) {
  const inlineByKey = new Map(inlineAssets.map((a) => [a.key, a]));
  const diskEntries = walkFilesSorted(ART_DIR_PATH, ART_DIR_PATH);
  const diskFiles = [];
  const diskByKey = new Map();

  for (const { fullPath, relPosix } of diskEntries) {
    const buf = fs.readFileSync(fullPath);
    const bytes = buf.length;
    const sha256 = sha256Hex(buf);
    const ext = path.extname(relPosix);
    const stem = path.basename(relPosix, ext);
    const mappedKey = stem.replace(/-/g, "_");
    const repoRelPath = `${ART_DIR_REL}/${relPosix}`;

    const inline = inlineByKey.get(mappedKey) || null;
    let status = "UNMAPPED";
    if (inline) {
      status = inline.sha256 === sha256 ? "MATCH" : "DIFFERS";
    }

    const record = {
      file: repoRelPath,
      relInArt: relPosix,
      mappedKey,
      status,
      renamedHyphen: stem.includes("-"),
      diskBytes: bytes,
      inlineBytes: inline ? inline.bytes : null,
      inlineLine: inline ? inline.defLine : null,
      diskSha256: sha256,
      inlineSha256: inline ? inline.sha256 : null,
      origin: (PROVENANCE_OVERRIDES[mappedKey] || {}).origin || DEFAULT_LEGACY_ORIGIN,
      license: (PROVENANCE_OVERRIDES[mappedKey] || {}).license || DEFAULT_LEGACY_LICENSE,
    };

    diskFiles.push(record);
    if (inline) {
      diskByKey.set(mappedKey, record);
    }
  }

  for (const asset of inlineAssets) {
    const disk = diskByKey.get(asset.key) || null;
    if (!disk) {
      asset.diskSource = "inline-only (none on disk)";
      asset.diskStatus = "INLINE_ONLY";
    } else if (disk.status === "MATCH") {
      asset.diskSource = `\`${disk.file}\` (MATCH)`;
      asset.diskStatus = "MATCH";
    } else {
      asset.diskSource = `\`${disk.file}\` (DIFFERS)`;
      asset.diskStatus = "DIFFERS";
    }
  }

  return diskFiles;
}

function buildManifestData(htmlPath = DEFAULT_HTML_PATH) {
  const htmlLabel = path.relative(REPO_ROOT, htmlPath).startsWith("..")
    ? htmlPath
    : path.relative(REPO_ROOT, htmlPath).split(path.sep).join("/");
  const htmlContent = fs.readFileSync(htmlPath, "utf8");
  const lines = htmlContent.split(/\r?\n/);

  const { artStartLine, artEndLine, inlineAssets } = parseArtBlock(lines, htmlLabel);
  const { preloadLine, preloadSymbol, otherInlineAssets, missingReferences } = scanOutsideArtBlock(
    lines,
    artStartLine,
    artEndLine,
    inlineAssets
  );
  if (missingReferences.length > 0) {
    const details = missingReferences
      .map((r) => `  - ${r.container}.${r.key} at ${htmlLabel}:${r.line} (in ${r.symbol})`)
      .join("\n");
    throw new Error(
      `Found ${missingReferences.length} undefined ART/IMG_CACHE key reference(s) in ${htmlLabel}:\n${details}`
    );
  }
  const diskFiles = reconcileDiskFiles(inlineAssets);

  const totalInlineBytes = inlineAssets.reduce((sum, a) => sum + a.bytes, 0);
  const totalDiskBytes = diskFiles.reduce((sum, d) => sum + d.diskBytes, 0);
  const activeUsedCount = inlineAssets.filter((a) => !a.preloadOnly).length;
  const preloadOnlyCount = inlineAssets.filter((a) => a.preloadOnly).length;
  const diskMatchCount = diskFiles.filter((d) => d.status === "MATCH").length;
  const diskDiffCount = diskFiles.filter((d) => d.status === "DIFFERS").length;
  const diskUnmappedCount = diskFiles.filter((d) => d.status === "UNMAPPED").length;
  const inlineOnlyCount = inlineAssets.filter((a) => a.diskStatus === "INLINE_ONLY").length;

  return {
    sourceHtml: HTML_REL,
    artDir: ART_DIR_REL,
    artBlockLines: { start: artStartLine, end: artEndLine },
    preloadLine,
    preloadSymbol,
    summary: {
      inlineCount: inlineAssets.length,
      totalInlineBytes,
      activeUsedCount,
      preloadOnlyCount,
      diskCount: diskFiles.length,
      totalDiskBytes,
      diskMatchCount,
      diskDiffCount,
      diskUnmappedCount,
      inlineOnlyCount,
      otherInlineCount: otherInlineAssets.length,
    },
    diskFiles,
    inlineAssets,
    otherInlineAssets,
  };
}

function renderMarkdown(data) {
  const { summary, diskFiles, inlineAssets, otherInlineAssets, preloadSymbol } = data;
  const differingFiles = diskFiles.filter((d) => d.status === "DIFFERS");
  const preloadOnlyKeys = inlineAssets.filter((a) => a.preloadOnly).map((a) => `\`${a.key}\``);

  const out = [];
  out.push("# Art Provenance & Checksum Manifest");
  out.push("");
  out.push(
    "> **Auto-generated file.** Do not edit manually. Regenerate with `npm run art:manifest` (`node scripts/art-manifest.mjs`) and verify with `npm run art:manifest:check` (`node scripts/art-manifest.mjs --check`)."
  );
  out.push("");

  out.push("## Summary");
  out.push("");
  out.push(
    `- **Inline \`const ART\` assets (\`${HTML_REL}\`)**: **${summary.inlineCount}** entries (all \`image/webp\`, **${formatNumber(summary.totalInlineBytes)}** decoded bytes total; **${summary.activeUsedCount}** actively referenced in code/tables, **${summary.preloadOnlyCount}** preload-only via \`Object.entries(ART)\` in \`${preloadSymbol}()\`).`
  );
  out.push(
    `- **Disk source files (\`${ART_DIR_REL}/\`)**: **${summary.diskCount}** files (**${formatNumber(summary.totalDiskBytes)}** bytes total) — **${summary.diskMatchCount}** byte-identical \`MATCH\`, **${summary.diskDiffCount}** \`DIFFERS\`, **${summary.diskUnmappedCount}** \`UNMAPPED\`; **${summary.inlineOnlyCount}** inline assets have no disk source file currently in \`${ART_DIR_REL}/\`.`
  );
  out.push(
    `- **Other inline \`data:image/\` assets**: **${summary.otherInlineCount}** (inline SVG favicon).`
  );
  out.push("");

  out.push("## Provenance & License Policy");
  out.push("");
  out.push(
    "- **Legacy baseline (`5699ee8`, 2026-11-20)**: All 115 inline `data:image/webp;base64` entries in `web/public/playable-v2.html` and the 11 files under `web/public/art/v4/` were imported together in commit `5699ee8` (\"Import optimized Chenyuan Wendao V2 project\"). Repository history and `docs/v2-overhaul-notes.md` do not record an external author, creation tool, or license for these legacy assets; therefore their license status is explicitly recorded as **Unrecorded — requires repository owner confirmation** rather than fabricated."
  );
  out.push(
    "- **Legacy directory cleanup (`83c1541`, 2026-11-21)**: Commit `83c1541` (\"Keep only the standalone 2.5D action game\") removed 97 legacy source files under `web/public/art/{portraits,scenes,v2}`, leaving only `web/public/art/v4/` (11 files)."
  );
  out.push(
    "- **Inline SVG favicon (`8be43a0`, PR #1)**: The `<link rel=\"icon\" type=\"image/svg+xml\">` favicon was added directly in-repo in commit `8be43a0`."
  );
  out.push(
    "- **Future Art Additions Rule (per `AGENTS.md`)**: Any newly added or modified art asset must (1) store its production/source file under `web/public/art/<version>/`, (2) register its explicit source, license, and notes in `PROVENANCE_OVERRIDES` inside `scripts/art-manifest.mjs`, and (3) regenerate and verify this manifest via `npm run art:manifest && npm run art:manifest:check`."
  );
  out.push("");

  out.push("## Disk Source File Reconciliation (`web/public/art/`)");
  out.push("");
  out.push(
    "Filename stems are mapped to `const ART` keys via `basename(file, ext).replace(/-/g, \"_\")`. All 11 files currently reside in `web/public/art/v4/`."
  );
  out.push("");
  if (differingFiles.length > 0) {
    out.push(
      `> **Checksum divergence notice (${differingFiles.length} files differ from inline base64):** ${differingFiles.map((d) => `\`${d.mappedKey}\` (\`${d.file}\`)`).join(", ")}. The disk files in \`web/public/art/v4/\` have smaller byte sizes and different SHA-256 digests than the corresponding inline base64 payloads embedded in \`${HTML_REL}\`.`
    );
    out.push("");
  }

  out.push(
    "| Disk File | Mapped `ART` Key | Status | Disk Bytes | Inline Bytes | Disk SHA-256 | Inline SHA-256 |"
  );
  out.push("|---|---|---|---:|---:|---|---|");
  for (const d of diskFiles) {
    const statusLabel =
      d.status === "MATCH" && d.renamedHyphen ? "MATCH (`-` → `_`)" : d.status;
    out.push(
      `| \`${escapeMdCell(d.file)}\` | \`${escapeMdCell(d.mappedKey)}\` | ${statusLabel} | ${formatNumber(d.diskBytes)} | ${d.inlineBytes !== null ? formatNumber(d.inlineBytes) : "—"} | \`${d.diskSha256}\` | ${d.inlineSha256 ? `\`${d.inlineSha256}\`` : "—"} |`
    );
  }
  out.push("");

  out.push(`## Inline \`ART\` Assets (${summary.inlineCount} entries)`);
  out.push("");
  if (preloadOnlyKeys.length > 0) {
    out.push(
      `> **Preload-only assets (${preloadOnlyKeys.length} keys):** ${preloadOnlyKeys.join(", ")} are bulk-preloaded via \`Object.entries(ART)\` in \`${preloadSymbol}()\` and have no other direct or string-literal references in \`${HTML_REL}\`.`
    );
    out.push("");
  }
  out.push(
    "| # | `ART` Key | MIME | Bytes | SHA-256 | Disk Source | Origin | License | Usage Contexts (`web/public/playable-v2.html`) |"
  );
  out.push("|---:|---|---|---:|---|---|---|---|---|");
  for (const a of inlineAssets) {
    out.push(
      `| ${a.index} | \`${escapeMdCell(a.key)}\` | \`${escapeMdCell(a.mime)}\` | ${formatNumber(a.bytes)} | \`${a.sha256}\` | ${a.diskSource} | ${escapeMdCell(a.origin)} | ${escapeMdCell(a.license)} | ${escapeMdCell(a.usageDisplay)} |`
    );
  }
  out.push("");

  out.push("## Other Inline Assets");
  out.push("");
  out.push("| Asset Key | Context | MIME | Encoding | Bytes | SHA-256 | Origin | License |");
  out.push("|---|---|---|---|---:|---|---|---|");
  for (const o of otherInlineAssets) {
    out.push(
      `| \`${escapeMdCell(o.key)}\` | ${escapeMdCell(o.context)} | \`${escapeMdCell(o.mime)}\` | ${o.encoding} | ${formatNumber(o.bytes)} | \`${o.sha256}\` | ${escapeMdCell(o.origin)} | ${escapeMdCell(o.license)} |`
    );
  }
  out.push("");

  return out.join("\n");
}

function parseManifestInlineTable(markdown) {
  const map = new Map();
  const lines = markdown.split(/\r?\n/);
  let inInlineSection = false;
  for (const line of lines) {
    if (line.startsWith("## Inline `ART` Assets")) {
      inInlineSection = true;
      continue;
    }
    if (inInlineSection && line.startsWith("## ")) break;
    if (!inInlineSection || !line.startsWith("|")) continue;
    if (line.startsWith("| # |") || line.startsWith("|---")) continue;
    const cells = line.split("|").slice(1, -1).map((c) => c.trim());
    if (cells.length < 9) continue;
    const key = cells[1].replace(/^`|`$/g, "");
    const shaCell = cells.find((c) => /^`[0-9a-f]{64}`$/.test(c)) || "";
    const sha256 = shaCell.replace(/^`|`$/g, "");
    const usage = cells[cells.length - 1];
    map.set(key, { sha256, usage });
  }
  return map;
}

function parseManifestDiskTable(markdown) {
  const map = new Map();
  const lines = markdown.split(/\r?\n/);
  let inDiskSection = false;
  for (const line of lines) {
    if (line.startsWith("## Disk Source File Reconciliation")) {
      inDiskSection = true;
      continue;
    }
    if (inDiskSection && line.startsWith("## ")) break;
    if (!inDiskSection || !line.startsWith("|")) continue;
    if (line.startsWith("| Disk File |") || line.startsWith("|---")) continue;
    const cells = line.split("|").slice(1, -1).map((c) => c.trim());
    if (cells.length < 7) continue;
    const file = cells[0].replace(/^`|`$/g, "");
    const hashes = cells.filter((c) => /^`[0-9a-f]{64}`$/.test(c)).map((c) => c.replace(/^`|`$/g, ""));
    map.set(file, {
      diskSha256: hashes[0] || "",
      inlineSha256: hashes[1] || "",
    });
  }
  return map;
}

function diagnoseCheckMismatch(existingMd, generatedMd, data) {
  const diagnostics = [];
  const oldInline = parseManifestInlineTable(existingMd);
  const newInline = new Map(
    data.inlineAssets.map((a) => [a.key, { sha256: a.sha256, usage: a.usageDisplay }])
  );

  const addedKeys = [...newInline.keys()].filter((k) => !oldInline.has(k));
  const removedKeys = [...oldInline.keys()].filter((k) => !newInline.has(k));
  const changedHashes = [];
  const changedUsages = [];

  for (const [key, next] of newInline.entries()) {
    const prev = oldInline.get(key);
    if (!prev) continue;
    if (prev.sha256 !== next.sha256) {
      changedHashes.push(`${key} (${prev.sha256.slice(0, 12)} -> ${next.sha256.slice(0, 12)})`);
    } else if (prev.usage !== next.usage) {
      changedUsages.push(`${key}: ${prev.usage} -> ${next.usage}`);
    }
  }

  const oldDisk = parseManifestDiskTable(existingMd);
  const newDisk = new Map(
    data.diskFiles.map((d) => [d.file, { diskSha256: d.diskSha256, inlineSha256: d.inlineSha256 || "" }])
  );
  const diskDiffs = [];
  for (const file of new Set([...oldDisk.keys(), ...newDisk.keys()])) {
    const prev = oldDisk.get(file);
    const next = newDisk.get(file);
    if (!prev) diskDiffs.push(`added disk file: ${file}`);
    else if (!next) diskDiffs.push(`removed disk file: ${file}`);
    else if (prev.diskSha256 !== next.diskSha256 || prev.inlineSha256 !== next.inlineSha256) {
      diskDiffs.push(`changed disk reconciliation: ${file}`);
    }
  }

  if (addedKeys.length) diagnostics.push(`Added ART keys (${addedKeys.length}): ${addedKeys.join(", ")}`);
  if (removedKeys.length) diagnostics.push(`Removed ART keys (${removedKeys.length}): ${removedKeys.join(", ")}`);
  if (changedHashes.length) {
    diagnostics.push(`Changed SHA-256 digests (${changedHashes.length}): ${changedHashes.join(", ")}`);
  }
  if (changedUsages.length) {
    const sample = changedUsages.slice(0, 10).join("; ");
    const extra = changedUsages.length > 10 ? ` (+${changedUsages.length - 10} more)` : "";
    diagnostics.push(`Changed usage contexts (${changedUsages.length}): ${sample}${extra}`);
  }
  if (diskDiffs.length) {
    diagnostics.push(`Disk file differences (${diskDiffs.length}): ${diskDiffs.join("; ")}`);
  }
  if (diagnostics.length === 0 && existingMd !== generatedMd) {
    diagnostics.push("Manifest header, summary, or table format differs from generated output.");
  }
  return diagnostics;
}

function main() {
  const args = process.argv.slice(2);
  let checkMode = false;
  let jsonMode = false;
  let htmlPath = DEFAULT_HTML_PATH;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--check") {
      checkMode = true;
    } else if (arg === "--json") {
      jsonMode = true;
    } else if (arg === "--html") {
      const next = args[++i];
      if (!next) {
        console.error("Missing value for --html");
        process.exit(1);
      }
      htmlPath = path.resolve(next);
    } else {
      console.error(`Unknown argument: ${arg}`);
      console.error("Usage: node scripts/art-manifest.mjs [--check | --json] [--html <path>]");
      process.exit(1);
    }
  }

  if (checkMode && jsonMode) {
    console.error("Cannot combine --check and --json.");
    process.exit(1);
  }

  const data = buildManifestData(htmlPath);

  if (jsonMode) {
    process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
    return;
  }

  const generated = renderMarkdown(data);

  if (checkMode) {
    if (!fs.existsSync(MANIFEST_PATH)) {
      console.error(`${MANIFEST_REL} is missing. Run: npm run art:manifest`);
      process.exit(1);
    }
    const existing = fs.readFileSync(MANIFEST_PATH, "utf8");
    if (existing !== generated) {
      console.error(`${MANIFEST_REL} is out of date. Run: npm run art:manifest`);
      for (const line of diagnoseCheckMismatch(existing, generated, data)) {
        console.error(`  - ${line}`);
      }
      process.exit(1);
    }
    console.log(
      `art-manifest OK: ${MANIFEST_REL} is up to date (${data.summary.inlineCount} inline assets, ${data.summary.diskCount} disk files, ${data.summary.otherInlineCount} other inline asset).`
    );
    return;
  }

  fs.mkdirSync(path.dirname(MANIFEST_PATH), { recursive: true });
  fs.writeFileSync(MANIFEST_PATH, generated, "utf8");
  console.log(
    `Generated ${MANIFEST_REL}: ${data.summary.inlineCount} inline assets (${data.summary.activeUsedCount} active, ${data.summary.preloadOnlyCount} preload-only), ${data.summary.diskCount} disk files (${data.summary.diskMatchCount} match, ${data.summary.diskDiffCount} differ, ${data.summary.diskUnmappedCount} unmapped), ${data.summary.otherInlineCount} other inline asset.`
  );
}

main();
