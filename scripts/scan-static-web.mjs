#!/usr/bin/env node
// Static inspection only: this module parses source and never executes package HTML/JS.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parse } from "acorn";

export const EXCLUDED = new Set(["node_modules", ".git", ".svn", ".hg", "dist", "build", ".cache", ".turbo", ".next", "coverage", "Library", "Temp", "Logs"]);
const VITE = /^vite\.config\.(?:ts|js|mts|mjs)$/i;
const sanitizers = /^(?:DOMPurify\.sanitize|sanitizeHtml|filterXSS)\s*\(/;
const rank = { High: 0, Medium: 1, Review: 2 };

function walk(node, visit) {
  if (!node || typeof node !== "object") return;
  if (typeof node.type === "string") visit(node);
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach(child => walk(child, visit));
    else if (value && typeof value === "object") walk(value, visit);
  }
}

function literal(node) {
  if (node?.type === "Literal" && typeof node.value === "string") return node.value;
  if (node?.type === "TemplateLiteral" && node.expressions.length === 0) return node.quasis[0].value.cooked;
  if (node?.type === "BinaryExpression" && node.operator === "+") {
    const a = literal(node.left), b = literal(node.right);
    return a !== null && b !== null ? a + b : null;
  }
  return null;
}

const absolute = value => !/^\/\/[^/]/.test(value.trim()) && /^(?:[\\/]|[a-z]:[\\/]|file:\/\/\/)/i.test(value.trim());
const dangerous = /<(?:script|iframe|frame|object|embed)\b|\bon\w+\s*=|javascript\s*:|<meta\b[^>]*http-equiv\s*=\s*["']?refresh/i;
const activeData = value => /^data:/i.test(value.trim());
const executableData = value => /^data:(?:text\/html|image\/svg\+xml|(?:application|text)\/(?:javascript|ecmascript))/i.test(value.trim());

function unsafeScriptURL(raw) {
  if (!/^(?:https?:\/\/|\/\/)/i.test(raw)) return null;
  try {
    const u = new URL(raw.startsWith("//") ? `http:${raw}` : raw);
    const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
    if (!host || u.username || u.password || u.protocol !== "https:") return "外部脚本 URL 无效、含凭据或未使用 HTTPS";
    if (/^(?:localhost|.*\.localhost|.*\.local)$/.test(host)) return "外部脚本指向本地网络名称";
    if (host.includes(":")) {
      // IPv4-mapped IPv6 and IPv6 special-use/ULA addresses are not public script hosts.
      if (host === "::" || /^(?:0*:)*[01]$|^f[cd]|^fe[89ab]|^ff|^::ffff:/i.test(host)) return "外部脚本指向本地或特殊用途 IPv6 地址";
    } else if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
      const [a, b] = host.split(".").map(Number);
      if (a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224) return "外部脚本指向本地或特殊用途 IPv4 地址";
    }
  } catch { return "外部脚本 URL 无法解析"; }
  return null;
}

