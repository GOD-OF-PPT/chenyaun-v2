import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { scanStaticWeb } from "../scripts/scan-static-web.mjs";

function fixture(files, check) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cy-security-fixture-"));
  try {
    for (const [name, content] of Object.entries(files)) {
      const dest = path.join(dir, name);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, content);
    }
    check(scanStaticWeb(dir));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

test("reports all rule families with line evidence", () => {
  fixture({
    "中文/readme.txt": "path check",
    "app.py": "backend",
    "vite.config.ts": 'export default { base: "/game/" };',
    "index.html": `<meta http-equiv="refresh" content="0;url=other.html">
<iframe></iframe><object></object><embed>
<a href="javascript:alert(1)">x</a><img src="data:image/svg+xml,x">
<img src="/assets/x.webp"><style>div{background:url(C:\\site\\x.png)}</style>
<script src="http://localhost/x.js"></script>
<script>eval(input); document.write(input); document.cookie;
el.innerHTML = rows.map(x => { return \`<b>\${x}</b>;\`; }).join("");
el.outerHTML = '<img onerror="attack()">'; fetch("/api");</script>`
  }, r => {
    assert.ok(r.counts.High >= 10);
    assert.ok(r.counts.Medium >= 2);
    assert.equal(r.counts.Review, 0);
    for (const rule of ["路径包含中文", "非静态 Web 交付", "Vite 固定基路径", "Meta Refresh 跳转", "危险嵌入标签", "JavaScript 协议引用", "活跃源属性 Data URI", "绝对路径或固定路径引用", "静态资源路径可移植性", "不安全外部脚本来源", "高风险 JavaScript API", "动态 HTML 写入", "危险静态 HTML 写入"]) assert.ok(r.findings.some(f => f.rule === rule), rule);
    assert.equal(r.findings.find(f => f.rule === "动态 HTML 写入").line, 7);
    assert.ok(r.findings.every(f => f.evidence.length <= 240));
  });
});

test("parses multiline expressions without truncating templates, braces or comments", () => {
  fixture({ "index.html": `<script>
el.innerHTML = rows.map(x => { /* ; */ return \`<b>\${x ? "a;" : "b"}</b>\`; }).join("");
el.innerHTML = DOMPurify.sanitize(rows.map(x => \`<b>\${x}</b>\`).join(""), { ADD_TAGS: ["canvas"] });
el.outerHTML = sanitizeHtml(value);
el.innerHTML = filterXSS(value);
el["innerHTML"] = "<b>" + "safe</b>";
el.innerHTML = "";
</script>` }, r => {
    assert.equal(r.sinkCount, 6);
    assert.equal(r.sanitizedSinkCount, 3);
    assert.equal(r.counts.High, 1);
    assert.equal(r.counts.Review, 0);
  });
});

test("accepts safe relative/public references and excludes only default subdirectories", () => {
  fixture({
    "index.html": '<button data-action="/not-a-url">x</button><img src="./art/x.webp"><script src="https://cdn.example.com/x.js"></script><style>div{background:url(../art/x.webp)}</style>',
    "vite.config.mjs": 'export default { base: "./" };',
    "node_modules/中文/index.html": '<iframe>',
    "dist/中文/index.html": '<iframe>',
    ".git/中文.txt": "ignored"
  }, r => { assert.deepEqual(r.counts, { High: 0, Medium: 0, Review: 0 }); assert.equal(r.htmlCount, 1); });
});

test("flags special-use script hosts, parse failures and unreadable UTF-8", () => {
  fixture({
    "index.html": '<script src="https://[::1]/x.js"></script><script src="https://127.0.0.1/x.js"></script><script src="//example.com/x.js"></script><script src="https://user:pass@example.com/x.js"></script><script>const =;</script>\n<script src=http://[::]/x.js></script>',
    "bad.html": Buffer.from([0xff, 0xfe, 0x00])
  }, r => { assert.equal(r.counts.High, 2); assert.equal(r.counts.Review, 2); assert.deepEqual(r.unreadable, ["bad.html"]); });
});

test("recognizes unquoted and mixed-case refresh directives", () => {
  fixture({ "index.html": '<META content="0; url=x.html" HTTP-EQUIV=Refresh>' }, r => {
    assert.equal(r.counts.High, 1);
    assert.equal(r.findings[0].rule, "Meta Refresh 跳转");
  });
});
