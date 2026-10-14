#!/usr/bin/env node
// join_literals.js —— 把「反斜杠折行」的字符串字面量合并成单行（语义等价）
// Rust 规则：`\` + 换行 + 后续空白 会被完全吃掉（不插入空格），所以
//   "…more. \          →  "…more. You may…"
//        You may…"
// 合并后所有字面量都是单行的，逐行替换脚本即可精确匹配。
// 安全措施：跳过注释里的引号、跳过 raw string（r" / r#"），改完务必跑 check_syntax.sh 复核。
const fs = require('fs');
const path = require('path');

const roots = process.argv.slice(2);
if (!roots.length) { console.error('用法: node join_literals.js <文件或目录> ...'); process.exit(1); }

function findFiles(p, acc = []) {
  const st = fs.statSync(p);
  if (st.isDirectory()) { for (const e of fs.readdirSync(p)) findFiles(path.join(p, e), acc); }
  else if (p.endsWith('.rs')) acc.push(p);
  return acc;
}

let totalJoined = 0, changedFiles = 0;

function processFile(file) {
  const src = fs.readFileSync(file, 'utf8');
  let out = '', i = 0, joined = 0;

  while (i < src.length) {
    const c = src[i];

    // 行注释：整段原样复制到换行
    if (c === '/' && src[i + 1] === '/') {
      const nl = src.indexOf('\n', i);
      if (nl < 0) { out += src.slice(i); break; }
      out += src.slice(i, nl); i = nl; continue;
    }
    // 块注释：原样复制
    if (c === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2);
      const stop = end < 0 ? src.length : end + 2;
      out += src.slice(i, stop); i = stop; continue;
    }
    // 字符字面量：跳过
    if (c === "'") {
      let j = i + 1;
      if (src[j] === '\\') j += 2; else j += 1;
      const close = src[j] === "'" ? j + 1 : i + 1;
      out += src.slice(i, close); i = close; continue;
    }
    // 字符串字面量
    if (c === '"') {
      // raw string 检测：向前数连续的 '#'，再往前应是独立前缀 r（如 r" / r#" / r##"）
      // 必须整体跳过 raw string 内容——内容里可以任意出现 "，用 "## 形式收尾
      let k = i - 1, hashes = 0;
      while (k >= 0 && src[k] === '#') { hashes++; k--; }
      const isRaw = k >= 0 && src[k] === 'r' && !/[A-Za-z0-9_]/.test(src[k - 1] || '');
      if (isRaw) {
        const closer = '"' + '#'.repeat(hashes);
        const end = src.indexOf(closer, i + 1);
        const stop = end < 0 ? src.length : end + closer.length;
        out += src.slice(i, stop); i = stop; continue;
      }

      let j = i + 1, content = '"', hasJoin = false;
      while (j < src.length) {
        const d = src[j];
        if (d === '\\') {
          if (src[j + 1] === '\n') {
            hasJoin = true;
            j += 2;
            while (j < src.length && (src[j] === ' ' || src[j] === '\t' || src[j] === '\r')) j++;
            continue;                      // 折行：换行与缩进一起丢弃，不补空格
          }
          content += d + (src[j + 1] ?? ''); j += 2; continue;
        }
        if (d === '"') break;
        content += d; j++;
      }
      // 只有真的遇到收尾引号才补 —— 否则原文照抄，绝不制造悬空引号
      if (j < src.length && src[j] === '"') { content += '"'; out += content; i = j + 1; }
      else { out += src.slice(i); i = src.length; }
      if (hasJoin) joined++;
      continue;
    }
    out += c; i++;
  }

  if (joined > 0) {
    fs.writeFileSync(file, out);
    totalJoined += joined; changedFiles++;
    console.log(`  ${file}：合并 ${joined} 处`);
  }
}

for (const p of roots) for (const f of findFiles(p)) processFile(f);
console.log(`\n==== 共合并 ${totalJoined} 处折行字面量，涉及 ${changedFiles} 个文件 ====`);
