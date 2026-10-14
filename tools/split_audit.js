#!/usr/bin/env node
// 把 scan_v3_audit.txt 按「候选扫描处所在文件」拆分：
//   audit/<file>.txt        —— 只含 [SAFE] / [LOGONLY]（交给子代理翻译）
//   edge-review.txt         —— [TESTMIX] / [TESTONLY] / [RISK:*]（人工裁决，不自动译）
const fs = require('fs'), path = require('path');

const text = fs.readFileSync('scan_v3_audit.txt', 'utf8');
const blocks = text.split(/\n(?=\[)/).filter(b => /^\[(SAFE|RISK|LOGONLY|TESTMIX|TESTONLY)/.test(b));

const byFile = new Map(), edge = [];
for (const b of blocks) {
  const head = b.split('\n')[0];
  if (!/^\[(SAFE|LOGONLY)/.test(head)) { edge.push(b.replace(/\n+$/, '')); continue; }
  const m = head.match(/扫描处 ([^\s，]+):(\d+)/);
  if (!m) { edge.push(b.replace(/\n+$/, '')); continue; }
  const file = m[1].replace(/\\/g, '/');
  if (!byFile.has(file)) byFile.set(file, []);
  byFile.get(file).push(b.replace(/\n+$/, ''));
}

fs.rmSync('audit', { recursive: true, force: true });
let n = 0, c = 0;
const counts = [];
for (const [f, list] of byFile) {
  const out = [`===== ${f} =====`, `（本文件可译候选 ${list.length} 条；头部 [SAFE]=安全 / [LOGONLY]=仅日志出现）`, '', list.join('\n\n'), ''];
  const dst = path.join('audit', f + '.txt');
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.writeFileSync(dst, out.join('\n'));
  counts.push([list.length, f]);
  n++; c += list.length;
}
fs.writeFileSync('edge-review.txt',
  `# 边缘项清单（不自动翻译，需人工裁决）\n\n` +
  `共 ${edge.length} 条。判定含义：\n` +
  `- [TESTMIX]  该串在测试区出现过 → 自动译可能造成测试期望值不一致\n` +
  `- [TESTONLY] 只在测试区出现 → 译了也没有收益\n` +
  `- [RISK:*]   出现于 match 键 / 相等比较 / contains / key 赋值 → 双用途，必须人工确认\n\n` +
  edge.join('\n\n') + '\n');

counts.sort((a, b) => b[0] - a[0]);
console.log(`audit/：${n} 个文件，${c} 条可译候选；edge-review.txt：${edge.length} 条边缘项`);
console.log('各文件条数：');
for (const [k, f] of counts) console.log(String(k).padStart(4), f);
