#!/usr/bin/env node
// 把 dict/*.json 里的汉化对照应用到 cap-zh 源码。
// 安全机制：
//  - 跳过注释行
//  - 跳过字符串字面量处于"逻辑位置"的行（contains/starts_with/ends_with/find/matches!/==/!=、以及作为 match 模式 `"X" =>`）
//  - 只替换带引号的完整字面量 "英文原文"，不做子串替换
//  - 报告：每文件命中数、未命中条目、被拦截的可疑替换
const fs = require('fs'), path = require('path');
// 仓库根目录 = 本脚本所在目录的上一级（脚本放在 tools/ 下）
const ROOT = path.resolve(__dirname, '..');
// 汉化源码目录：优先 localized-src/，兼容本地工作副本 cap-zh/
const SRC = ['localized-src/apps/desktop-gpui/src', 'cap-zh/apps/desktop-gpui/src']
  .map(p => path.join(ROOT, p))
  .find(p => fs.existsSync(p)) || path.join(ROOT, 'localized-src/apps/desktop-gpui/src');
const DICT = path.join(ROOT, 'dict');

// 组名 -> 组内文件（相对 apps/desktop-gpui/src/），用于扁平 {"pairs":[...]} 格式的字典
const GROUPS = {
  'recording-flow': ['onboarding_window.rs','target_overlay.rs','camera_window.rs','teleprompter_window.rs','permissions.rs','permissions_ui.rs','updates.rs'],
  'settings-pages': ['settings_pages.rs'],
  'settings-window': ['settings_window.rs','recording.rs'],
  'app-windows': ['app_windows.rs'],
  'main-window': ['main_window.rs','main.rs'],
  'content': ['library.rs','upload.rs','import.rs','feeds.rs','transcription.rs'],
  'system': ['single_instance.rs','installer.rs','diagnostics.rs','deeplink.rs'],
};

function isRiskyLine(line, enLit) {
  const esc = enLit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (new RegExp('^\\s*' + esc + '\\s*=>').test(line)) return 'match 模式(键)';
  if (new RegExp('(contains|starts_with|ends_with|find|matches!)\\s*\\([^)]*' + esc).test(line)) return '比对函数';
  if (new RegExp('[=!]=\\s*' + esc).test(line)) return '相等比较';
  if (/(^|[^.\w])(key|slug|id)\s*[:=]\s*/.test(line) && line.includes(enLit)) return '疑似 key 赋值';
  return null;
}

function resolvePath(rel) {
  const candidates = [path.join(SRC, rel), path.join(ROOT, 'localized-src', rel), path.join(ROOT, 'cap-zh', rel)];
  for (const c of candidates) if (fs.existsSync(c)) return c;
  return null;
}

function applyPairs(fileRel, pairs) {
  const p = resolvePath(fileRel);
  if (!p) return { err: `文件不存在: ${fileRel}` };
  const lines = fs.readFileSync(p, 'utf8').split('\n');
  let hits = 0;
  const notFound = [], blocked = [];
  for (const pair of pairs) {
    const [en, zh, only] = pair;          // 可选第 3 项：限定行号（应对一符两义）
    const enLit = '"' + en + '"';
    let found = 0;
    for (let i = 0; i < lines.length; i++) {
      if (only && i + 1 !== only) continue;
      const line = lines[i];
      if (line.trim().startsWith('//')) continue;
      if (!line.includes(enLit)) continue;
      const risk = isRiskyLine(line, enLit);
      if (risk) { blocked.push(`  ⚠ ${fileRel}:${i+1} 被拦截(${risk}): ${JSON.stringify(en)}`); continue; }
      lines[i] = line.split(enLit).join('"' + zh + '"');
      found++;
    }
    if (found === 0 && !blocked.some(b => b.includes(JSON.stringify(en)))) {
      notFound.push(only ? `${en} @行${only}` : en);
    }
    hits += found;
  }
  fs.writeFileSync(p, lines.join('\n'));
  return { hits, notFound, blocked };
}

const report = [];
const files = fs.readdirSync(DICT).filter(f => f.endsWith('.json'));
for (const f of files) {
  const name = f.replace(/\.json$/, '');
  let data;
  try { data = JSON.parse(fs.readFileSync(path.join(DICT, f), 'utf8')); }
  catch (e) { report.push(`【${f}】JSON 解析失败: ${e.message}`); continue; }

  report.push(`\n========== ${f} ==========`);
  if (data.files) {
    // 多文件格式（我方手写）
    for (const [rel, pairs] of Object.entries(data.files)) {
      const r = applyPairs(rel, pairs);
      if (r.err) { report.push('  ' + r.err); continue; }
      report.push(`  ${rel}: 命中 ${r.hits} 处` + (r.notFound.length ? `, 未命中 ${r.notFound.length}` : ''));
      r.notFound.forEach(m => report.push(`      ✗ 未找到: ${JSON.stringify(m)}`));
      r.blocked.forEach(b => report.push(b));
    }
  } else if (data.pairs) {
    const group = GROUPS[name];
    if (!group) { report.push(`  ⚠ 未知组名 ${name}，跳过`); continue; }
    const remaining = new Set(data.pairs.map(p => p[0]));
    for (const rel of group) {
      const pairs = data.pairs; // 应用到组内每个文件（不存在的自然未命中）
      const r = applyPairs(rel, pairs);
      if (r.err) { report.push('  ' + r.err); continue; }
      if (r.hits > 0 || r.blocked.length) report.push(`  ${rel}: 命中 ${r.hits} 处`);
      r.blocked.forEach(b => report.push(b));
      data.pairs.forEach(p => { if (!r.notFound.includes(p[0])) remaining.delete(p[0]); });
    }
    if (remaining.size) {
      report.push(`  ✗ 全组均未命中 ${remaining.size} 条:`);
      [...remaining].forEach(m => report.push(`      ✗ ${JSON.stringify(m)}`));
    }
  }
}
console.log(report.join('\n'));
