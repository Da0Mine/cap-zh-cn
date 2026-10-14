#!/usr/bin/env node
// 校验字典是否可安全应用。
// 用法: node verify_dict.js dict/v3-xxx.json [...更多字典]
// 检查：
//  1) 原文 "en" 必须能在目标文件里找到
//  2) 译文非空、不等于原文
//  3) 占位符一致性：{name} / %s / %d / \n
//  4) 原文在 scan_v3_audit.txt 里被判为 [RISK:*]/[TESTMIX]/[TESTONLY] → 报错
//     （允许用 [en, zh, 行号] 形式精确定位，但类别仍须为 SAFE/LOGONLY）
//  5) 同一 en 在同一文件里不允许两种译文（不同文件允许）
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const SRC = ['localized-src/apps/desktop-gpui/src', 'cap-zh/apps/desktop-gpui/src']
  .map(p => path.join(ROOT, p))
  .find(p => fs.existsSync(p)) || path.join(ROOT, 'localized-src/apps/desktop-gpui/src');

const verdict = new Map();
if (fs.existsSync('scan_v3_audit.txt')) {
  for (const l of fs.readFileSync('scan_v3_audit.txt', 'utf8').split('\n')) {
    const m = l.match(/^\[(SAFE|LOGONLY|RISK:[^\]]*|TESTMIX[^\]]*|TESTONLY)[^\]]*\]\s+("(?:[^"\\]|\\.)*")/);
    if (m) verdict.set(m[2], m[1]);
  }
}

function readList(f) {
  const s = new Set();
  const p = path.join(__dirname, f);
  if (fs.existsSync(p)) for (const l of fs.readFileSync(p, 'utf8').split('\n')) {
    const t = l.trim();
    if (t && !t.startsWith('#')) s.add(t);
  }
  return s;
}
const BLACK = readList('blacklist.txt');
const ALLOW = readList('edge-allow.txt');

function resolve(rel) {
  for (const c of [path.join(SRC, rel), path.join(ROOT, 'localized-src', rel), path.join(ROOT, 'cap-zh', rel)]) if (fs.existsSync(c)) return c;
  return null;
}
function counters(s) {
  return {
    braces: (s.match(/\{[a-zA-Z0-9_.]*\}/g) || []).sort().join(','),
    pct: (s.match(/%[sdvif]/g) || []).length,
    nl: (s.match(/\\n/g) || []).length,
  };
}

const files = process.argv.slice(2);
if (!files.length) { console.error('用法: node verify_dict.js <dict.json> ...'); process.exit(2); }

let nEntries = 0, nOk = 0;
const errors = [], warns = [];

for (const df of files) {
  let data;
  try { data = JSON.parse(fs.readFileSync(df, 'utf8')); }
  catch (e) { errors.push(`${df}: JSON 解析失败 ${e.message}`); continue; }

  const entries = [];
  if (data.files) for (const [rel, pairs] of Object.entries(data.files)) for (const p of pairs) entries.push([rel, p]);
  else if (data.pairs) for (const p of data.pairs) entries.push([null, p]);
  else if (Array.isArray(data)) for (const p of data) entries.push([null, p]);
  else { errors.push(`${df}: 未知字典结构`); continue; }

  const seen = new Map();
  for (const [rel, pair] of entries) {
    const [en, zh, only] = pair;
    nEntries++;
    const lit = '"' + en + '"';
    if (!zh || !zh.trim()) errors.push(`${df}: 译文为空 ${JSON.stringify(en)}`);
    if (zh === en) errors.push(`${df}: 译文与原文相同 ${JSON.stringify(en)}`);
    if (/^[\x00-\x7F]*$/.test(zh) && /[A-Za-z]/.test(zh)) warns.push(`${df}: 译文仍是 ASCII 英文 ${JSON.stringify(en)} -> ${JSON.stringify(zh)}`);
    const ce = counters(en), cz = counters(zh);
    if (ce.braces !== cz.braces) errors.push(`${df}: 占位符 {…} 不一致 ${JSON.stringify(en)} -> ${JSON.stringify(zh)} [${ce.braces}] vs [${cz.braces}]`);
    if (ce.pct !== cz.pct) errors.push(`${df}: %s/%d 数量不一致 ${JSON.stringify(en)} -> ${JSON.stringify(zh)}`);
    if (ce.nl !== cz.nl) warns.push(`${df}: \\n 数量不一致 ${JSON.stringify(en)} -> ${JSON.stringify(zh)}`);

    if (BLACK.has(en)) errors.push(`${df}: 命中禁译清单 ${JSON.stringify(en)}`);
    const v = verdict.get(lit);
    if (v && v !== 'SAFE' && v !== 'LOGONLY' && !ALLOW.has(en)) {
      errors.push(`${df}: 原文明令禁止翻译(${v}) ${JSON.stringify(en)}`);
    }

    const sk = rel + '|' + en + '|' + (only || '');
    if (seen.has(sk) && seen.get(sk) !== zh) errors.push(`${df}: ${rel} 中同一原文两种译文 ${JSON.stringify(en)}`);
    seen.set(sk, zh);

    if (rel) {
      const p = resolve(rel);
      if (!p) { errors.push(`${df}: 文件不存在 ${rel}`); continue; }
      const lines = fs.readFileSync(p, 'utf8').split('\n');
      const target = only ? lines[only - 1] : lines.join('\n');
      if (target === undefined) errors.push(`${df}: ${rel} 行号 ${only} 越界（${JSON.stringify(en)}）`);
      else if (!target.includes(lit)) errors.push(`${df}: 原文未找到 ${rel}${only ? ':' + only : ''} :: ${JSON.stringify(en)}`);
      else nOk++;
    } else nOk++;
  }
}

console.log(`条目 ${nEntries}，通过 ${nOk}，错误 ${errors.length}，警告 ${warns.length}`);
for (const e of errors) console.log('  ✗ ' + e);
for (const w of warns) console.log('  ⚠ ' + w);
process.exit(errors.length ? 1 : 0);
