#!/usr/bin/env node
// 双用途隐患扫描：找出「被翻译成中文、但可能同时作为机器值/配置值使用」的字符串
// 检查 1：含中文的 const [&str; N] 常量数组（如 FONT_OPTIONS 那类）
// 检查 2：同一中文字面量在源码中同时出现在 ==/!=/contains/starts_with 等比较位置
const fs = require('fs');
const path = require('path');
const root = process.argv[2] || 'cap-zh/apps/desktop-gpui/src';
const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.rs')) files.push(p);
  }
})(root);

const CJK = /[\u4e00-\u9fa5]/;
let findings = 0;

for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  const lines = src.split('\n');

  // 检查 1：中文 const 数组
  const reConst = /const\s+([A-Z0-9_]+)\s*:\s*\[[^\]]*&str[^\]]*\]\s*=/g;
  let m;
  while ((m = reConst.exec(src)) !== null) {
    const end = src.indexOf(';', m.index);
    const seg = src.slice(m.index, end + 1);
    if (CJK.test(seg)) {
      const line = src.slice(0, m.index).split('\n').length;
      console.log(`⚠ [常量数组] ${f.replace(root + '/', '')}:${line}  ${m[1]}`);
      findings++;
    }
  }

  // 检查 2：中文字面量被用于比较/匹配
  const reStr = /"((?:[^"\\]|\\.)*[\u4e00-\u9fa5](?:[^"\\]|\\.)*)"/g;
  while ((m = reStr.exec(src)) !== null) {
    const lit = m[1];
    for (let i = 0; i < lines.length; i++) {
      const ln = lines[i];
      if (!ln.includes('"' + lit + '"')) continue;
      if (ln.trim().startsWith('//')) continue;
      if (/(contains|starts_with|ends_with|find|matches!)\s*\([^)]*"[\u4e00-\u9fa5]/.test(ln) ||
          /[=!]=\s*"[^"]*[\u4e00-\u9fa5]/.test(ln) ||
          /^\s*"[^"]*[\u4e00-\u9fa5][^"]*"\s*=>/.test(ln)) {
        console.log(`⚠ [比较/匹配位置] ${f.replace(root + '/', '')}:${i + 1}  ${JSON.stringify(lit)}`);
        console.log(`      ${ln.trim().slice(0, 140)}`);
        findings++;
      }
    }
  }
}
console.log(`\n==== 双用途隐患合计: ${findings} 处 ====`);
