#!/usr/bin/env node
// 第二代扫描器（v2.1）
// 修掉第一版的缺陷：
//   ① 第一版要求"≥2 个单词" → 漏掉全部单词标签（General/Appearance/System/Off/Display…）
//   ② 第一版逐行匹配 → 漏掉反斜杠折行的跨行长段落
// 本版：
//   - UI 上下文命中 或 match 臂标签 或 句子形态 都算候选（不再看词数）
//   - 支持折行字面量，输出其【原始源码形态】供精确替换
//   - 只跳过 `#[cfg(test)] mod xxx { ... }` 这个块（按括号配对），不再粗暴截断到文件尾
//   - 按预计算的行偏移定位，避免重复行误匹配
const fs = require('fs');
const path = require('path');

const root = process.argv[2];
if (!root) { console.error('用法: node scan_strings2.js <src目录>'); process.exit(1); }

const UI_CTX = [
  '.child(', '.label(', '.tooltip(', 'Tooltip::new(', 'Text::new(',
  'self.section(', 'self.setting_row(', 'PromptButton::ok(', 'PromptButton::cancel(',
  '.placeholder(', '.message(', '.description(', '.title(', '.heading(',
  '.notice(', '.caption(', '.subtitle(', '.hint(', '.alt(', '.aria_label(',
  'alert_dialog(', 'confirm_dialog(', 'show_notice(', 'menu_item(', 'sidebar_item(',
  '.text(', 'ui::Field::', 'Field::new(', 'button_label(',
];
const SKIP_STR = [
  /^$/, /^[\s\W]+$/,
  /[{]/, /%[sd]/,
  /^(true|false|null|none|some|ok|err)$/i,
  /^[a-z0-9_-]+$/,
  /[_]/, /::/, /^@/,
  /\.(rs|json|ts|tsx|js|toml|lock|md|png|jpg|jpeg|gif|mp4|webm|wav|mp3|dll|exe|app|svg)$/i,
  /^[A-Z0-9_]{2,}$/,
  /^[\d\s.,:%+\-/]+$/,
  /[(){}<>]/,
  /\n/,
];
const CJK = /[\u4e00-\u9fa5]/;

function findFiles(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) findFiles(p, acc);
    else if (e.name.endsWith('.rs')) acc.push(p);
  }
  return acc;
}

// 轻量词法器：返回「从 i 开始的构造」结束后的下标。
// 用于花括号配对时跳过注释 / 字符串 / raw string / 字符字面量（否则字符串里的 } 会提前结束区块）
function skipItem(src, i) {
  const c = src[i], n = src[i + 1];
  if (c === '/' && n === '/') { const nl = src.indexOf('\n', i); return nl < 0 ? src.length : nl; }
  if (c === '/' && n === '*') { const e = src.indexOf('*/', i + 2); return e < 0 ? src.length : e + 2; }
  if (c === '"') {
    let k = i - 1, h = 0;
    while (k >= 0 && src[k] === '#') { h++; k--; }
    if (k >= 0 && src[k] === 'r' && !/[A-Za-z0-9_]/.test(src[k - 1] || '')) {
      const closer = '"' + '#'.repeat(h);
      const e = src.indexOf(closer, i + 1);
      return e < 0 ? src.length : e + closer.length;
    }
    let j = i + 1;
    while (j < src.length) { if (src[j] === '\\') { j += 2; continue; } if (src[j] === '"') return j + 1; j++; }
    return src.length;
  }
  if (c === "'") {
    let j = i + 1;
    if (src[j] === '\\') j += 2; else j += 1;
    if (src[j] === "'") return j + 1;   // 字符字面量
    return i + 1;                        // 生命周期标注 'a
  }
  return i + 1;
}

