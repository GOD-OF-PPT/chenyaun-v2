// Pure safe-value, sanitization, plain-object merge, and diminishing-returns utilities.

export function safeText(v, fallback = "") {
  if (typeof v === "string") return v;
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return fallback;
}

export function safeDiag(v) {
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return String(v);
  if (v === null) return "null";
  if (v === undefined) return "undefined";
  return "[" + typeof v + "]";
}

export function escapeHtml(s) {
  let str;
  try {
    str = s == null ? "" : String(s);
  } catch (e) {
    str = "";
  }
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function num(v, d = 0) {
  const fallback = (typeof d === "number" && Number.isFinite(d)) ? d : 0;
  if (v == null || typeof v === "boolean" || typeof v === "object") return fallback;
  if (typeof v === "string" && v.trim() === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function rarityNum(v) {
  return Math.max(0, Math.min(5, Math.floor(num(v, 0))));
}

export function hasOwn(obj, key) {
  return !!obj && typeof key === "string" && Object.prototype.hasOwnProperty.call(obj, key);
}

export function safeAssignPlain(target, ...sources) {
  const out = (target && typeof target === "object") ? target : {};
  for (let i = 0; i < sources.length; i++) {
    const src = sources[i];
    if (!src || typeof src !== "object" || Array.isArray(src)) continue;
    const keys = Object.keys(src);
    for (let j = 0; j < keys.length; j++) {
      const k = keys[j];
      if (k === "__proto__" || k === "constructor" || k === "prototype") continue;
      out[k] = src[k];
    }
  }
  return out;
}

export function softCapPct(rawPct, knee = 1.80, cap = 3.20) {
  if (rawPct <= knee) return Math.max(-0.5, rawPct);
  const span = Math.max(0.1, cap - knee);
  return knee + span * (1 - Math.exp(-(rawPct - knee) / span));
}