export function scanStaticWeb(directory) {
  const root = path.resolve(directory);
  const findings = [], files = [], dirs = [], unreadable = [];
  let htmlCount = 0, configCount = 0, sinkCount = 0, sanitizedSinkCount = 0;
  const add = (file, line, rule, risk, evidence, reason, fix) => findings.push({ file, line, rule, risk, evidence: evidence.replace(/\s+/g, " ").slice(0, 240), reason, fix });
  function enumerate(folder) {
    let entries;
    try { entries = fs.readdirSync(folder, { withFileTypes: true }); }
    catch (e) { unreadable.push(path.relative(root, folder) || "."); add(path.relative(root, folder) || ".", null, "文件不可读", "Review", e.message, "无法完整扫描目录", "恢复读取权限后重扫"); return; }
    for (const entry of entries) {
      if (entry.isDirectory() && EXCLUDED.has(entry.name)) continue;
      const full = path.join(folder, entry.name), rel = path.relative(root, full).split(path.sep).join("/");
      if (/[\u4e00-\u9fff]/.test(entry.name)) add(rel, null, "路径包含中文", "Medium", rel, "下游静态托管和 URL 编码兼容性风险", "重命名为 ASCII 并同步引用");
      if (entry.isSymbolicLink()) { add(rel, null, "符号链接需复核", "Review", rel, "符号链接可能指向交付目录外", "交付普通文件并校验真实路径"); continue; }
      if (entry.isDirectory()) { dirs.push(rel); enumerate(full); }
      else if (entry.isFile()) files.push(rel);
    }
  }
  enumerate(root);
  for (const file of files) {
    const name = path.basename(file);
    if (/\.(?:php|jsp|aspx|cshtml|ejs|pug|erb)$/i.test(name) || /^(?:server\.[cm]?js|app\.py|main\.go)$/i.test(name)) {
      add(file, null, "非静态 Web 交付", "High", file, "存在包内后端或服务端模板候选", "从静态交付物移除后端，或预先生成纯静态内容");
    }
    const isHtml = /\.html?$/i.test(name), isVite = VITE.test(name);
    if (!isHtml && !isVite) continue;
    let text;
    try { text = new TextDecoder("utf-8", { fatal: true }).decode(fs.readFileSync(path.join(root, file))); }
    catch (e) { unreadable.push(file); add(file, null, "文件不可读", "Review", e.message, "无法以 UTF-8 读取文件", "修复编码或读取权限后重扫"); continue; }
    const newlines = [-1];
    for (let i = 0; i < text.length; i++) if (text[i] === "\n") newlines.push(i);
    const lineAt = offset => { let lo = 0, hi = newlines.length; while (lo + 1 < hi) { const mid = (lo + hi) >> 1; if (newlines[mid] < offset) lo = mid; else hi = mid; } return lo + 1; };
    const hit = (offset, rule, risk, evidence, reason, fix) => add(file, lineAt(offset), rule, risk, evidence, reason, fix);
    if (isVite) {
      configCount++;
      for (const m of text.matchAll(/\b["']?base["']?\s*:\s*(["'`])([^"'`]*?)\1/gi)) if (absolute(m[2])) hit(m.index, "Vite 固定基路径", "High", m[0], "静态 ZIP 不能部署到任意子目录", '改为 base: "./" 并重新构建');
      continue;
    }
    htmlCount++;
    for (const m of text.matchAll(/<(?:iframe|frame|object|embed)\b/gi)) hit(m.index, "危险嵌入标签", "High", m[0], "引入额外浏览器执行上下文", "移除嵌入内容或改为普通链接");
    for (const m of text.matchAll(/<meta\b[^>]*\bhttp-equiv\s*=\s*(?:"refresh"|'refresh'|refresh(?=[\s/>]))[^>]*>/gi)) hit(m.index, "Meta Refresh 跳转", "High", m[0], "页面加载时强制导航", "直接提供入口内容或使用玩家主动点击的相对链接");
    for (const m of text.matchAll(/\beval\s*\(|document\s*\.\s*(?:write\s*\(|writeln\s*\(|cookie\b)/gi)) hit(m.index, "高风险 JavaScript API", "Medium", m[0], "可能执行字符串或读写敏感浏览器状态，需结合数据来源复核", "改用 DOM API、JSON.parse 或不依赖 Cookie 的逻辑");
    for (const m of text.matchAll(/(?<![\w:-])(src|href|action|poster|data)\s*=\s*(["'])([\s\S]*?)\2/gi)) {
      const attr = m[1].toLowerCase(), value = m[3];
      if (absolute(value)) hit(m.index, "绝对路径或固定路径引用", "High", m[0], "依赖站点根路径或本机路径，破坏静态包可移植性", "改为包内相对路径");
      if (["href", "src", "action", "data"].includes(attr) && /^javascript\s*:/i.test(value.trim())) hit(m.index, "JavaScript 协议引用", "High", m[0], "属性可能触发脚本执行", "改为按钮事件或安全的相对地址");
      if (["src", "action"].includes(attr) && activeData(value)) hit(m.index, "活跃源属性 Data URI", attr === "action" || executableData(value) ? "High" : "Medium", m[0], "活跃上下文中嵌入 Data URI", "改为经过验证的包内静态资源");
    }
    for (const m of text.matchAll(/(?<![\w])url\(\s*(["']?)([^\n)]*?)\1\s*\)/gi)) if (absolute(m[2])) hit(m.index, "静态资源路径可移植性", "High", m[0], "CSS 资源依赖固定根目录或本机路径", "改为包内相对资源路径");
    for (const m of text.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
      const src = /(?<![\w:-])src\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(m[1]);
      if (src) {
        const reason = unsafeScriptURL(src[1] ?? src[2] ?? src[3]);
        if (reason) hit(m.index, "不安全外部脚本来源", "High", src[0], reason, "使用可信的包内脚本或 HTTPS 公网来源");
        continue;
      }
      if (/\btype\s*=\s*(["'])(?:application\/ld\+json|application\/json|importmap)\1/i.test(m[1])) continue;
      const code = m[2], base = m.index + m[0].indexOf(">") + 1;
      let tree;
      try { tree = parse(code, { ecmaVersion: "latest", sourceType: /\bmodule\b/i.test(m[1]) ? "module" : "script" }); }
      catch (e) { hit(base + (e.pos || 0), "内联脚本解析失败", "Review", e.message, "无法完整复核 HTML 写入表达式", "修复语法或人工复核全部内联脚本"); continue; }
      walk(tree, node => {
        if (node.type === "AssignmentExpression" && node.left.type === "MemberExpression") {
          const property = node.left.computed ? node.left.property.value : node.left.property.name;
          if (["src", "href", "action", "poster"].includes(property)) {
            const value = literal(node.right);
            if (value !== null && absolute(value)) hit(base + node.start, "绝对路径或固定路径引用", "High", code.slice(node.start, node.end), "脚本资源引用依赖固定路径", "改为包内相对路径");
          }
          if (!["innerHTML", "outerHTML"].includes(property)) return;
          sinkCount++;
          const expression = code.slice(node.right.start, node.right.end);
          if (sanitizers.test(expression)) { sanitizedSinkCount++; return; }
          const value = literal(node.right);
          if (value === null || node.operator !== "=") hit(base + node.start, "动态 HTML 写入", "High", code.slice(node.start, node.end), "动态数据进入 HTML 解析器；本规则不等同于已证实可利用的 XSS", "使用 textContent/DOM 构造，或在写入处调用 DOMPurify.sanitize");
          else if (dangerous.test(value)) hit(base + node.start, "危险静态 HTML 写入", "High", expression, "静态 HTML 包含可执行内容", "移除危险标签、事件或协议");
          else if (/data:/i.test(value)) hit(base + node.start, "HTML 写入含 Data URI", executableData(value) ? "High" : "Medium", expression, "HTML 中嵌入 Data URI", "改为包内资源或经过验证的净化入口");
        }
        if (["CallExpression", "NewExpression"].includes(node.type)) {
          const callee = code.slice(node.callee.start, node.callee.end);
          const resourceCall = /^(?:fetch|importScripts|Worker|SharedWorker|URL)$/.test(callee);
          const setResource = /\.setAttribute$/.test(callee) && /^(?:src|href|action|poster)$/i.test(literal(node.arguments[0]) || "");
          const value = literal(node.arguments[setResource ? 1 : 0]);
          if ((resourceCall || setResource) && value !== null && absolute(value)) hit(base + node.start, "绝对路径或固定路径引用", "High", code.slice(node.start, node.end), "脚本加载依赖固定根路径或本机目录", "改为包内相对路径");
        }
      });
    }
  }
  const unique = [...new Map(findings.map(f => [`${f.file}|${f.line}|${f.rule}`, f])).values()].sort((a, b) => rank[a.risk] - rank[b.risk] || a.file.localeCompare(b.file) || (a.line || 0) - (b.line || 0));
  return { root, htmlCount, configCount, fileCount: files.length, directoryCount: dirs.length, excluded: [...EXCLUDED], unreadable, sinkCount, sanitizedSinkCount, counts: { High: unique.filter(f => f.risk === "High").length, Medium: unique.filter(f => f.risk === "Medium").length, Review: unique.filter(f => f.risk === "Review").length }, findings: unique };
}

export function markdownReport(report) {
  const total = report.findings.length;
  const out = ["# Web Zip 安全扫描报告", "", `扫描路径: ${report.root}`, `扫描的 HTML 文件数: ${report.htmlCount}`, `问题统计: 共 ${total} 项，其中高风险 ${report.counts.High} 项，中风险 ${report.counts.Medium} 项，需人工复核 ${report.counts.Review} 项`, "", "## 总体结论", "", total ? "需修复或复核，具体见下列证据。" : "通过。本次扫描未命中本技能定义的安全规则。", ""];
  for (const [risk, heading, prefix] of [["High", "高风险", "H"], ["Medium", "中风险", "M"], ["Review", "需人工复核", "R"]]) {
    out.push(`## ${heading}`, "");
    const list = report.findings.filter(f => f.risk === risk);
    if (!list.length) out.push("无。", "");
    list.forEach((f, i) => out.push(`### ${prefix}-${i + 1} ${f.rule}`, `- 文件: ${f.file}`, `- 行号: ${f.line ?? "N/A"}`, `- 风险级别: ${risk}`, `- 证据: \`${f.evidence.replace(/`/g, "&#96;")}\``, `- 原因: ${f.reason}`, `- 修复: ${f.fix}`, ""));
  }
  out.push("## 备注", "", `扫描 ${report.fileCount} 个文件路径、${report.configCount} 个 Vite 配置；HTML 写入 ${report.sinkCount} 处，其中 ${report.sanitizedSinkCount} 处调用指定净化器。`, `默认排除目录: ${report.excluded.join(", ")}。目标目录本身始终纳入扫描。`, "仅静态扫描路径、HTML/HTM 和支持的 Vite 配置；不执行页面、不请求外部脚本、不做 DNS 推断。仓库中的测试用静态 HTTP 服务不等于交付物依赖后端。", "本次扫描不能证明交付包不存在所有安全漏洞。独立 JS 文件不在该技能的默认内容扫描范围内。", "");
  return out.join("\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2), report = scanStaticWeb(args[0] || ".");
  const output = args.indexOf("--report");
  if (output >= 0) {
    const dest = path.resolve(args[output + 1]);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, markdownReport(report));
    fs.writeFileSync(dest.replace(/\.md$/i, "") + ".json", JSON.stringify(report, null, 2) + "\n");
  }
  console.log(JSON.stringify({ root: report.root, htmlCount: report.htmlCount, counts: report.counts, sinks: report.sinkCount, sanitized: report.sanitizedSinkCount }));
  process.exitCode = report.findings.length ? 1 : 0;
}
