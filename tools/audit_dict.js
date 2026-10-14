#!/usr/bin/env node
// 审计候选串：在整个源码树里找出该英文串的【全部】出现位置并判定风险。
// 用法: node audit_dict.js scan_v3.txt
// 输出: scan_v3_audit.txt  ([SAFE] / [RISK:原因] 头部 + 全树出现位置)
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const SRC = ['localized-src/apps/desktop-gpui/src', 'cap-zh/apps/desktop-gpui/src']
  .map(p => path.join(ROOT, p))
  .find(p => fs.existsSync(p)) || path.join(ROOT, 'localized-src/apps/desktop-gpui/src');

function allRs(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) allRs(p, acc);
    else if (e.name.endsWith('.rs')) acc.push(p);
  }
  return acc;
}
// —— 与 scan_strings2.js 同源的测试区块识别（跳过字符串/注释后再配对花括号）——
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
  if (c === "'") { let j = i + 1; if (src[j] === '\\') j += 2; else j += 1; return src[j] === "'" ? j + 1 : i + 1; }
  return i + 1;
}
function testRanges(src) {
  const ranges = []; const re = /#\[cfg\(test\)\]/g; let m;
  while ((m = re.exec(src))) {
    const rest = src.slice(m.index + m[0].length);
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

const FILES = allRs(SRC).map(f => {
  const src = fs.readFileSync(f, 'utf8');
  return {
    rel: path.relative(SRC, f).split(path.sep).join('/'),
    src,
    ranges: testRanges(src),
    lines: src.split('\n'),
    starts: (() => { const a = [0]; for (let i = 0; i < src.length; i++) if (src[i] === '\n') a.push(i + 1); return a; })()
  };
});

// 收集候选
const cands = new Map();
let cur = null;
for (const l of fs.readFileSync(process.argv[2] || 'scan_v3.txt', 'utf8').split('\n')) {
  const m = l.match(/^#+ (.+?) \((\d+)\) #+/); if (m) { cur = m[1]; continue; }
  const mm = l.match(/^(\d+): ("(?:[^"\\]|\\.)*")/); if (mm && cur) cands.set(mm[2], cur + ':' + mm[1]);
}

function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function riskOf(line, lit) {
  const e = esc(lit);
  if (new RegExp('^\\s*' + e + '\\s*(\\||\\|\\||,)?\\s*=>').test(line)) return 'match键';
  if (new RegExp('(contains|starts_with|ends_with|find|matches!|trim_matches|split|strip_prefix|strip_suffix)\\s*\\([^)]*' + e).test(line)) return '比对/解析';
  if (new RegExp('[=!]=\\s*' + e).test(line)) return '相等比较';
  if (new RegExp('\\b(key|slug|id|kind|format|mode|theme|value|name)\\s*[:=]\\s*' + e).test(line)) return '键/值赋值';
  if (/(Path|File|dir|folder|url|Url|href)\s*(::|\.|\()/.test(line) && line.includes(lit)) return '路径/URL?';
  if (/\.(rs|json|toml|exe|dll|png|mp4|webm|wav|md|lock)"/.test(lit)) return '文件名';
  if (/(println!|eprintln!|log::|tracing::|warn!|info!|debug!|error!|trace!)/.test(line)) return 'LOG';
  return null;
}

const out = [];
for (const [lit, where] of cands) {
  const hits = [];
  for (const f of FILES) {
    const inTest = (pos) => f.ranges.some(([a, b]) => pos >= a && pos < b);
    for (let i = 0; i < f.lines.length; i++) {
      const idx = f.lines[i].indexOf(lit);
      if (idx < 0) continue;
      if (f.lines[i].trim().startsWith('//')) continue;
      hits.push({
        rel: f.rel, ln: i + 1, line: f.lines[i].trim(),
        risk: riskOf(f.lines[i], lit),
        test: inTest(f.starts[i] + idx)
      });
    }
  }
  const risks = hits.filter(h => h.risk);
  const nonLog = [...new Set(risks.map(r => r.risk).filter(r => r !== 'LOG'))];
  const nTest = hits.filter(h => h.test).length;
  const nReal = hits.length - nTest;
  let head;
  if (nReal === 0) head = '[TESTONLY]';
  else if (nTest > 0) head = `[TESTMIX:测试区出现${nTest}次]`;
  else if (nonLog.length) head = `[RISK:${nonLog.join(',')}]`;
  else if (risks.length) head = '[LOGONLY]';
  else head = '[SAFE]';
  out.push(`${head} ${lit}   (扫描处 ${where}，全树 ${hits.length} 次)`);
  for (const h of hits) out.push(`    ${h.test ? '[测试]' : '      '}${h.risk ? '!' + h.risk : 'ok'} ${h.rel}:${h.ln}  ${h.line.slice(0, 160)}`);
  out.push('');
}
fs.writeFileSync('scan_v3_audit.txt', out.join('\n'));
const cnt = (t) => out.filter(l => l.startsWith('[' + t)).length;
console.log(`候选 ${cands.size} 条；SAFE ${cnt('SAFE')}；LOGONLY ${cnt('LOGONLY')}；TESTMIX ${cnt('TESTMIX')}；TESTONLY ${cnt('TESTONLY')}；RISK ${cnt('RISK')}`);
