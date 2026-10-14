#!/usr/bin/env node
// 从 orig（英文原版）与 cap-zh（汉化版）的真实差异生成字符串清单
// 因为替换只发生在行内（不增删行），可按下标逐行比对，结果最准
const fs = require('fs');
const path = require('path');
const ORIG = 'orig', ZH = 'cap-zh';

const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.rs')) files.push(p);
  }
})(ORIG);

function lits(line) {
  const out = [];
  const re = /"((?:[^"\\]|\\.)*)"/g;
  let m;
  while ((m = re.exec(line)) !== null) out.push(m[1]);
  return out;
}
const CJK = /[\u4e00-\u9fa5]/;

let totalPairs = 0, totalFiles = 0;
const sections = [];
const summary = [];

for (const of_ of files) {
  const rel = path.relative(ORIG, of_).replace(/\\/g, '/');
  const zhPath = path.join(ZH, rel);
  if (!fs.existsSync(zhPath)) continue;
  const a = fs.readFileSync(of_, 'utf8').split('\n');
  const b = fs.readFileSync(zhPath, 'utf8').split('\n');
  const pairs = [];
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const la = a[i] ?? '', lb = b[i] ?? '';
    if (la === lb) continue;
    const removed = lits(la).filter(s => !CJK.test(s) && s.length > 1);
    const added = lits(lb).filter(s => CJK.test(s));
    if (removed.length && added.length) {
      // 按顺序配对（数量不等时取较短长度，其余单列）
      const k = Math.min(removed.length, added.length);
      for (let j = 0; j < k; j++) pairs.push([removed[j], added[j], i + 1]);
      for (let j = k; j < removed.length; j++) pairs.push([removed[j], '(未配对)', i + 1]);
      for (let j = k; j < added.length; j++) pairs.push(['(未配对)', added[j], i + 1]);
    }
  }
  if (pairs.length) {
    totalFiles++; totalPairs += pairs.length;
    summary.push([rel, pairs.length]);
    sections.push({ rel, pairs });
  }
}

summary.sort((x, y) => y[1] - x[1]);

let md = `# Cap 汉化字符串清单（v2）\n\n> 由 \`orig/\`（英文原版）与 \`cap-zh/\`（汉化版）的真实逐行差异自动生成，共 **${totalPairs}** 处、覆盖 **${totalFiles}** 个源文件。\n> 生成脚本：\`gen_inventory.js\`。\n\n## 各文件改动数\n\n| 源文件 | 处数 |\n|---|---|\n`;
for (const [rel, n] of summary) md += `| \`${rel.replace('apps/desktop-gpui/src/', '')}\` | ${n} |\n`;
md += `| **合计** | **${totalPairs}** |\n\n---

## 明细（英文 → 中文）

> 每节的 \`行号\` 指汉化后文件中的行号。

`;
for (const { rel, pairs } of sections) {
  md += `### \`${rel.replace('apps/desktop-gpui/src/', '')}\`（${pairs.length} 处）\n\n`;
  md += '| 行号 | 英文原文 | 中文译文 |\n|---|---|---|\n';
  for (const [en, zh, line] of pairs) {
    const esc = (s) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
    md += `| ${line} | \`${esc(en)}\` | ${esc(zh)} |\n`;
  }
  md += '\n';
}
fs.writeFileSync('Cap汉化字符串清单.md', md);
console.log(`完成：${totalPairs} 处 / ${totalFiles} 个文件 → Cap汉化字符串清单.md`);
console.log(summary.map(([r, n]) => `${n}  ${r.replace('apps/desktop-gpui/src/', '')}`).join('\n'));