// 找出所有 #[cfg(test)] mod X { ... } 的字节区间（按花括号配对，跳过字符串/注释）
function testRanges(src) {
  const ranges = [];
  const re = /#\[cfg\(test\)\]/g;
  let m;
  while ((m = re.exec(src))) {
    const rest = src.slice(m.index + m[0].length);
    // 必须「紧跟」mod（中间只允许其它属性/空白）——否则 #[cfg(test)] 是加在字段/fn 上的，不是测试模块
    const modMatch = rest.match(/^\s*(?:#\[[^\]]*\]\s*)*mod\s+\w+\s*\{/);
    if (!modMatch) continue;
    const braceStart = m.index + m[0].length + modMatch.index + modMatch[0].length - 1;
    let depth = 0, i = braceStart;
    for (; i < src.length;) {
      const c = src[i];
      if (c === '/' || c === '"' || c === "'") { const ni = skipItem(src, i); if (ni > i) { i = ni; continue; } }
      if (c === '{') depth++;
      else if (c === '}') { depth--; if (depth === 0) { i++; break; } }
      i++;
    }
    ranges.push([m.index, i]);
    re.lastIndex = i;
  }
  return ranges;
}

function parseLiteral(src, i) {
  let j = i + 1, raw = '"', val = '';
  while (j < src.length) {
    const c = src[j];
    if (c === '\\') {
      const n = src[j + 1];
      raw += c + n;
      if (n === 'n') val += '\n';
      else if (n === 't') val += '\t';
      else if (n === '\\') val += '\\';
      else if (n === '"') val += '"';
      else if (n !== '\n') val += n;
      j += 2; continue;
    }
    if (c === '"') { raw += '"'; return { raw, val, end: j + 1, multiline: raw.includes('\\\n') }; }
    if (c === '\n') {
      // 未闭合就跨行了 → 视为解析伪影
      return { raw: raw + '\n', val: val + '\n', end: j + 1, multiline: false, broken: true };
    }
    raw += c; val += c; j++;
  }
  return null;
}

const out = {};
let total = 0;

for (const f of findFiles(root)) {
  const src = fs.readFileSync(f, 'utf8');
  const ranges = testRanges(src);
  const inTest = (pos) => ranges.some(([a, b]) => pos >= a && pos < b);

  // 预计算每行的起始绝对偏移
  const lineStart = [0];
  for (let i = 0; i < src.length; i++) if (src[i] === '\n') lineStart.push(i + 1);
  const lineOf = (pos) => {
    let lo = 0, hi = lineStart.length - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (lineStart[mid] <= pos) lo = mid; else hi = mid - 1; }
    return lo + 1;
  };

  const rel = path.relative(root, f).replace(/\\/g, '/');
  for (let li = 0; li < lineStart.length; li++) {
    const start = lineStart[li];
    const end = li + 1 < lineStart.length ? lineStart[li + 1] : src.length;
    const line = src.slice(start, end);
    if (line.trim().startsWith('//')) continue;
    // 上一「非空」行——识别「参数独占一行」（如 self.section(\n  "Appearance",）
    let pi = li - 1, prevLine = '';
    while (pi >= 0) {
      const ps = lineStart[pi];
      const pe = pi + 1 < lineStart.length ? lineStart[pi + 1] : src.length;
      const pl = src.slice(ps, pe);
      if (pl.trim() && !pl.trim().startsWith('//')) { prevLine = pl; break; }
      pi--;
    }
    const ctxHit = UI_CTX.some((m) => line.includes(m) || prevLine.includes(m));
    let q = line.indexOf('"');
    while (q >= 0) {
      const abs = start + q;
      if (inTest(abs)) break;
      const lit = parseLiteral(src, abs);
      if (!lit) break;
      if (!lit.broken) {
        const skip = SKIP_STR.some((re) => re.test(lit.val));
        const isSentence = /[A-Za-z]{2,}\s+[A-Za-z]{2,}/.test(lit.val) && lit.val.length >= 6;
        const isArm = line.includes('=>') && /^[A-Z]/.test(lit.val) && lit.val.length <= 48;
        // macro 标签：`Ident = "key", "Label";` 里第 2 个字面量是显示名
        const isMacroLabel = /(^|[^\w])[\w]+\s*=\s*"[^"]*"\s*,\s*$/.test(line.slice(0, q));
        // 元组标签：`(Variant, "Label")` / `(0, "Off")` —— 常量选项表里的显示名（如 COUNTDOWN_OPTIONS）
        const isTupleLabel = /\(\s*[^"()]*,\s*$/.test(line.slice(0, q)) && !/^\s*\)/.test(line.slice(q));
        if ((ctxHit || isSentence || isArm || isMacroLabel || isTupleLabel) && !skip && !CJK.test(lit.val) && lit.val.trim().length >= 1) {
          const key = rel + '|' + lit.raw;
          if (!out[key]) { out[key] = { file: rel, line: li + 1, raw: lit.raw, val: lit.val, multiline: lit.multiline }; total++; }
        }
      }
      if (lit.multiline) break;
      q = line.indexOf('"', q + 1);
    }
  }
}

const byFile = {};
for (const v of Object.values(out)) (byFile[v.file] = byFile[v.file] || []).push(v);
for (const [f, list] of Object.entries(byFile).sort()) {
  console.log(`\n########## ${f} (${list.length}) ##########`);
  for (const v of list) {
    const raw = v.multiline ? JSON.stringify(v.raw) : '"' + v.val + '"';
    console.log(`${v.line}: ${raw}${v.multiline ? '  [折行]' : ''}`);
  }
}
console.error(`\n==== 合计 ${total} 条候选，涉及 ${Object.keys(byFile).length} 个文件 ====`);
